import { useState, useEffect } from 'react';

const AFFIRMATIONS = [
  "You are capable of mastering this material.",
  "Every small step brings you closer to your goal.",
  "Your dedication today will pay off tomorrow.",
  "Take it one concept at a time.",
  "You have what it takes to succeed.",
  "Small daily improvements are the key to staggering long-term results.",
  "Progress over perfection."
];

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [affirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Waking up Jules...');

  useEffect(() => {
    // Start fading out at 3 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 3000);

    // Complete the splash screen at 3.5 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    // Progress bar animation (100 steps * 30ms = 3000ms)
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        const next = prev + 1;
        if (next === 30) setStatusText('Syncing study streaks...');
        if (next === 70) setStatusText('Preparing your dashboard...');
        if (next === 95) setStatusText('Ready to go!');
        return next;
      });
    }, 30);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#08090c] transition-opacity duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Ambient glow orbs */}
      <div className="absolute w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] -bottom-32 -left-20 animate-ambient-breath mix-blend-screen" />
      <div className="absolute w-[400px] h-[400px] bg-violet/10 rounded-full blur-[100px] -top-20 -right-20 animate-ambient-breath-slow mix-blend-screen" />
      
      <div className="z-10 flex flex-col items-center max-w-sm px-6 text-center space-y-16">
        {/* Jules Logo */}
        <div className="relative flex flex-col items-center animate-pulse-slow">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-accent to-violet blur-2xl opacity-30 animate-pulse-slow"></div>
            <img 
              src="/pwa-512x512.png" 
              alt="Jules Logo" 
              className="relative z-10 w-32 h-32 rounded-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] object-contain" 
            />
          </div>
          <h1 className="mt-8 text-3xl font-light tracking-[0.3em] text-white/95 uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">Jules</h1>
        </div>

        {/* The Quote */}
        <p className="text-xl font-light text-foreground/80 tracking-wide leading-relaxed italic drop-shadow-sm px-4">
          "{affirmation}"
        </p>
      </div>

      {/* Dynamic Progress Indicator */}
      <div className="absolute bottom-12 w-64 flex flex-col items-center gap-3 z-10 transition-opacity duration-500">
        <p className="text-[11px] text-secondary uppercase tracking-[0.2em] font-semibold animate-pulse">
          {statusText}
        </p>
        <div className="w-full bg-surface-strong rounded-full h-1 border border-border-glass overflow-hidden shadow-glass-inset">
          <div 
            className="bg-accent h-full rounded-full transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(255,138,61,0.5)]" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
