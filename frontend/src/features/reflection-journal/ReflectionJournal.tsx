import { useState } from 'react';
import { Smile, Meh, Frown, Sparkles } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { ValidMood } from '../../core/api-client';

const MOODS = [
  { value: 'great', label: 'Great', icon: Sparkles, color: 'text-amber-400' },
  { value: 'good', label: 'Good', icon: Smile, color: 'text-blue-400' },
  { value: 'neutral', label: 'Neutral', icon: Meh, color: 'text-secondary' },
  { value: 'low', label: 'Low', icon: Frown, color: 'text-violet' },
];

export default function ReflectionJournal() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await apiClient.journal.upsert(selectedMood as ValidMood, reflection);
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      // fallback handling here
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-accent-tint border border-accent/20 flex items-center justify-center mb-2 shadow-glow-accent">
          <Sparkles className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-2xl font-light text-foreground">Entry saved.</h2>
        <p className="text-secondary">Take a deep breath. You did well today.</p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="mt-8 text-accent hover:text-accent-hover text-sm font-medium transition-colors"
        >
          View past entries
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-2xl font-semibold text-foreground mb-2">Evening Reflection</h2>
      <p className="text-secondary mb-8">Take a moment to close out the day.</p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            How did today feel?
          </label>
          <div className="grid grid-cols-4 gap-3">
            {MOODS.map((mood) => {
              const Icon = mood.icon;
              const isSelected = selectedMood === mood.value;
              return (
                <button
                  key={mood.value}
                  type="button"
                  onClick={() => setSelectedMood(mood.value)}
                  className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl border transition-all ${
                    isSelected 
                      ? 'border-accent/30 bg-accent-tint shadow-glow-accent-sm' 
                      : 'glass hover:bg-surface-hover'
                  }`}
                >
                  <Icon className={`w-8 h-8 mb-2 ${isSelected ? mood.color : 'text-muted'}`} />
                  <span className={`text-xs font-medium ${isSelected ? 'text-foreground' : 'text-secondary'}`}>
                    {mood.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <label htmlFor="reflection" className="block text-sm font-medium text-foreground">
            One small thing you're proud of today
          </label>
          <textarea
            id="reflection"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="e.g., I finally understood the concept of meiosis..."
            className="w-full glass-input p-4 text-sm resize-none min-h-[100px]"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedMood || isSubmitting}
          className="btn-accent w-full py-3.5"
        >
          {isSubmitting ? 'Saving...' : 'Save Entry'}
        </button>
      </form>
    </div>
  );
}
