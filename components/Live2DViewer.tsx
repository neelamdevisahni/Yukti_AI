
import React, { useEffect, useRef, useState } from 'react';
import { Expression } from '../types';

interface Live2DViewerProps {
  modelUrl: string;
  analyser: AnalyserNode | null;
  expression: Expression | null;
}

const Live2DViewer: React.FC<Live2DViewerProps> = ({ modelUrl, analyser, expression }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const PIXI = window.PIXI;
    const Live2DModel = PIXI?.live2d?.Live2DModel;

    if (!PIXI || !Live2DModel) {
      setError("PIXI or Live2D plugin not loaded. Please check your internet connection.");
      return;
    }

    // High Quality Rendering Settings
    const app = new PIXI.Application({
      view: canvasRef.current,
      autoStart: true,
      resizeTo: window,
      transparent: true,
      backgroundAlpha: 0,
      antialias: true,    // Smooth edges
      resolution: Math.max(window.devicePixelRatio, 2), // Force High DPI (Max quality)
      autoDensity: true,
      powerPreference: "high-performance"
    });
    appRef.current = app;

    let isMounted = true;

    (async () => {
      try {
        const model = await Live2DModel.from(modelUrl);
        
        if (!isMounted) {
            model.destroy();
            return;
        }

        modelRef.current = model;
        app.stage.addChild(model);
        
        resizeModel(model);
        
        model.interactive = true;
        model.buttonMode = true;
        model.autoInteract = false; 
        
        // Focus roughly on the face area
        model.focus(630, 330);
        
        model.on('pointertap', () => {
          try {
            model.motion('tap_body');
          } catch (e) {
          }
        });

        setLoaded(true);
      } catch (e: any) {
        if (isMounted) {
            console.error("Failed to load Live2D model:", e);
            setError("Failed to load Live2D model.");
        }
      }
    })();

    const resizeModel = (model: any) => {
        if (!model) return;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const isMobile = screenWidth < 768;

        model.scale.set(1);
        const rawWidth = model.width;
        const rawHeight = model.height;
        
        // Adjust padding based on device
        const padding = isMobile ? 0.05 : 0.1;

        // Calculate scale to fit screen comfortably
        const finalScaleX = (screenWidth * (1 - padding)) / rawWidth;
        const finalScaleY = (screenHeight * (1 - padding)) / rawHeight;
        
        // Use the smaller scale to ensure it fits, but on mobile maybe zoom in a bit more
        let scale = Math.min(finalScaleX, finalScaleY);
        if (isMobile) scale *= 1.1; // Slight zoom on mobile for better visibility
        
        model.scale.set(scale);
        
        // Horizontal Center
        model.x = (screenWidth - model.width) / 2;

        // Vertical Position
        if (isMobile) {
            // Mobile: Move UP significantly to avoid the bottom dock
            // Position bottom of model at 80% of screen height
            model.y = (screenHeight - model.height) * 0.4; 
        } else {
            // Desktop: Center roughly
            model.y = (screenHeight - model.height) / 2 + (screenHeight * 0.05); 
        }
    };

    const handleResize = () => {
       if (modelRef.current) {
           resizeModel(modelRef.current);
       }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (appRef.current) {
        appRef.current.destroy(false, { children: true });
        appRef.current = null;
      }
      modelRef.current = null;
    };
  }, [modelUrl]);

  useEffect(() => {
    if (loaded && modelRef.current && expression) {
        try {
            modelRef.current.expression(expression);
        } catch (e) {
            console.warn("Could not set expression:", e);
        }
    }
  }, [expression, loaded]);

  useEffect(() => {
    let animationFrameId: number;
    const dataArray = new Uint8Array(256);

    const animate = () => {
      if (analyser && modelRef.current && modelRef.current.internalModel) {
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        const binCount = dataArray.length;
        for (let i = 0; i < binCount; i++) {
            sum += dataArray[i];
        }
        const average = sum / binCount;
        
        const volume = Math.min(1, (average / 50)); 
        
        try {
            const core = modelRef.current.internalModel.coreModel;
            if (core.setParamFloat) {
                let paramIndex = core.getParamIndex('PARAM_MOUTH_OPEN_Y');
                if (paramIndex === -1) paramIndex = core.getParamIndex('PARAM_MOUTH_OPEN_Y');
                
                if (paramIndex !== -1) {
                    core.setParamFloat(paramIndex, volume, 0.8);
                }
            } 
            else if (core.setParameterValueById) {
                 core.setParameterValueById('ParamMouthOpenY', volume, 0.8);
            }
        } catch (e) {
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser, loaded]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
       {error && <div className="absolute top-20 text-red-400 bg-black/80 px-4 py-2 rounded pointer-events-auto z-50">{error}</div>}
       <canvas ref={canvasRef} className="pointer-events-auto block" />
    </div>
  );
};

export default Live2DViewer;
