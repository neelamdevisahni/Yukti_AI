import React from 'react';

const SciFiBackground: React.FC = () => {
  return (
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
  );
};

export default SciFiBackground;