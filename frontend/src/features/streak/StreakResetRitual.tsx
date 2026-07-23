import { useState } from 'react';
import { Droplet, Smile, Wind, BookOpen, Activity } from 'lucide-react';
import { apiClient } from '../../core/api-client';

interface StreakResetRitualProps {
  onComplete: () => void;
}

const ACTIONS = [
  { id: 'water', label: 'Drink a glass of water', icon: Droplet },
  { id: 'stretch', label: 'Do a quick stretch', icon: Activity },
  { id: 'smile', label: 'Smile for 10 seconds', icon: Smile },
  { id: 'breathe', label: 'Take 3 deep breaths', icon: Wind },
  { id: 'read', label: 'Read one page of NCERT', icon: BookOpen },
];

export default function StreakResetRitual({ onComplete }: StreakResetRitualProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDone = async () => {
    if (!selectedAction) return;
    setIsLoading(true);
    try {
      await apiClient.streak.completeRitual();
      onComplete();
    } catch (e) {
      console.error(e);
      onComplete();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-[100] flex flex-col items-center justify-center p-6 text-center">
      {/* Ambient glow */}
      <div className="absolute w-[350px] h-[350px] bg-accent/8 rounded-full blur-[80px] bottom-0 left-1/2 -translate-x-1/2" />

      <div className="max-w-sm w-full space-y-8 relative z-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-light text-foreground">Welcome back.</h1>
          <p className="text-secondary">
            Let's ease back into it. Pick one tiny action to start your session right now.
          </p>
        </div>

        <div className="space-y-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const isSelected = selectedAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => setSelectedAction(action.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'border-accent/30 bg-accent-tint shadow-glow-accent-sm' 
                    : 'glass hover:bg-surface-hover'
                }`}
              >
                <div className={`p-2 rounded-xl transition-colors ${
                  isSelected ? 'bg-accent/15 text-accent' : 'bg-surface-strong text-secondary'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`font-medium text-left ${isSelected ? 'text-foreground' : 'text-secondary'}`}>
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleDone}
          disabled={!selectedAction || isLoading}
          className="btn-accent w-full py-3.5"
        >
          {isLoading ? '...' : "I've done this"}
        </button>
      </div>
    </div>
  );
}
