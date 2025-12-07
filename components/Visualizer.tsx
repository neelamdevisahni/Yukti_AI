import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      const centerX = canvas.width / 2;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 255;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        
        ctx.fillRect(centerX + x, canvas.height - barHeight, barWidth, barHeight);
        ctx.fillRect(centerX - x - barWidth, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
        if(x > centerX) break;
      }
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyser]);

  if (!analyser) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-32 pointer-events-none z-0 opacity-50">
        <canvas 
            ref={canvasRef} 
            width={window.innerWidth} 
            height={128} 
            className="w-full h-full"
        />
    </div>
  );
};

export default Visualizer;