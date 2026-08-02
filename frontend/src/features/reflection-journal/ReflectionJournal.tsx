import { useState, useEffect } from 'react';
import { Smile, Meh, Frown, Sparkles, RefreshCw, Calendar, TrendingUp, BookOpen, Loader2 } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { ValidMood, JournalEntry, JournalSummary } from '../../core/api-client';

const MOODS = [
  { value: 'great', label: 'Great', icon: Sparkles, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
  { value: 'good', label: 'Good', icon: Smile, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  { value: 'neutral', label: 'Neutral', icon: Meh, color: 'text-secondary', bg: 'bg-surface border-border-glass' },
  { value: 'low', label: 'Low', icon: Frown, color: 'text-violet', bg: 'bg-violet/10 border-violet/20' },
];

const PROMPTS = [
  "One small win or thing you're proud of today",
  "What was a concept or topic that finally clicked for you today?",
  "What helped you stay focused or calm during your study sessions?",
  "What is one thing you handled better today than in the past?",
  "What is a gentle intention or focus for tomorrow?",
];

export default function ReflectionJournal() {
  const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [reflection, setReflection] = useState('');
  const [promptIndex, setPromptIndex] = useState(() => new Date().getDate() % PROMPTS.length);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History & Summary State
  const [history, setHistory] = useState<JournalEntry[]>([]);
  const [summary, setSummary] = useState<JournalSummary | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistoryAndSummary = async () => {
    setIsLoadingHistory(true);
    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        apiClient.journal.list(),
        apiClient.journal.summary('weekly')
      ]);

      if (listRes.status === 'fulfilled') setHistory(listRes.value || []);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value || null);
    } catch (err) {
      console.error('Failed to load journal history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryAndSummary();
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMood || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await apiClient.journal.upsert(selectedMood as ValidMood, reflection);
      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cyclePrompt = () => {
    setPromptIndex((prev) => (prev + 1) % PROMPTS.length);
  };

  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-2xl mx-auto w-full">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Reflection Journal</h2>
          <p className="text-secondary text-sm">Close out your day and track your growth mindset.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface border border-border-glass p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'today'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-accent text-white shadow-sm'
                : 'text-secondary hover:text-foreground'
            }`}
          >
            Insights & History
          </button>
        </div>
      </div>

      {activeTab === 'today' ? (
        isSubmitted ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 p-6 text-center space-y-4 glass rounded-3xl border border-border-glass">
            <div className="w-16 h-16 rounded-full bg-accent-tint border border-accent/20 flex items-center justify-center mb-2 shadow-glow-accent">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-light text-foreground">Entry Saved.</h2>
            <p className="text-secondary max-w-sm">Take a deep breath. You did well today. Your reflections build your long-term growth.</p>
            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setIsSubmitted(false)}
                className="px-4 py-2 text-xs font-medium text-secondary hover:text-foreground border border-border-glass rounded-xl hover:bg-surface transition-colors"
              >
                Edit Today's Entry
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className="btn-accent px-5 py-2 text-xs rounded-xl flex items-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5" /> View Past Insights
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Mood Picker */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">
                How did today feel overall?
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
                          ? 'border-accent/40 bg-accent-tint shadow-glow-accent-sm scale-[1.02]' 
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

            {/* Rotating Daily Prompt */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="reflection" className="block text-sm font-medium text-foreground">
                  {PROMPTS[promptIndex]}
                </label>
                <button
                  type="button"
                  onClick={cyclePrompt}
                  className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors font-medium"
                  title="Change prompt"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Shuffle Prompt</span>
                </button>
              </div>
              <textarea
                id="reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Write a few lines here..."
                className="w-full glass-input p-4 text-sm resize-none min-h-[120px] focus:border-accent/40"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedMood || isSubmitting}
              className="btn-accent w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                'Save Entry'
              )}
            </button>
          </form>
        )
      ) : (
        /* History & Weekly Insights Tab */
        <div className="space-y-6">
          {isLoadingHistory ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-secondary text-xs">Gathering your reflection history...</p>
            </div>
          ) : (
            <>
              {/* Weekly Growth Summary Card */}
              <div className="glass p-6 rounded-3xl border border-border-glass relative overflow-hidden space-y-3">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" /> Weekly Growth Insights
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {summary?.summary_text || (
                    history.length > 0 
                      ? "Keep reflecting daily! An AI summary of your growth and mindset will generate at the end of each week."
                      : "No reflection entries logged yet. Complete your first reflection to start building insights."
                  )}
                </p>
              </div>

              {/* Past Reflections List */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-secondary" /> Recent Entries
                </h3>

                {history.length === 0 ? (
                  <div className="p-8 text-center glass rounded-2xl border border-border-glass text-secondary text-xs">
                    You haven't written any reflections yet. Head back to "Today" to record your first entry!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => {
                      const moodObj = MOODS.find(m => m.value === entry.mood) || MOODS[2];
                      const Icon = moodObj.icon;
                      return (
                        <div key={entry.entry_date} className="glass p-4 rounded-2xl border border-border-glass space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-medium text-secondary">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(entry.entry_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${moodObj.bg} ${moodObj.color}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {moodObj.label}
                            </span>
                          </div>
                          {entry.one_line_reflection && (
                            <p className="text-sm text-foreground/90 pl-1 italic">
                              "{entry.one_line_reflection}"
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
