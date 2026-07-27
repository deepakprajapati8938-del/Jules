import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X, Zap } from 'lucide-react';
import { apiClient } from '../core/api-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const preprocessMath = (text: string) => {
  if (!text) return text;
  let processed = text.replace(/\$\$(.*?)\$\$/gs, '\n```math_block\n$1\n```\n');
  processed = processed.replace(/\$((?:\\.|[^$\n])*?)\$/g, '`math_inline $1`');
  return processed;
};

export default function GlobalAskJules() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Dragging state
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isOpen) return; // Don't drag when panel is open
    isDragging.current = true;
    hasDragged.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (!position) {
       setPosition({ x: rect.left, y: rect.top });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    hasDragged.current = true;
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    const maxX = window.innerWidth - 64; // approx orb width
    const maxY = window.innerHeight - 64;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleOrbClick = (e: React.MouseEvent) => {
    if (hasDragged.current) {
      e.preventDefault();
      return;
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setAnswer(null);
    try {
      const res = await apiClient.chat.quickLookup(query);
      setAnswer(res.answer);
    } catch (err) {
      console.error(err);
      setAnswer("Could not fetch the answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Panel (Fixed at bottom right, independent of drag position) */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-[calc(100vw-3rem)] md:w-[450px] glass-strong rounded-2xl border border-violet/30 shadow-glow-violet overflow-hidden origin-bottom flex flex-col max-w-full">
            <form onSubmit={handleSearch} className="p-3 border-b border-border-glass flex items-center gap-2 bg-surface">
              <Zap className="w-5 h-5 text-violet shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask Jules anything..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted min-w-0"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="p-1 hover:bg-surface-hover rounded-full text-secondary hover:text-foreground shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => { setIsOpen(false); setAnswer(null); setQuery(''); }} className="p-1 hover:bg-red-500/20 rounded-full text-secondary hover:text-red-400 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </form>

            {(isLoading || answer) && (
              <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-hide text-[15px] text-foreground/95 leading-relaxed">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-secondary py-6">
                    <div className="relative">
                      <Loader2 className="w-8 h-8 animate-spin text-violet/30" />
                      <Loader2 className="w-8 h-8 animate-spin text-violet absolute top-0 left-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                    </div>
                    <span className="font-medium animate-pulse text-sm tracking-wide uppercase">Searching NCERT...</span>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                        code: ({node, inline, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isMathBlock = match && match[1] === 'math_block';
                          const content = String(children).replace(/\n$/, '');
                          
                          if (isMathBlock) {
                            return (
                              <div 
                                className="overflow-x-auto py-2 my-2 text-center" 
                                dangerouslySetInnerHTML={{ __html: katex.renderToString(content, { displayMode: true, throwOnError: false }) }} 
                              />
                            );
                          }
                          
                          if (content.startsWith('math_inline ')) {
                            const math = content.replace('math_inline ', '');
                            return (
                              <span 
                                dangerouslySetInnerHTML={{ __html: katex.renderToString(math, { displayMode: false, throwOnError: false }) }} 
                              />
                            );
                          }
                          return <code className={`${className} bg-background/50 px-1.5 py-0.5 rounded text-sm`} {...props}>{children}</code>;
                        },
                      }}
                    >
                      {preprocessMath(answer || '')}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orb Button (Draggable) */}
      {!isOpen && (
        <div 
          className={`fixed z-[100] flex flex-col items-end ${!position ? 'bottom-6 right-6' : ''}`}
          style={position ? { left: position.x, top: position.y } : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <button 
            onClick={handleOrbClick}
            className="group relative w-14 h-14 rounded-full bg-surface-strong glass-strong border border-violet/30 flex items-center justify-center shadow-glow-violet hover:shadow-glow-violet-lg transition-all hover:scale-105 active:scale-95 animate-bounce-slow touch-none"
            aria-label="Ask Jules"
            style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
          >
            <div className="absolute inset-0 rounded-full bg-violet/20 animate-ping" style={{ animationDuration: '3s' }} />
            <Sparkles className="w-6 h-6 text-violet transition-transform group-hover:scale-110" />
          </button>
        </div>
      )}
    </>
  );
}
