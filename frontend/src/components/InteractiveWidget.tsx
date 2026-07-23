import { useEffect, useState, useRef } from 'react';

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
          console.warn('InteractiveWidget: Timed out waiting for widget-ready signal');
          return 'error';
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
    <div className={`mt-6 w-full rounded-2xl overflow-hidden border border-border-glass bg-surface shadow-glass-lg transition-opacity duration-300 min-h-[550px] relative`}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm z-10">
          <div className="w-6 h-6 border-2 border-violet border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title="Interactive Widget"
        className="w-full h-[550px] border-none bg-transparent"
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
}
