import { useState, useEffect } from 'react';
import { Target, Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient, type QuickMCQResponse } from '../../core/api-client';

export default function QuickMCQWidget() {
  const [mcq, setMcq] = useState<QuickMCQResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const MAX_PER_SESSION = 3;

  const fetchMCQ = async () => {
    setLoading(true);
    setError(false);
    setSelectedIdx(null);
    try {
      const data = await apiClient.dashboard.getQuickMCQ();
      setMcq(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMCQ();
  }, []);

  if (error) {
    return (
      <div className="mb-8 glass rounded-2xl p-5 shadow-glass-sm border border-red-500/20 text-center">
        <p className="text-secondary mb-3">Failed to load quick MCQ.</p>
        <button onClick={fetchMCQ} className="btn-secondary px-4 py-2 text-sm">Try Again</button>
      </div>
    );
  }

  return (
    <div className="mb-8 glass rounded-2xl p-6 shadow-glass-sm border-t-2 border-t-violet relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <Target className="w-16 h-16 text-violet" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-violet" />
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">One Quick MCQ</h3>
          </div>
          {(!loading && selectedIdx !== null) && (
            solvedCount < MAX_PER_SESSION ? (
              <button onClick={fetchMCQ} className="text-xs flex items-center gap-1 text-secondary hover:text-foreground transition-colors bg-surface-strong px-3 py-1.5 rounded-lg border border-border-glass">
                <RefreshCw className="w-3.5 h-3.5" /> Next Question
              </button>
            ) : (
              <div className="text-xs text-emerald-400 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                🎉 3/3 Done! Rest now.
              </div>
            )
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-violet animate-spin mb-3" />
            <p className="text-sm text-secondary animate-pulse">Generating a challenging question...</p>
          </div>
        ) : mcq ? (
          <div className="animate-fade-in">
            <p className="text-foreground font-medium md:text-lg mb-5 leading-relaxed">
              {mcq.question}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {mcq.options.map((opt, idx) => {
                const isSelected = selectedIdx === idx;
                const isCorrect = mcq.correct_answer_index === idx;
                const showResult = selectedIdx !== null;
                
                let btnClass = "text-left px-4 py-3 rounded-xl border transition-all duration-200 text-sm md:text-base font-medium ";
                
                if (!showResult) {
                  btnClass += "glass-strong hover:bg-surface-hover border-border-glass text-foreground/90 hover:border-violet/50 hover:shadow-glow-violet-sm";
                } else {
                  if (isCorrect) {
                    btnClass += "bg-emerald-500/20 border-emerald-500/50 text-emerald-100 shadow-glow-emerald-sm";
                  } else if (isSelected && !isCorrect) {
                    btnClass += "bg-red-500/20 border-red-500/50 text-red-100";
                  } else {
                    btnClass += "glass opacity-50 border-border-glass text-secondary";
                  }
                }

                return (
                  <button 
                    key={idx}
                    onClick={() => {
                      if (!showResult) {
                        setSelectedIdx(idx);
                        setSolvedCount(prev => prev + 1);
                      }
                    }}
                    disabled={showResult}
                    className={btnClass}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 font-bold opacity-70">
                        {String.fromCharCode(65 + idx)}.
                      </div>
                      <div className="flex-1">
                        {opt}
                      </div>
                      {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                      {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
            
            {selectedIdx !== null && (
              <div className={`p-4 rounded-xl text-sm border animate-fade-in-up ${
                selectedIdx === mcq.correct_answer_index 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-50' 
                  : 'bg-accent/10 border-accent/20 text-accent-light'
              }`}>
                <span className="font-bold mb-1 block">
                  {selectedIdx === mcq.correct_answer_index ? 'Correct! 🎉' : 'Not quite right.'}
                </span>
                {mcq.explanation}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
