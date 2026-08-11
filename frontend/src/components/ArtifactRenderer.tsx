import { useState, useMemo } from 'react';
import { Code, Play, Maximize2, Minimize2, PanelTopDashed } from 'lucide-react';

interface ArtifactRendererProps {
  content: string;
}

export default function ArtifactRenderer({ content }: ArtifactRendererProps) {
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract title and clean code
  const { title, cleanCode } = useMemo(() => {
    let title = 'Jules Artifact';
    let cleanCode = content.trim();

    const titleMatch = cleanCode.match(/<artifact-title>(.*?)<\/artifact-title>/i);
    if (titleMatch) {
      title = titleMatch[1];
      cleanCode = cleanCode.replace(/<artifact-title>.*?<\/artifact-title>\n?/i, '').trim();
    }

    return { title, cleanCode };
  }, [content]);

  return (
    <div className={`my-6 flex flex-col overflow-hidden rounded-2xl border border-border-glass bg-surface shadow-glass-lg transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50 md:inset-10 xl:inset-20' : 'relative w-full hover:border-violet/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]'}`}>
      
      {/* Top Bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-glass bg-surface-strong px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <PanelTopDashed className="h-4 w-4 text-violet" />
          <span className="text-xs font-bold uppercase tracking-wider text-violet">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center overflow-hidden rounded-lg border border-border-glass bg-background/50 p-0.5">
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${mode === 'preview' ? 'bg-violet text-white shadow-glow-violet' : 'text-muted hover:text-foreground'}`}
            >
              <Play className="h-3 w-3" />
              Preview
            </button>
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${mode === 'code' ? 'bg-violet text-white shadow-glow-violet' : 'text-muted hover:text-foreground'}`}
            >
              <Code className="h-3 w-3" />
              Code
            </button>
          </div>

          <div className="h-4 w-px bg-border-glass mx-1" />

          {/* Expand Toggle */}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-glass bg-background/50 text-muted hover:text-violet hover:border-violet/30 transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 overflow-hidden bg-[#08090c] ${isExpanded ? 'h-full' : 'h-[550px]'}`}>
        {mode === 'preview' ? (
          <iframe
            title={title}
            srcDoc={cleanCode}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="h-full w-full border-none bg-[#08090c]"
            style={{ backgroundColor: '#08090c' }}
          />
        ) : (
          <div className="h-full w-full overflow-auto bg-[#0d1117] p-4 text-sm">
            <pre className="font-mono text-gray-300">
              <code>{cleanCode}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
