import { useEffect, useState, useRef } from 'react';
import { Sparkles } from 'lucide-react';

interface InteractiveWidgetProps {
  html: string;
}

export default function InteractiveWidget({ html }: InteractiveWidgetProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setStatus('loading');

    const timeoutId = setTimeout(() => {
      setStatus((prev) => {
        if (prev === 'loading') {
          console.warn('InteractiveWidget: Timed out waiting for widget-ready signal, assuming ready.');
          return 'ready'; // Assume ready instead of erroring out to avoid hiding a working widget
        }
        return prev;
      });
    }, 4000);

    const handleMessage = (e: MessageEvent) => {
      // Using contentWindow to verify source, but if iframe is sandboxed with just 'allow-scripts'
      // it might not expose contentWindow safely across origins. We can just check the type.
      if (e.data?.type === 'widget-ready') {
        setStatus('ready');
      } else if (e.data?.type === 'widget-error') {
        console.error('InteractiveWidget Error:', e.data.message);
        setStatus('error');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };
  }, [html]);

  if (status === 'error') {
    return (
      <div className="mt-6 w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
        Widget failed to load or timed out. (Check browser console for details).
      </div>
    );
  }

  return (
    <div className={`mt-6 w-full rounded-2xl overflow-hidden shadow-glass-lg transition-all duration-500 min-h-[550px] relative ${
      status === 'loading'
        ? 'border-2 border-transparent bg-surface animate-pulse'
        : 'border border-violet/30 bg-surface'
    }`}
    style={status === 'loading' ? {
      borderImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #8b5cf6) 1',
      animation: 'pulse 2s ease-in-out infinite',
    } : undefined}
    >
      {/* Premium Header Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-glass bg-surface-strong/80 backdrop-blur-md">
        <Sparkles className="w-4 h-4 text-violet" />
        <span className="text-xs font-bold uppercase tracking-wider text-violet">Interactive Visual</span>
        {status === 'loading' && (
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet animate-ping" />
            <span className="text-[10px] text-muted font-medium">Rendering...</span>
          </div>
        )}
      </div>

      {/* Loading Shimmer */}
      {status === 'loading' && (
        <div className="absolute inset-0 top-10 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-violet/40 border-t-violet animate-spin" />
            <span className="text-xs text-muted font-medium tracking-wide">Loading interactive content...</span>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Interactive Widget"
        className="w-full h-[550px] border-none"
        style={{ pointerEvents: 'auto', backgroundColor: '#08090c' }}
      />
    </div>
  );
}
