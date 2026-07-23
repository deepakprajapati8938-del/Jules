import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Map, RefreshCw, Network, Search, Filter } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

interface ConceptNode {
  id: string;
  name: string;
  group: number;
  val: number;
  subject: string;
  chapter: string;
  is_weak: boolean;
}

interface ConceptLink {
  source: string;
  target: string;
  label: string;
}

export default function ConceptMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [links, setLinks] = useState<ConceptLink[]>([]);
  
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const [chapter, setChapter] = useState('Cell The Unit Of Life'); // Default
  
  // Available chapters for demo (exact match with DB)
  const sampleChapters = [
    "Cell The Unit Of Life",
    "Human Reproduction",
    "Biomolecules",
    "Principles Of Inheritance",
    "Motion In A Straight Line"
  ];

  const [hoverNode, setHoverNode] = useState<ConceptNode | null>(null);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/concept-map?chapter_name=${encodeURIComponent(chapter)}`);
      const data = await res.json();
      setNodes(data.nodes || []);
      setLinks(data.links || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [chapter]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  }, []);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const handleRecenter = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  // Node colors mapped to confidence groups (1=not_started, 5=confident)
  const nodeColors: Record<number, string> = {
    1: '#4a4b50', // dim muted gray/amber
    2: '#8a6a4b', // learning
    3: '#cc7a3d', // revised
    4: '#ff8a3d', // comfortable
    5: '#ffb23d', // confident (bright amber)
  };

  // Build the graph data based on the view mode
  const graphData = useMemo(() => {
    // Helper to clean up noisy markdown/numbering from topics
    const cleanName = (name: string) => {
      let clean = name.replace(/\*\*/g, '').replace(/\*/g, '');
      clean = clean.replace(/^[0-9.]+\s*/, ''); // Remove leading "8.5.3 "
      // Shorten extremely long concatenated strings (OCR glitches)
      if (clean.length > 35) clean = clean.substring(0, 32) + '...';
      return clean;
    };

    if (viewMode === 'graph') {
      const cleanedNodes = nodes.map(n => ({ ...n, name: cleanName(n.name) }));
      return { nodes: cleanedNodes, links };
    } else {
      // Tree mode: We just link the Chapter (as a root node) to all its topics.
      const chapterNodes = nodes.filter(n => n.chapter === chapter);
      const rootId = `root-${chapter}`;
      
      const treeNodes = [
        { id: rootId, name: chapter, group: 5, val: 30, subject: '', chapter, is_weak: false, isRoot: true },
        ...chapterNodes.map(n => ({ ...n, name: cleanName(n.name) }))
      ];
      
      const treeLinks = chapterNodes.map(n => ({
        source: rootId,
        target: n.id,
        label: "belongs to"
      }));
      
      return { nodes: treeNodes, links: treeLinks };
    }
  }, [nodes, links, viewMode, chapter]);

  // Adjust physics simulation when graph loads
  useEffect(() => {
    if (graphRef.current) {
      // Increase repulsion heavily to prevent text overlap for disconnected nodes
      // and spread out the radial tree nicely.
      graphRef.current.d3Force('charge').strength(viewMode === 'tree' ? -600 : -1000);
      graphRef.current.d3Force('link').distance(viewMode === 'tree' ? 80 : 40);
    }
  }, [graphData, dimensions, viewMode]);

  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute top-4 left-4 right-4 md:right-auto z-10 glass-strong p-3 rounded-2xl shadow-glass-sm flex flex-wrap items-center gap-3">
        <Map className="w-5 h-5 text-accent" />
        
        <select 
          className="bg-transparent border-none text-foreground font-medium outline-none cursor-pointer text-sm w-40 md:w-auto truncate"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        >
          {sampleChapters.map(ch => (
            <option key={ch} value={ch} className="bg-background text-foreground">{ch}</option>
          ))}
        </select>
        
        <div className="w-[1px] h-6 bg-border-glass mx-1" />
        
        <div className="flex bg-black/40 p-1 rounded-xl">
          <button 
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${viewMode === 'tree' ? 'bg-secondary text-background shadow-glass-sm' : 'text-muted hover:text-foreground'}`}
            onClick={() => setViewMode('tree')}
          >
            Tree
          </button>
          <button 
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${viewMode === 'graph' ? 'bg-secondary text-background shadow-glass-sm' : 'text-muted hover:text-foreground'}`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button 
          onClick={handleRecenter}
          className="p-3 glass-strong rounded-xl shadow-glass-sm text-secondary hover:text-accent transition-colors group"
          title="Recenter Map"
        >
          <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing bg-[#08090c] relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="glass-strong px-6 py-3 rounded-2xl animate-pulse text-accent font-medium shadow-glass-lg flex items-center gap-3">
              <Network className="w-5 h-5 animate-spin-slow" />
              Mapping Concept Space...
            </div>
          </div>
        )}

        {!loading && viewMode === 'graph' && links.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none px-4 text-center">
            <div className="w-20 h-20 rounded-full bg-border-glass flex items-center justify-center mb-6 shadow-glass-lg">
              <Network className="w-10 h-10 text-muted" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Connections Yet</h3>
            <p className="text-muted max-w-md">
              The AI hasn't mapped any cross-links for this chapter yet, or they haven't been approved. 
              <br/><br/>
              Run <code className="bg-black/40 px-2 py-1 rounded text-accent">python scripts/generate_concept_edges.py</code> and then approve them in the Admin Review screen!
            </p>
          </div>
        )}
        
        {dimensions.width > 0 && !(viewMode === 'graph' && links.length === 0) && (
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel={() => ""} // We render our own labels
            onNodeHover={(node) => setHoverNode(node as ConceptNode)}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleColor={() => 'rgba(255,138,61,0.8)'}
            linkColor={() => 'rgba(255,255,255,0.06)'}
            backgroundColor="#08090c"
            dagMode={viewMode === 'tree' ? 'radialout' : undefined}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              const color = nodeColors[node.group] || '#4a4b50';
              const size = node.val ? Math.sqrt(node.val) * 2 : 6;
              const isWeak = node.is_weak;
              const isHovered = hoverNode?.id === node.id;
              const isRoot = node.isRoot;

              // Draw Node Glow
              ctx.shadowColor = isWeak ? '#a78bfa' : color;
              ctx.shadowBlur = isHovered ? 25 : (node.group > 1 || isWeak ? 15 : 0);
              
              if (isWeak) {
                // Weak pulsing ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + (isHovered ? 5 : 3), 0, 2 * Math.PI);
                ctx.strokeStyle = '#a78bfa';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              ctx.fillStyle = isHovered ? '#fff' : color;
              ctx.fill();

              // Only draw labels if we are zoomed in, or it's the root node, or hovered
              const shouldDrawLabel = globalScale > 1.5 || isRoot || isHovered;
              
              if (shouldDrawLabel) {
                ctx.shadowBlur = 0; // Reset shadow for text
                ctx.font = `${isRoot ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
                
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.8);

                // Draw pill background for text readability
                ctx.fillStyle = 'rgba(8, 9, 12, 0.8)';
                ctx.beginPath();
                ctx.roundRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y + size + 2,
                  bckgDimensions[0],
                  bckgDimensions[1],
                  fontSize * 0.5
                );
                ctx.fill();

                // Draw text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isRoot ? '#ffb23d' : (isHovered ? '#fff' : 'rgba(255,255,255,0.8)');
                ctx.fillText(label, node.x, node.y + size + 2 + bckgDimensions[1] / 2);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
