
import React, { useState, useCallback, useRef } from 'react';
import Live2DViewer from './components/Live2DViewer';
import ControlPanel from './components/ControlPanel';
import { useGeminiLive } from './hooks/useGeminiLive';
import { Expression } from './types';

const MODEL_URL = 'https://raw.githubusercontent.com/neelamdevisahni/Yukti/refs/heads/main/shizuku/shizuku.model.json';

const App: React.FC = () => {
  const [currentExpression, setCurrentExpression] = useState<Expression | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleSetExpression = useCallback((exp: Expression) => {
      setCurrentExpression(exp);
  }, []);

  const handleTranscript = useCallback((text: string, role: 'user' | 'assistant') => {
      console.log(`[${role}] ${text}`);
  }, []);

  const { isConnected, isConnecting, connect, disconnect, analyser, inputAnalyser, error, isCameraOn, toggleCamera } = useGeminiLive({
      onSetExpression: handleSetExpression,
      onTranscript: handleTranscript,
      videoRef
  });
  
  return (
    <div className="relative w-full h-screen bg-[#050b14] overflow-hidden flex flex-col items-center justify-center font-sans">
        
        {/* Background - Enhanced Sci-Fi aesthetic */}
        <div className="absolute inset-0 pointer-events-none">
            {/* Deep Dark Base */}
            <div className="absolute inset-0 bg-[#02040a]"></div>
            
            {/* Radial Gradients for Depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-[#050b14] to-[#020617]"></div>
            
            {/* Cyber Grid */}
            <div className="absolute inset-0 opacity-[0.05]" 
                 style={{ 
                   backgroundImage: `
                     linear-gradient(to right, #4f46e5 1px, transparent 1px),
                     linear-gradient(to bottom, #4f46e5 1px, transparent 1px)
                   `, 
                   backgroundSize: '50px 50px',
                   maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)'
                 }}>
            </div>

            {/* Glowing Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-500/10 rounded-full blur-[100px] mix-blend-screen"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-blue-600/10 rounded-full blur-[100px] mix-blend-screen"></div>
            
            {/* HUD Central Circles */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70vh] h-[70vh] rounded-full border border-white/5 opacity-40"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[50vh] h-[50vh] rounded-full border border-dashed border-white/10 opacity-30 animate-[spin_60s_linear_infinite]"></div>
        </div>

        {/* Main Avatar Viewer (Z-Index 10: Behind UI) */}
        <div className="absolute inset-0 z-10">
            <Live2DViewer 
                modelUrl={MODEL_URL} 
                analyser={analyser} 
                expression={currentExpression}
            />
        </div>

        {/* User Video Feed (Picture in Picture) 
            Desktop: Bottom Right
            Mobile: Top Right (To avoid bottom dock overlap)
        */}
        <div className={`
            absolute z-40 transition-all duration-500 ease-in-out
            top-20 right-4 md:top-auto md:bottom-32 md:right-8 
            ${isCameraOn ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}
        `}>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 w-32 h-24 md:w-64 md:h-48 bg-black/80 backdrop-blur-md ring-1 ring-white/10">
                <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover transform scale-x-[-1]" 
                />
                
                {/* Recording Indicator */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-[8px] md:text-[10px] font-bold text-white/90 uppercase tracking-wider">Rec</span>
                </div>
                
                {/* Tech Corners */}
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-blue-400/50 rounded-br-sm"></div>
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-blue-400/50 rounded-tl-sm"></div>
            </div>
        </div>

        {/* Top Header / HUD */}
        <div className="fixed top-0 left-0 w-full px-6 py-4 flex justify-between items-center z-40 pointer-events-none bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-3">
                 <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
                    <span className="text-white font-bold text-lg">Y</span>
                 </div>
                 <div className="flex flex-col">
                    <h1 className="text-white font-bold tracking-wider text-xs md:text-sm drop-shadow-md">YUKTI</h1>
                    <span className="text-[10px] text-indigo-300 tracking-widest uppercase font-medium">Online</span>
                 </div>
            </div>
            
            {/* Visualizer Placeholder / Decor */}
            <div className="flex items-center gap-1 opacity-60">
                <div className="w-1 h-3 bg-emerald-400/80 rounded-full animate-pulse"></div>
                <div className="w-1 h-5 bg-emerald-400/60 rounded-full animate-pulse delay-75"></div>
                <div className="w-1 h-2 bg-emerald-400/80 rounded-full animate-pulse delay-150"></div>
            </div>
        </div>

        {/* Control Panel (Dock) */}
        <ControlPanel 
            isConnected={isConnected}
            isConnecting={isConnecting}
            onConnect={connect}
            onDisconnect={disconnect}
            isCameraOn={isCameraOn}
            onToggleCamera={toggleCamera}
            analyser={inputAnalyser}
        />

        {/* Error Notification */}
        {error && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500/10 backdrop-blur-xl border border-red-500/40 text-red-100 px-6 py-3 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.3)] z-50 flex items-center gap-3 animate-slide-down">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="font-medium text-xs md:text-sm">{error}</p>
            </div>
        )}
    </div>
  );
};

export default App;
