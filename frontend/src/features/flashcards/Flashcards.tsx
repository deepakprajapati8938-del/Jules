import { useState, useEffect } from 'react';
import { Layers, RotateCw, ThumbsUp, ThumbsDown, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { FactOut } from '../../core/api-client';
import { vibrate } from '../../core/haptics';

export default function Flashcards() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [cards, setCards] = useState<FactOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.facts.getFlashcards()
      .then(res => {
        if (res && res.length > 0) {
          setCards(res);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(20);
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCard((prev) => (prev + 1) % cards.length);
    }, 200); // Wait for flip animation before changing content
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
        <p className="text-secondary font-medium tracking-wide">Drawing your deck...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-4">
        <div className="w-20 h-20 glass rounded-full flex items-center justify-center mb-6 shadow-glass-inset">
          <Layers className="w-8 h-8 text-secondary opacity-50" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">No flashcards yet</h3>
        <p className="text-secondary">Keep studying, your deck will build up automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-foreground" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Flashcards</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-bold tracking-widest text-secondary bg-surface-strong px-4 py-1.5 rounded-full border border-border-glass shadow-sm">
            {currentCard + 1} / {cards.length}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        
        {/* Card Container */}
        <div 
          className="relative w-full aspect-[3/4] sm:aspect-[4/3] md:aspect-[16/9] perspective-1000 cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`w-full h-full transition-all duration-700 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* Front */}
            <div className="absolute inset-0 backface-hidden glass rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-glass-sm group-hover:shadow-glass group-hover:-translate-y-1 transition-all duration-300">
              <div className="absolute inset-0 rounded-[2rem] opacity-20 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              
              <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-bold text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                Topic
              </span>
              
              <div className="relative z-10 bg-surface-strong px-5 py-2 sm:py-2.5 rounded-full border border-border-glass inline-block mb-4 sm:mb-6 shadow-glow-sm">
                <p className="text-xs sm:text-sm text-accent font-semibold tracking-widest uppercase">{cards[currentCard].subject}</p>
              </div>
              
              <h3 className="text-2xl sm:text-3xl md:text-4xl text-foreground font-bold tracking-tight px-2 sm:px-4 leading-tight">
                {cards[currentCard].chapter_name}
              </h3>
              
              <div className="absolute bottom-6 sm:bottom-8 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full glass border border-border-glass flex items-center justify-center animate-bounce shadow-sm">
                  <RotateCw className="w-5 h-5 text-secondary" />
                </div>
                <span className="text-[10px] font-bold text-secondary tracking-[0.2em] uppercase">Tap to reveal</span>
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-[0_0_40px_rgba(255,138,61,0.15)] bg-surface border border-accent/20 overflow-hidden">
              <div className="absolute inset-0 bg-accent-gradient opacity-[0.03] pointer-events-none" />
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/20 rounded-full blur-[80px] pointer-events-none" />
              
              <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-bold text-accent uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> Fact
              </span>
              
              <p className="relative z-10 text-lg sm:text-2xl md:text-3xl text-foreground font-medium leading-relaxed px-2 sm:px-4">
                {cards[currentCard].fact_text}
              </p>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className={`mt-8 sm:mt-12 flex justify-center gap-4 sm:gap-8 transition-all duration-500 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button onClick={handleNext} className="group flex flex-col items-center gap-3 p-2 sm:p-4 min-w-[80px] sm:min-w-[100px] active-scale">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full glass border border-border-glass flex items-center justify-center group-hover:bg-rose-500/10 group-hover:border-rose-500/30 transition-all shadow-sm">
              <ThumbsDown className="w-6 h-6 sm:w-7 sm:h-7 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-secondary uppercase tracking-[0.2em] group-hover:text-rose-400 transition-colors">Hard</span>
          </button>
          
          <button onClick={handleNext} className="group flex flex-col items-center gap-3 p-2 sm:p-4 min-w-[80px] sm:min-w-[100px] active-scale">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full glass border border-border-glass flex items-center justify-center group-hover:bg-amber-400/10 group-hover:border-amber-400/30 transition-all shadow-sm">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-secondary uppercase tracking-[0.2em] group-hover:text-amber-400 transition-colors">Okay</span>
          </button>
          
          <button onClick={handleNext} className="group flex flex-col items-center gap-3 p-2 sm:p-4 min-w-[80px] sm:min-w-[100px] active-scale">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full glass border border-border-glass flex items-center justify-center group-hover:bg-emerald-400/10 group-hover:border-emerald-400/30 transition-all shadow-[0_0_16px_rgba(52,211,153,0)] group-hover:shadow-[0_0_16px_rgba(52,211,153,0.2)]">
              <ThumbsUp className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-secondary uppercase tracking-[0.2em] group-hover:text-emerald-400 transition-colors">Easy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
