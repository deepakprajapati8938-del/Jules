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

  useEffect(() => {
    // Start fading out at 3 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 3000);

    // Complete the splash screen at 3.5 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
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
    </div>
  );
}
