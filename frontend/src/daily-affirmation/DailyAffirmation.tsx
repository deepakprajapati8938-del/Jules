import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AFFIRMATIONS = [
  "You are capable of mastering this material.",
  "Every small step brings you closer to your goal.",
  "Your dedication today will pay off tomorrow.",
  "Take it one concept at a time.",
  "You have what it takes to succeed.",
];

export default function DailyAffirmation() {
  const [affirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background relative overflow-hidden p-6">
      {/* Ambient glow orbs */}
      <div className="absolute w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] -bottom-20 -left-20" />
      <div className="absolute w-[300px] h-[300px] bg-violet/8 rounded-full blur-[80px] -top-10 -right-10" />
      
      <div className="z-10 text-center max-w-sm space-y-8">
        {/* Gradient orb */}
        <div className="w-16 h-16 gradient-orb mx-auto shadow-glow-accent opacity-80" />

        <h1 className="text-3xl font-light text-foreground/90 tracking-tight leading-snug">
          {affirmation}
        </h1>
        
        <button 
          onClick={() => navigate('/chat', { replace: true })}
          className="btn-accent px-8 py-3"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
