
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';
import { Expression } from '../types';
import { SYSTEM_INSTRUCTION } from '../data/systemPrompt';
import { TOOLS } from '../data/tools';

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

    // 1 FPS for stability and performance
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
            if (!activeRef.current) return; // Double check active state
            try {
                session.sendRealtimeInput({
                    media: {
                        mimeType: 'image/jpeg',
                        data: base64Data
                    }
                });
            } catch (e) {
                console.warn("Failed to send video frame (socket likely closed)", e);
            }
        }).catch(() => {});

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

      // Fallback to localStorage if process.env is empty (helps in published builds)
      let apiKey = process.env.API_KEY || localStorage.getItem("GEMINI_API_KEY");
      
      if (!apiKey || apiKey === 'undefined') {
        throw new Error("API Key not found. Please select an API key to continue.");
      }

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      
      // Let browser decide sample rate (usually 48000) for stability
      inputAudioContextRef.current = new AudioContext(); 
      
      // Use 'interactive' latency hint for faster response times
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000, latencyHint: 'interactive' });
      
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

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        const { latitude, longitude } = position.coords;
        locationRef.current = { lat: latitude, lng: longitude };
      } catch (locErr: any) {
        if (locErr.code === 1) {
             locationDeniedRef.current = true;
        }
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Sweetest voice
          },
          tools: TOOLS,
          systemInstruction: SYSTEM_INSTRUCTION,
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

            // 4096 samples buffer
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!activeRef.current) return;
              
              const isAiSpeaking = scheduledSourcesRef.current.size > 0;
              const timeSinceFinishedSpeaking = Date.now() - lastAiSpeechEndTimeRef.current;
              // 600ms Echo Tail Buffer (Optimized for faster turn-taking)
              const isEchoTail = timeSinceFinishedSpeaking < 600; 

              if (isAiSpeaking || isEchoTail) {
                return; 
              }

              const inputData = e.inputBuffer.getChannelData(0);
              const inputSampleRate = inputAudioContextRef.current?.sampleRate || 48000;
              const pcmBlob = createPcmBlob(inputData, inputSampleRate);
              
              sessionPromiseRef.current?.then((session) => {
                 if (!activeRef.current) return; // Prevent sending if closed while thinking
                 try {
                     session.sendRealtimeInput({ media: pcmBlob });
                 } catch (e) {
                     // Ignore duplicate close errors
                 }
              }).catch(() => {});
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
                        if (!activeRef.current) return;
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
                   // 500ms Lookahead Buffer (Optimized for Singing stability vs Latency)
                   if (nextStartTimeRef.current < currentTime) {
                       nextStartTimeRef.current = currentTime + 0.5; 
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
