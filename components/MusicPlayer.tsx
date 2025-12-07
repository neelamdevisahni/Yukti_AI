import React, { useState } from 'react';

interface MusicPlayerProps {
  query: string | null;
  onClose: () => void;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ query, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!query) return null;

  const src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`;

  return (
    <div className={`fixed z-40 transition-all duration-300 ease-in-out shadow-2xl rounded-xl overflow-hidden bg-black border border-slate-700 ${
      isMinimized 
        ? 'bottom-24 right-4 w-64 h-16 flex items-center justify-between px-4' 
        : 'bottom-24 right-4 w-80 h-48 sm:w-96 sm:h-64'
    }`}>
      
      {isMinimized && (
        <>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium truncate max-w-[120px]">
              {query}
            </span>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={() => setIsMinimized(false)}
                className="text-slate-400 hover:text-white p-1"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
             </button>
             <button onClick={onClose} className="text-slate-400 hover:text-red-400 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
             </button>
          </div>
        </>
      )}

      {!isMinimized && (
        <div className="relative w-full h-full">
            <div className="absolute top-0 right-0 z-10 p-2 flex gap-2 bg-gradient-to-b from-black/80 to-transparent w-full justify-end">
                <button 
                  onClick={() => setIsMinimized(true)} 
                  className="text-white hover:text-blue-400 transition-colors bg-black/40 rounded-full p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <button 
                  onClick={onClose} 
                  className="text-white hover:text-red-500 transition-colors bg-black/40 rounded-full p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
            </div>
            <iframe 
                width="100%" 
                height="100%" 
                src={src} 
                title="YouTube music player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
            ></iframe>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;