
import React, { useEffect, useRef, useState } from 'react';

interface ControlPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  analyser: AnalyserNode | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
  isConnected, 
  isConnecting, 
  onConnect, 
  onDisconnect,
  isCameraOn,
  onToggleCamera,
  analyser
}) => {
  const [volume, setVolume] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    // Canvas Visualizer Logic
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!analyser || !isConnected) {
        setVolume(0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        
        // Volume calculation for outer ring
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const norm = Math.min(1, (average / 50)); 
        setVolume(norm);

        // Visualizer Drawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.fillStyle = 'rgba(16, 185, 129, 0.5)'; // Emerald
        
        // Simple bar visualizer mirrored from center
        const bars = 12;
        const step = Math.floor(bufferLength / bars);
        const width = 6;
        const spacing = 3;

        for (let i = 0; i < bars; i++) {
            const value = dataArray[i * step] / 2;
            const h = value * 0.8; // Taller bars
            
            // Right side
            ctx.fillRect(centerX + (i * (width + spacing)), centerY - h/2, width, h);
            // Left side
            ctx.fillRect(centerX - ((i + 1) * (width + spacing)) + spacing, centerY - h/2, width, h);
        }

        animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationRef.current);
  }, [analyser, isConnected]);

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center pointer-events-none px-0 md:px-0 md:bottom-10">
      
      {/* Container with Glassmorphism */}
      <div className="pointer-events-auto w-full md:w-auto transition-all duration-300">
        
        {/* Glow behind dock */}
        <div className={`hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-blue-500/20 blur-[50px] rounded-full transition-opacity duration-700 ${isConnected ? 'opacity-60' : 'opacity-0'}`}></div>

        {/* Main Dock Body */}
        <div className="relative bg-[#050b14]/95 backdrop-blur-2xl md:rounded-2xl border-t border-white/10 md:border border-slate-700/50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] md:shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-4 md:py-6 md:px-12 flex items-center justify-between md:gap-16 overflow-hidden md:min-w-[600px]">
            
            {/* Background Tech Grid Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
            </div>

            {/* Left Section: Status & Info */}
            <div className="flex items-center gap-4 z-10 w-1/3">
                <div className="flex flex-col w-full">
                    <div className="flex items-center gap-3">
                         <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></div>
                         <span className="text-[10px] md:text-xs font-mono font-bold tracking-[0.2em] text-slate-300 uppercase">
                            {isConnecting ? 'Initializing Link' : isConnected ? 'Neural Link Active' : 'System Standby'}
                         </span>
                    </div>
                    <div className="h-1 w-full bg-slate-800 mt-2 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ease-out ${isConnected ? 'w-full bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'w-0'}`}></div>
                    </div>
                </div>
            </div>

            {/* Center Section: Main Controls */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                
                {/* Visualizer Canvas (Larger now) */}
                <canvas ref={canvasRef} width={240} height={80} className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-50 pointer-events-none w-[300px] h-[100px]" />

                {/* Main Action Button */}
                <div className="relative group">
                    {/* Audio Reactive Ring */}
                    <div className={`absolute inset-0 rounded-full border-2 border-emerald-500/40 transition-all duration-75 ${isConnected ? 'opacity-100' : 'opacity-0'}`}
                         style={{ transform: `scale(${1 + volume * 0.6})` }}
                    ></div>
                    
                    <button
                        onClick={isConnected ? onDisconnect : onConnect}
                        disabled={isConnecting}
                        className={`
                            relative z-20 w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300
                            shadow-[0_0_30px_rgba(0,0,0,0.6)] border-[3px]
                            ${isConnecting ? 'bg-slate-800 border-slate-600 cursor-wait' : ''}
                            ${!isConnected && !isConnecting ? 'bg-gradient-to-b from-slate-700 to-slate-900 border-slate-600 text-slate-300 hover:border-emerald-500/50 hover:text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]' : ''}
                            ${isConnected ? 'bg-gradient-to-b from-emerald-900/90 to-slate-900 border-emerald-500 text-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.3)] scale-105' : ''}
                        `}
                    >
                         {isConnecting ? (
                            <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                         ) : isConnected ? (
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 md:w-12 md:h-12 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
                                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                             </svg>
                         ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 md:w-12 md:h-12">
                                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                                <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.75 6.75 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.75 6.75 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                             </svg>
                         )}
                    </button>
                    
                    {/* Ring Pulse Animation (Idle) */}
                    {!isConnected && !isConnecting && (
                        <div className="absolute inset-0 rounded-full border border-white/10 animate-[ping_3s_infinite]"></div>
                    )}
                </div>
            </div>

            {/* Right Section: Toggles */}
            <div className="flex items-center justify-end gap-6 z-10 w-1/3">
                 {/* Camera Toggle */}
                 <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={onToggleCamera}
                        disabled={!isConnected}
                        className={`
                            w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-all duration-200 border-2
                            ${!isConnected ? 'opacity-30 border-slate-800 bg-slate-900 cursor-not-allowed' : 
                            isCameraOn ? 'bg-blue-500/20 border-blue-400 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'bg-slate-800/80 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500'
                            }
                        `}
                    >
                        {isCameraOn ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 md:w-7 md:h-7">
                                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 md:w-7 md:h-7">
                                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest hidden md:block">Vision</span>
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
