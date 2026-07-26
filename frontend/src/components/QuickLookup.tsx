import { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X, Zap } from 'lucide-react';
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

export default function QuickLookup() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-surface-strong border border-border-glass hover:bg-surface-hover hover:border-accent/30 transition-all text-secondary group shadow-glass-sm"
        title="Quick Lookup (Formulas, Facts)"
      >
        <Search className="w-4 h-4 md:w-5 md:h-5 group-hover:text-accent transition-colors" />
        <span className="text-xs md:text-sm font-medium whitespace-nowrap hidden sm:inline">Quick Lookup...</span>
      </button>
    );
  }

  return (
    <div className="absolute top-full right-4 md:right-8 mt-2 w-[calc(100vw-2rem)] md:w-[450px] glass-strong rounded-2xl border border-accent/20 shadow-glow-accent-sm overflow-hidden z-[100] animate-fade-in-up origin-top flex flex-col max-w-full">
      <form onSubmit={handleSearch} className="p-3 border-b border-border-glass flex items-center gap-2 bg-surface">
        <Zap className="w-5 h-5 text-accent shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type formula or concept..."
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
        <div className="p-5 max-h-80 overflow-y-auto scrollbar-hide text-[15px] text-foreground/95 leading-relaxed bg-surface-strong/80 backdrop-blur-md">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-secondary py-6">
              <div className="relative">
                <Loader2 className="w-8 h-8 animate-spin text-accent/30" />
                <Loader2 className="w-8 h-8 animate-spin text-accent absolute top-0 left-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
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
  );
}
