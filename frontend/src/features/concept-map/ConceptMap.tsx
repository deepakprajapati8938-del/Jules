import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Map, RefreshCw, Network, Search, X, Dna, Zap, Beaker } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import TopicInspector from './TopicInspector';

interface ConceptNode {
  id: string;
  name: string;
  group: number;
  val: number;
  subject: string;
  chapter: string;
  is_weak: boolean;
}

import { NEET_SYLLABUS } from '../../core/syllabus';

interface ConceptLink {
  source: string;
  target: string;
  label: string;
}

// Subject-aware vibrant palettes: confidence 1(dim) → 5(bright)
const SUBJECT_PALETTES: Record<string, Record<number, string>> = {
  Biology:   { 1: '#0f2e22', 2: '#166534', 3: '#22c55e', 4: '#34d399', 5: '#06ffa5' },
  Chemistry: { 1: '#2a1f0a', 2: '#92400e', 3: '#d97706', 4: '#f59e0b', 5: '#fde68a' },
  Physics:   { 1: '#1e1033', 2: '#6d28d9', 3: '#8b5cf6', 4: '#a78bfa', 5: '#c4b5fd' },
};
const DEFAULT_PALETTE: Record<number, string> = { 1: '#334155', 2: '#64748b', 3: '#94a3b8', 4: '#cbd5e1', 5: '#e2e8f0' };

const SUBJECT_ACCENTS: Record<string, string> = {
  Biology: '#06ffa5',
  Chemistry: '#fbbf24',
  Physics: '#a78bfa',
};

const SUBJECT_PARTICLE_COLORS: Record<string, string> = {
  Biology: 'rgba(6, 255, 165, 0.7)',
  Chemistry: 'rgba(251, 191, 36, 0.7)',
  Physics: 'rgba(167, 139, 250, 0.7)',
};

