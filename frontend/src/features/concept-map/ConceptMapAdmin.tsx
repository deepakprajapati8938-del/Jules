import { useState, useEffect } from 'react';
import { Network, Check, X } from 'lucide-react';

export default function ConceptMapAdmin() {
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEdges = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/concept-map/admin/edges');
      const data = await res.json();
      setEdges(data.edges || []);
    } catch (e) {
      console.error("Failed to fetch admin edges", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEdges();
  }, []);

  const handleKeep = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/v1/concept-map/admin/edges/${id}/keep`, { method: 'POST' });
      setEdges(edges.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscard = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/v1/concept-map/admin/edges/${id}/discard`, { method: 'DELETE' });
      setEdges(edges.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full relative p-6 bg-background text-foreground overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-violet-400">
          Admin Review: Concept Edges
        </h1>
        <p className="text-muted mt-2">
          Review connections suggested by the AI. Only kept edges will appear in the graph view.
          ({edges.length} remaining)
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse text-muted">Loading pending edges...</div>
      ) : edges.length === 0 ? (
        <div className="text-center p-12 glass-strong rounded-3xl shadow-glass-inset">
          <p className="text-muted">No pending edges to review! You're all caught up.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-3xl">
          {edges.map((edge) => (
            <div key={edge.id} className="p-5 glass-strong rounded-2xl shadow-glass-sm flex flex-col gap-3 group hover:shadow-glass-md transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <span className="text-accent font-medium">{edge.topic_a}</span>
                  <Network className="w-4 h-4 text-muted" />
                  <span className="text-violet-400 font-medium">{edge.topic_b}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleKeep(edge.id)}
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleDiscard(edge.id)}
                    className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground/80 italic bg-black/20 p-3 rounded-xl border border-white/5">
                "{edge.relationship_note}"
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
