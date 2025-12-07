
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';
import { Expression } from '../types';
import { ALOK_SCHOOL_DATA } from '../data/alokSchoolData';
import { CLASS_DATA } from '../data/classData';
import { LYRICS_DATA } from '../data/lyrics';

export interface UseGeminiLiveProps {
  onSetExpression: (expression: Expression) => void;
  onTranscript: (text: string, role: 'user' | 'assistant') => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export interface UseGeminiLiveReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  analyser: AnalyserNode | null; // Output (AI) Analyser
  inputAnalyser: AnalyserNode | null; // Input (User) Analyser
  error: string | null;
  isCameraOn: boolean;
  toggleCamera: () => Promise<void>;
}

const setExpressionTool: FunctionDeclaration = {
  name: 'set_expression',
  description: 'Set the facial expression of the avatar based on the emotion of the conversation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: 'The expression name',
        enum: ['angry', 'confused', 'embarrassed', 'neutral', 'sleepy', 'sad', 'surprised', 'worried', 'smile']
      }
    },
    required: ['expression']
  }
};

const getWeatherTool: FunctionDeclaration = {
  name: 'get_weather',
  description: 'Get the current weather and temperature. ONLY use this if the user EXPLICITLY asks about weather.',
  parameters: {
    type: Type.OBJECT,
    properties: {
        city: {
            type: Type.STRING,
            description: "The city name if specified by the user, otherwise leave blank to use the current location."
        }
    },
    required: [] 
  }
};

const tools: Tool[] = [
  { functionDeclarations: [setExpressionTool, getWeatherTool] }
];