export default function ConceptMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [links, setLinks] = useState<ConceptLink[]>([]);
  
  const [viewMode, setViewMode] = useState<'tree' | 'graph'>('tree');
  const [chapter, setChapter] = useState(NEET_SYLLABUS['Biology']?.[0] || 'Cell The Unit Of Life'); 

  const [hoverNode, setHoverNode] = useState<ConceptNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Determine current chapter's subject from NEET_SYLLABUS
  const currentSubject = useMemo(() => {
    for (const [subj, chapters] of Object.entries(NEET_SYLLABUS)) {
      if (chapters.includes(chapter)) return subj;
    }
    return 'Biology';
  }, [chapter]);

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

  const handleNodeClick = useCallback((node: any) => {
    if (node?.id && !node.isRoot) {
      setSelectedTopic(node.id);
    }
  }, []);

  // Get color for a node based on its subject and confidence group
  const getNodeColor = useCallback((subject: string, group: number) => {
    const palette = SUBJECT_PALETTES[subject] || DEFAULT_PALETTE;
    return palette[group] || palette[1];
  }, []);

  // Search matching logic
  const matchingNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null; // null = no filter active
    const q = searchQuery.toLowerCase().trim();
    return new Set(nodes.filter(n => n.name.toLowerCase().includes(q)).map(n => n.id));
  }, [searchQuery, nodes]);

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
      let filteredNodes = nodes.map(n => ({ ...n, name: cleanName(n.name) }));
      let filteredLinks = [...links];

      // Apply subject filter
      if (subjectFilter !== 'All') {
        const subjectNodeIds = new Set(filteredNodes.filter(n => n.subject === subjectFilter).map(n => n.id));
        filteredNodes = filteredNodes.filter(n => subjectNodeIds.has(n.id));
        filteredLinks = filteredLinks.filter(l => {
          const srcId = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const tgtId = typeof l.target === 'object' ? (l.target as any).id : l.target;
          return subjectNodeIds.has(srcId) && subjectNodeIds.has(tgtId);
        });
      }

      return { nodes: filteredNodes, links: filteredLinks };
    } else {
      // Tree mode: We just link the Chapter (as a root node) to all its topics.
      const chapterNodes = nodes.filter(n => n.chapter === chapter);
      const rootId = `root-${chapter}`;
      
      const treeNodes = [
        { id: rootId, name: chapter, group: 5, val: 30, subject: currentSubject, chapter, is_weak: false, isRoot: true },
        ...chapterNodes.map(n => ({ ...n, name: cleanName(n.name) }))
      ];
      
      const treeLinks = chapterNodes.map(n => ({
        source: rootId,
        target: n.id,
        label: "belongs to"
      }));
      
      return { nodes: treeNodes, links: treeLinks };
    }
  }, [nodes, links, viewMode, chapter, subjectFilter, currentSubject]);

  // Adjust physics simulation when graph loads
  useEffect(() => {
    if (graphRef.current) {
      // Increase repulsion heavily to prevent text overlap for disconnected nodes
      // and spread out the radial tree nicely.
      graphRef.current.d3Force('charge').strength(viewMode === 'tree' ? -600 : -1000);
      graphRef.current.d3Force('link').distance(viewMode === 'tree' ? 80 : 40);
    }
  }, [graphData, dimensions, viewMode]);

  const particleColor = SUBJECT_PARTICLE_COLORS[currentSubject] || 'rgba(167, 139, 250, 0.7)';

  return (
    <div className="flex flex-col h-full relative">
      {/* Top Control Bar */}
      <div className="absolute top-4 left-4 right-4 md:right-auto z-10 glass-strong p-3 rounded-2xl shadow-glass-sm flex flex-wrap items-center gap-3">
        <Map className="w-5 h-5 text-accent" />
        
        <select 
          className="bg-transparent border-none text-foreground font-medium outline-none cursor-pointer text-sm w-40 md:w-auto truncate"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
        >
          {Object.entries(NEET_SYLLABUS).map(([subject, chapters]) => (
            <optgroup key={subject} label={subject} className="bg-surface text-secondary font-semibold">
              {chapters.map(ch => (
                <option key={ch} value={ch} className="bg-background text-foreground font-medium">{ch}</option>
              ))}
            </optgroup>
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

      {/* Search & Filter Bar */}
      <div className="absolute top-20 left-4 right-4 md:right-auto md:max-w-md z-10 glass-strong p-2.5 rounded-2xl shadow-glass-sm flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full glass-input text-xs pl-8 pr-7 py-1.5 rounded-xl"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Subject Filter Pills */}
        {viewMode === 'graph' && (
          <div className="flex items-center gap-1 glass p-0.5 rounded-xl border border-border-glass">
            {[
              { id: 'All', label: 'All', icon: null },
              { id: 'Biology', label: '🧬', icon: <Dna className="w-3 h-3" /> },
              { id: 'Chemistry', label: '🧪', icon: <Beaker className="w-3 h-3" /> },
              { id: 'Physics', label: '⚡', icon: <Zap className="w-3 h-3" /> },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSubjectFilter(f.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  subjectFilter === f.id
                    ? 'bg-violet/20 text-violet border border-violet/40'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button 
          onClick={handleRecenter}
          className="p-3 glass-strong rounded-xl shadow-glass-sm text-secondary hover:text-accent transition-colors group"
          title="Recenter Map"
        >
          <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>

      {/* Canvas Legend */}
      <div className="absolute bottom-4 left-4 z-10 glass-strong p-3 rounded-2xl shadow-glass-sm hidden md:flex items-center gap-4">
        {Object.entries(SUBJECT_ACCENTS).map(([subj, color]) => (
          <div key={subj} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
            <span className="text-[10px] text-secondary font-medium">{subj}</span>
          </div>
        ))}
        <div className="w-[1px] h-4 bg-border-glass" />
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-violet/60 animate-pulse" />
          <span className="text-[10px] text-secondary font-medium">Weak</span>
        </div>
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
            onNodeClick={handleNodeClick}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleWidth={1.5}
            linkDirectionalParticleColor={() => particleColor}
            linkColor={() => 'rgba(255,255,255,0.06)'}
            backgroundColor="#08090c"
            dagMode={viewMode === 'tree' ? 'radialout' : undefined}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              const subject = node.subject || currentSubject;
              const color = getNodeColor(subject, node.group);
              const accentColor = SUBJECT_ACCENTS[subject] || '#a78bfa';
              const size = node.val ? Math.sqrt(node.val) * 2 : 6;
              const isWeak = node.is_weak;
              const isHovered = hoverNode?.id === node.id;
              const isRoot = node.isRoot;
              const isSearchDimmed = matchingNodeIds !== null && !matchingNodeIds.has(node.id) && !isRoot;

              // Apply search dimming
              const opacity = isSearchDimmed ? 0.15 : 1;
              ctx.globalAlpha = opacity;

              // Draw outer glow halo
              if ((isHovered || isWeak || node.group >= 4) && !isSearchDimmed) {
                ctx.shadowColor = isWeak ? '#a78bfa' : accentColor;
                ctx.shadowBlur = isHovered ? 30 : (isWeak ? 18 : 12);
              } else {
                ctx.shadowBlur = 0;
              }
              
              if (isWeak && !isSearchDimmed) {
                // Weak pulsing ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + (isHovered ? 6 : 4), 0, 2 * Math.PI);
                ctx.strokeStyle = '#a78bfa';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              // Outer ring for confident nodes
              if (node.group >= 4 && !isWeak && !isSearchDimmed) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
                ctx.strokeStyle = `${accentColor}40`;
                ctx.lineWidth = 1 / globalScale;
                ctx.stroke();
              }

              // Node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              ctx.fillStyle = isHovered ? '#fff' : color;
              ctx.fill();
              ctx.shadowBlur = 0;

              // Only draw labels if we are zoomed in, or it's the root node, or hovered, or search matched
              const isSearchHighlighted = matchingNodeIds !== null && matchingNodeIds.has(node.id);
              const shouldDrawLabel = globalScale > 1.5 || isRoot || isHovered || isSearchHighlighted;
              
              if (shouldDrawLabel) {
                ctx.font = `${isRoot ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
                
                const textWidth = ctx.measureText(label).width;
                const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.8);

                // Draw pill background for text readability
                ctx.fillStyle = 'rgba(8, 9, 12, 0.85)';
                ctx.beginPath();
                ctx.roundRect(
                  node.x - bckgDimensions[0] / 2,
                  node.y + size + 2,
                  bckgDimensions[0],
                  bckgDimensions[1],
                  fontSize * 0.5
                );
                ctx.fill();

                // Highlight border for search matches
                if (isSearchHighlighted) {
                  ctx.strokeStyle = accentColor;
                  ctx.lineWidth = 1.5 / globalScale;
                  ctx.stroke();
                }

                // Draw text
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isRoot ? accentColor : (isHovered ? '#fff' : (isSearchHighlighted ? accentColor : 'rgba(255,255,255,0.8)'));
                ctx.fillText(label, node.x, node.y + size + 2 + bckgDimensions[1] / 2);
              }

              ctx.globalAlpha = 1; // Reset
            }}
          />
        )}
      </div>

      {/* Topic Inspector Drawer */}
      <TopicInspector
        topicName={selectedTopic}
        onClose={() => setSelectedTopic(null)}
        onNavigateToChat={(topic) => {
          window.location.hash = `#/ncert-chat?q=${encodeURIComponent(`Explain ${topic} in detail`)}`;
          setSelectedTopic(null);
        }}
      />
    </div>
  );
}
