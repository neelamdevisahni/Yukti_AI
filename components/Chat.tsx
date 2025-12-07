import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface ChatProps {
  messages: Message[];
}

const Chat: React.FC<ChatProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="absolute right-4 bottom-24 w-80 md:w-96 h-[50vh] z-30 flex flex-col rounded-xl overflow-hidden shadow-2xl border border-white/5 transition-all duration-300">
        
        <div className="bg-[#202c33] p-3 flex items-center gap-3 border-b border-[#2a3942]">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                Y
            </div>
            <div className="flex flex-col">
                <span className="text-white font-medium text-sm">Yukti</span>
                <span className="text-xs text-slate-400">Online</span>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative bg-[#0b141a]">
            <div 
                className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(#e9edef 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            ></div>

            {messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs text-center px-6 relative z-10">
                    <p>Start Conversation with Yukti.<br/>She will respond in real-time.</p>
                </div>
            )}

            {messages.map((msg, idx) => (
                <div 
                    key={idx} 
                    className={`flex flex-col max-w-[85%] relative z-10 ${
                        msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                    }`}
                >
                    <div 
                        className={`
                            px-3 py-1.5 rounded-lg text-sm shadow-sm break-words relative
                            ${msg.role === 'user' 
                                ? 'bg-[#005c4b] text-white rounded-tr-none' 
                                : 'bg-[#202c33] text-white rounded-tl-none'}
                        `}
                    >
                        {msg.text}
                        <span className="text-[9px] text-white/50 block text-right mt-1 -mb-0.5">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <div 
                            className={`absolute top-0 w-0 h-0 border-t-[8px] border-t-transparent
                            ${msg.role === 'user' 
                                ? '-right-2 border-l-[10px] border-l-[#005c4b]' 
                                : '-left-2 border-r-[10px] border-r-[#202c33]'}`}
                        ></div>
                    </div>
                </div>
            ))}
            <div ref={scrollRef} />
        </div>
    </div>
  );
};

export default Chat;
