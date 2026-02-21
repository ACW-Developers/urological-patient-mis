import { useState, useEffect } from 'react';
import uroLogo from '@/assets/uro-logo.png';

interface LoadingScreenProps {
  onFinished: () => void;
}

export function LoadingScreen({ onFinished }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setFadeOut(true);
          setTimeout(onFinished, 500);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [onFinished]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Animated Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center glow-primary animate-pulse">
          <img src={uroLogo} alt="Uro-Registry" className="w-16 h-16 object-contain rounded-xl bg-white/80 p-1" />
        </div>
        {/* Rings */}
        <div className="absolute inset-0 -m-3 rounded-3xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute inset-0 -m-6 rounded-3xl border border-primary/10 animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* Title */}
      <h1 className="font-display text-2xl font-bold text-foreground mb-2 animate-fade-in">
        Uro-Registry
      </h1>
      <p className="text-sm text-muted-foreground mb-8 animate-fade-in">
        Urological Patient Registry System
      </p>

      {/* Progress Bar */}
      <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: 'var(--gradient-primary)',
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {progress < 30 ? 'Initializing...' : progress < 60 ? 'Loading modules...' : progress < 90 ? 'Preparing workspace...' : 'Almost ready...'}
      </p>
    </div>
  );
}
