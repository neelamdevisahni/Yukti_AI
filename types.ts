
export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export type Expression = 
  | 'angry' 
  | 'confused' 
  | 'embarrassed' 
  | 'neutral' 
  | 'sleepy' 
  | 'sad' 
  | 'surprised' 
  | 'worried' 
  | 'smile';

export interface Live2DModelConfig {
  url: string;
  x: number;
  y: number;
  scale: number;
}

// Extend Window to include PIXI, Live2D, and AI Studio global types
declare global {
  interface Window {
    PIXI: any;
    Live2D: any;
    // aistudio is already defined in the global environment
  }
}