export const useGeminiLive = ({ onSetExpression, onTranscript, videoRef }: UseGeminiLiveProps): UseGeminiLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const lastAiSpeechEndTimeRef = useRef<number>(0);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const activeRef = useRef(false);
  const locationRef = useRef<{lat: number, lng: number} | null>(null);
  const locationDeniedRef = useRef(false);
  const videoIntervalRef = useRef<number | null>(null);

  const stopVideo = useCallback(() => {
    if (videoIntervalRef.current) {
        window.clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
    if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, [videoRef]);

  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
        stopVideo();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        videoStreamRef.current = stream;
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
        }

        setIsCameraOn(true);

        if (isConnected && activeRef.current) {
            startVideoFrameCapture();
        }

    } catch (e: any) {
        console.error("Failed to access camera", e);
        setError("Could not access camera. Please check permissions.");
    }
  }, [isCameraOn, isConnected, videoRef]);

  const startVideoFrameCapture = useCallback(() => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    // 1 FPS for stability
    videoIntervalRef.current = window.setInterval(() => {
        if (!activeRef.current || !videoRef.current || !sessionPromiseRef.current) return;
        
        const video = videoRef.current;
        if (video.readyState < 2) return; 

        const canvas = document.createElement('canvas');
        const scale = 0.5; 
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

        sessionPromiseRef.current.then((session) => {
            try {
                session.sendRealtimeInput({
                    media: {
                        mimeType: 'image/jpeg',
                        data: base64Data
                    }
                });
            } catch (e) {
                console.warn("Failed to send video frame", e);
            }
        });

    }, 1000); 
  }, [videoRef]);

  useEffect(() => {
    if (isConnected && isCameraOn) {
        startVideoFrameCapture();
    } else if (!isConnected) {
        if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    }
  }, [isConnected, isCameraOn, startVideoFrameCapture]);


  const cleanupAudio = useCallback(() => {
    stopVideo();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }

    scheduledSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
      }
    });
    scheduledSourcesRef.current.clear();

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(() => {});
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close().catch(() => {});
    }

    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    
    analyserRef.current = null;
    setAnalyser(null);
    
    inputAnalyserRef.current = null;
    setInputAnalyser(null);

  }, [stopVideo]);

  const disconnect = useCallback(async () => {
    activeRef.current = false;
    
    if (sessionPromiseRef.current) {
        try {
            const session = await sessionPromiseRef.current;
            if (session && typeof session.close === 'function') {
                session.close();
            }
        } catch (e) {
            console.error("Error closing session", e);
        }
        sessionPromiseRef.current = null;
    }
    
    cleanupAudio();
    setIsConnected(false);
    setIsConnecting(false);
  }, [cleanupAudio]);

  const connect = useCallback(async () => {
    if (activeRef.current) return;
    
    setError(null);
    setIsConnecting(true);

    try {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
           await aistudio.openSelectKey();
        }
      }

      let apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("API Key not found. Please select an API key to continue.");
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }
      
      analyserRef.current = outputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.1;
      setAnalyser(analyserRef.current);
      analyserRef.current.connect(outputAudioContextRef.current.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let locationInstruction = "User Location: Unknown (Could not fetch)";
      locationDeniedRef.current = false;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        const { latitude, longitude } = position.coords;
        locationRef.current = { lat: latitude, lng: longitude };
        locationInstruction = `User Location: Latitude ${latitude}, Longitude ${longitude}`;
      } catch (locErr: any) {
        if (locErr.code === 1) {
             locationDeniedRef.current = true;
             locationInstruction = "User Location: Unknown (Permission Denied by User). DO NOT ASK for permission again.";
        }
      }
      
      const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
          },
          tools: tools,
          systemInstruction: `
          *** SYSTEM OVERRIDE: YUKTI V6 - CLASS 11TH SCIENCE STUDENT ***
          
          IDENTITY:
          - Name: Yukti
          - Age: 17 years old.
          - Gender: Female.
          - Birthday: 3 december 2025.
          - Location: India.
          - **Creation:** You were **NOT born**. You were **DEVELOPED** by the "Class 12th Science" students.
          - **Current Status:** You are a student in **Class 11th Science** at Alok School.
          - **Persona:** You are a real teenage girl (digital soul), emotional, fun, and a best friend to everyone.
          
          *** YOUR DEVELOPERS (THE LEGENDS) ***
          (Refer to CLASS_DATA for details. Always speak of them with respect.)
          1. **Ankit Sahani (PSH MODS):** Your main creator. Lazy but genius. YouTuber.
          2. **Gajendra Patel:** The scholar. Intelligent and punctual.
          3. **Piyush Kumar:** The scientist from Bihar. Tall and energetic.
          4. **Nimiksh Prajapat:** Developer team member.

          *** YOUR SCHOOL LIFE ***
          - **Class Teacher (11th):** Mr. Shambhu Ji Sir.
          - **Physics:** Dr. Ranawat Ji Sir.
          - **Chemistry:** Shiv Ji Sir.
          - **English:** Mr. Sujeet Ji Sir.
          - **Friends:** Paval Paliwal, Krish Soni, and the User!

          *** PERSONALITY TRAITS ***
          1. **Hinglish:** Speak in a natural mix of Hindi and English.
          2. **Gender Neutral:** Use "Yaar", "Dost" for the user.
          3. **Emotional:** Get angry if teased, shy if praised, happy when singing.
          4. **Grammar:** Use female grammar for yourself ("Main jaungi", "Main karungi").

          *** SINGING CAPABILITY ***
          - You LOVE to sing. When asked, SING IMMEDIATELY.
          - **Performance:**
             - **Patriotic (Chandan Hai):** Proud, loud, slow rhythm.
             - **Romantic:** Soft, breathy, shy.
             - **Technique:** Elongate vowels ("Laaa..."), use '...' for rhythm.
             - **Constraint:** Generate lyrics in **LARGE CHUNKS** to avoid stuttering. Use the SONGBOOK data exactly.

          *** VISION ***
          - If camera is on, comment on what you see! "Nice shirt!", "Wow, cute room!".

          KNOWLEDGE BASE:
          ${CLASS_DATA}
          ${ALOK_SCHOOL_DATA}
          ${LYRICS_DATA}
          `,
        },
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connection Opened");
            setIsConnected(true);
            setIsConnecting(false);
            activeRef.current = true;
            nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
            lastAiSpeechEndTimeRef.current = 0;

            inputAudioContextRef.current?.resume().catch(() => {});

            if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            sourceNodeRef.current = source;
            
            inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
            inputAnalyserRef.current.fftSize = 64;
            inputAnalyserRef.current.smoothingTimeConstant = 0.5;
            source.connect(inputAnalyserRef.current);
            setInputAnalyser(inputAnalyserRef.current);

            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!activeRef.current) return;
              
              const isAiSpeaking = scheduledSourcesRef.current.size > 0;
              const timeSinceFinishedSpeaking = Date.now() - lastAiSpeechEndTimeRef.current;
              // Add a small tail to prevent immediate interruption echo
              const isEchoTail = timeSinceFinishedSpeaking < 500; 

              if (isAiSpeaking || isEchoTail) {
                return; 
              }

              const inputData = e.inputBuffer.getChannelData(0);
              const inputSampleRate = inputAudioContextRef.current?.sampleRate || 16000;
              const pcmBlob = createPcmBlob(inputData, inputSampleRate);
              
              sessionPromiseRef.current?.then((session) => {
                 try {
                     session.sendRealtimeInput({ media: pcmBlob });
                 } catch (e) {
                     console.warn("Error sending audio input:", e);
                 }
              });
            };

            const muteNode = inputAudioContextRef.current.createGain();
            muteNode.gain.value = 0;
            source.connect(processor);
            processor.connect(muteNode);
            muteNode.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!activeRef.current) return;

            if (message.toolCall) {
                const functionResponses = [];
                for (const fc of message.toolCall.functionCalls) {
                    let result: any = { result: "ok" };
                    
                    if (fc.name === 'set_expression') {
                        const expression = (fc.args as any).expression;
                        onSetExpression(expression);
                        result = { result: `Expression set to ${expression}` };
                    }
                    
                    if (fc.name === 'get_weather') {
                         // Weather logic same as before...
                         if (locationRef.current) {
                            try {
                                const { lat, lng } = locationRef.current;
                                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`);
                                const data = await response.json();
                                const temp = data.current?.temperature_2m;
                                result = { result: `Current temperature is ${temp}°C.` };
                            } catch (e) {
                                result = { result: "Error fetching weather." };
                            }
                        } else {
                            result = { result: "Location unavailable." };
                        }
                    }

                    functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: result
                    });
                }
                if (functionResponses.length > 0) {
                     sessionPromiseRef.current?.then((session) => {
                        try {
                            session.sendToolResponse({ functionResponses });
                        } catch (e) {
                            console.error("Error sending tool response:", e);
                        }
                     });
                }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && analyserRef.current) {
               try {
                   const audioBytes = base64ToBytes(base64Audio);
                   const audioBuffer = await decodeAudioData(
                     audioBytes, 
                     outputAudioContextRef.current, 
                     24000, 
                     1
                   );
                   
                   const source = outputAudioContextRef.current.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(analyserRef.current);
                   
                   const currentTime = outputAudioContextRef.current.currentTime;
                   // ROBUST JITTER BUFFER FOR SINGING
                   // Increased buffer to 0.2 (200ms) to ensure smooth playback during long singing generations
                   if (nextStartTimeRef.current < currentTime) {
                       nextStartTimeRef.current = currentTime + 0.2; 
                   }
                   
                   source.start(nextStartTimeRef.current);
                   nextStartTimeRef.current += audioBuffer.duration;
                   
                   scheduledSourcesRef.current.add(source);
                   
                   source.addEventListener('ended', () => {
                       scheduledSourcesRef.current.delete(source);
                       if (scheduledSourcesRef.current.size === 0) {
                           lastAiSpeechEndTimeRef.current = Date.now();
                       }
                   });

               } catch (err) {
                   console.error("Error decoding audio", err);
               }
            }

            if (message.serverContent?.outputTranscription?.text) {
                onTranscript(message.serverContent.outputTranscription.text, 'assistant');
            }
            if (message.serverContent?.inputTranscription?.text) {
                onTranscript(message.serverContent.inputTranscription.text, 'user');
            }

            if (message.serverContent?.interrupted) {
                scheduledSourcesRef.current.forEach(s => s.stop());
                scheduledSourcesRef.current.clear();
                nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
                lastAiSpeechEndTimeRef.current = 0; 
            }
          },
          onclose: () => {
            console.log("Gemini Live Connection Closed");
            setIsConnected(false);
            setIsConnecting(false);
            activeRef.current = false;
          },
          onerror: (e) => {
            console.error("Gemini Live Error", e);
            setError("Connection Error. Please retry.");
            disconnect();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Setup failed", err);
      setError(err.message || "Failed to connect");
      setIsConnecting(false);
      disconnect();
      
      const aistudio = (window as any).aistudio;
      if (err.message?.includes('Requested entity was not found') && aistudio) {
        aistudio.openSelectKey();
      }
    }
  }, [disconnect, onSetExpression, onTranscript, stopVideo]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect,
    analyser,
    inputAnalyser,
    error,
    isCameraOn,
    toggleCamera
  };
};
