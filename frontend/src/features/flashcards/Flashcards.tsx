import { useState } from 'react';
import { Layers, RotateCw, ThumbsUp, ThumbsDown, BookOpen } from 'lucide-react';

export default function Flashcards() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);

  const mockCards = [
    { question: "What is the primary function of mitochondria?", answer: "Cellular respiration (producing ATP)." },
    { question: "State Newton's First Law.", answer: "An object remains at rest or in uniform motion unless acted upon by a net external force." },
  ];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCard((prev) => (prev + 1) % mockCards.length);
  };

  return (
    <div className="flex-1 flex flex-col h-full p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Layers className="w-8 h-8 text-foreground" />
          <h2 className="text-2xl font-semibold text-foreground">Flashcards</h2>
        </div>
        <span className="text-sm font-medium text-secondary bg-surface-strong px-3 py-1 rounded-lg border border-border-glass">
          {currentCard + 1} / {mockCards.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        
        {/* Card Container */}
        <div 
          className="relative w-full aspect-[4/3] md:aspect-[16/9] perspective-1000 cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            
            {/* Front */}
            <div className="absolute inset-0 backface-hidden glass rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-glass-sm group-hover:shadow-glass transition-shadow">
              <span className="absolute top-6 left-6 text-xs font-semibold text-muted uppercase tracking-widest">Question</span>
              <p className="text-xl md:text-2xl text-foreground font-medium">
                {mockCards[currentCard].question}
              </p>
              <div className="absolute bottom-6 flex items-center gap-2 text-sm text-muted">
                <RotateCw className="w-4 h-4" /> Tap to flip
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-glass-sm bg-accent-tint border border-accent/15" style={{ backdropFilter: 'blur(14px)' }}>
              <span className="absolute top-6 left-6 text-xs font-semibold text-accent uppercase tracking-widest">Answer</span>
              <p className="text-xl md:text-2xl text-foreground">
                {mockCards[currentCard].answer}
              </p>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className={`mt-10 flex gap-4 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button onClick={handleNext} className="flex flex-col items-center gap-2 p-4 hover:bg-rose-400/10 rounded-2xl transition-colors min-w-[100px]">
            <div className="bg-rose-400/15 border border-rose-400/20 p-3 rounded-full"><ThumbsDown className="w-6 h-6 text-rose-400" /></div>
            <span className="text-sm font-medium text-rose-400">Hard</span>
          </button>
          <button onClick={handleNext} className="flex flex-col items-center gap-2 p-4 hover:bg-amber-400/10 rounded-2xl transition-colors min-w-[100px]">
            <div className="bg-amber-400/15 border border-amber-400/20 p-3 rounded-full"><BookOpen className="w-6 h-6 text-amber-400" /></div>
            <span className="text-sm font-medium text-amber-400">Okay</span>
          </button>
          <button onClick={handleNext} className="flex flex-col items-center gap-2 p-4 hover:bg-emerald-400/10 rounded-2xl transition-colors min-w-[100px]">
            <div className="bg-emerald-400/15 border border-emerald-400/20 p-3 rounded-full"><ThumbsUp className="w-6 h-6 text-emerald-400" /></div>
            <span className="text-sm font-medium text-emerald-400">Easy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
