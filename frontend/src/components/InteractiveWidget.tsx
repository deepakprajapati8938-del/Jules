import { useEffect, useState, useRef, useMemo } from 'react';
import { Sparkles, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';

interface InteractiveWidgetProps {
  html: string;
}

export default function InteractiveWidget({ html }: InteractiveWidgetProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragData = useRef({ isDragging: false, startY: 0, startHeight: 0 });

  // Inject ResizeObserver
  const injectedHtml = useMemo(() => {
    const resizeScript = `
      <script>
        const sendHeight = () => {
          const height = document.documentElement.scrollHeight;
          window.parent.postMessage({ type: 'widget-resize', height }, '*');
        };
        window.addEventListener('load', sendHeight);
        if (window.ResizeObserver) {
          new ResizeObserver(sendHeight).observe(document.body);
        } else {
          setTimeout(sendHeight, 1000);
        }
      </script>
    `;
    return html.includes('</body>') 
      ? html.replace(/<\/body>/i, `${resizeScript}</body>`)
      : html + resizeScript;
  }, [html]);

  useEffect(() => {
    setStatus('loading');

    const timeoutId = setTimeout(() => {
      setStatus((prev) => {
        if (prev === 'loading') {
          console.warn('InteractiveWidget: Timed out waiting for widget-ready signal, assuming ready.');
          return 'ready';
        }
        return prev;
      });
    }, 4000);

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'widget-ready') {
        setStatus('ready');
      } else if (e.data?.type === 'widget-error') {
        console.error('InteractiveWidget Error:', e.data.message);
        setStatus('error');
      } else if (e.data?.type === 'widget-resize' && e.data?.height) {
        setIframeHeight(e.data.height);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
    };
  }, [html]);

  // Drag to resize logic
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragData.current.isDragging) return;
      const delta = e.clientY - dragData.current.startY;
      setManualHeight(Math.max(300, dragData.current.startHeight + delta)); // Never less than 300px
    };
    
    const handleUp = () => {
      if (dragData.current.isDragging) {
        dragData.current.isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isExpanded) return;
    dragData.current.isDragging = true;
    dragData.current.startY = e.clientY;
    dragData.current.startHeight = containerRef.current?.getBoundingClientRect().height || 500;
    document.body.style.cursor = 'ns-resize'; 
    document.body.style.userSelect = 'none';
  };

  if (status === 'error') {
    return (
      <div className="mt-6 w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
        Widget failed to load or timed out. (Check browser console for details).
      </div>
    );
  }

  const calculatedHeight = iframeHeight ? Math.min(Math.max(iframeHeight, 450), 900) : 500;
  const finalHeight = manualHeight !== null ? manualHeight : calculatedHeight;

  return (
    <>
      {isExpanded && <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm" />}
      <div 
        ref={containerRef}
        className={`mt-6 overflow-hidden rounded-2xl shadow-glass-lg transition-all duration-300 flex flex-col ${
          isExpanded ? 'fixed inset-4 sm:inset-10 xl:inset-20 z-[101] shadow-2xl' : 'relative w-full'
        } ${
          status === 'loading'
            ? 'border-2 border-transparent bg-surface animate-pulse'
            : 'border border-violet/30 bg-surface'
        }`}
        style={!isExpanded ? {
          height: `${finalHeight}px`,
          ...(status === 'loading' ? {
            borderImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #8b5cf6) 1',
            animation: 'pulse 2s ease-in-out infinite',
          } : {})
        } : { height: 'auto', ...((status === 'loading' ? { borderImage: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #8b5cf6) 1', animation: 'pulse 2s ease-in-out infinite' } : {})) }}
      >
        {/* Premium Header Bar */}
        <div className="flex h-12 shrink-0 items-center gap-2 px-4 border-b border-border-glass bg-surface-strong/80 backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-violet" />
          <span className="text-xs font-bold uppercase tracking-wider text-violet flex-1">Interactive Visual</span>
          
          {status === 'loading' && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet animate-ping" />
              <span className="text-[10px] text-muted font-medium">Rendering...</span>
            </div>
          )}

          {/* Expand Toggle */}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-glass bg-background/50 text-muted hover:text-violet hover:border-violet/30 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Loading Shimmer */}
        {status === 'loading' && (
          <div className="absolute inset-0 top-12 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-violet/40 border-t-violet animate-spin" />
              <span className="text-xs text-muted font-medium tracking-wide">Loading interactive content...</span>
            </div>
          </div>
        )}

        {/* CHANGED overflow-hidden to overflow-auto for internal scrolling */}
        <div className={`flex-1 overflow-auto bg-[#08090c] transition-all duration-300 ease-out`} style={isExpanded ? { height: '100%' } : { height: 'calc(100% - 48px)' }}>
          <iframe
            ref={iframeRef}
            srcDoc={injectedHtml}
            sandbox="allow-scripts allow-forms allow-same-origin"
            title="Interactive Widget"
            className="w-full h-full border-none"
            style={{ minHeight: '100%', pointerEvents: 'auto', backgroundColor: '#08090c' }}
          />
        </div>

        {/* Custom Drag Resize Handle */}
        {!isExpanded && (
          <div 
            onPointerDown={startDrag}
            className="h-4 w-full bg-surface shrink-0 flex items-center justify-center cursor-ns-resize border-t border-border-glass hover:bg-surface-strong transition-colors touch-none"
            title="Drag to resize"
          >
            <GripHorizontal className="w-4 h-4 text-muted/50" />
          </div>
        )}
      </div>
    </>
  );
}
