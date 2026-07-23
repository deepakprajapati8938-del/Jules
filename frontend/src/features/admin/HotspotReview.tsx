import { useState, useEffect } from 'react';
import { Check, X, RefreshCw } from 'lucide-react';
import DiagramWithHotspots from '../../components/DiagramWithHotspots';
import { apiClient } from '../../core/api-client'; // using base URL from there if possible, or fetch directly

interface Hotspot {
  id: number;
  diagram_id: number;
  part_label: string;
  x_pct: number;
  y_pct: number;
  explanation: string;
  confidence: string;
  reviewed: boolean;
}

interface Diagram {
  id: number;
  image_path: string;
  caption: string;
  hotspots: Hotspot[];
}

export default function HotspotReview() {
  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [loading, setLoading] = useState(true);

  // Use the same base URL as apiClient
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  const fetchDiagrams = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/diagrams/unreviewed`);
      if (res.ok) {
        const data = await res.json();
        setDiagrams(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDiagrams();
  }, []);

  const handleApprove = async (diagramId: number, hotspotId: number) => {
    try {
      await fetch(`${API_URL}/diagrams/hotspots/${hotspotId}/approve`, { method: 'POST' });
      setDiagrams(prev => prev.map(d => {
        if (d.id === diagramId) {
          return { ...d, hotspots: d.hotspots.filter(h => h.id !== hotspotId) };
        }
        return d;
      }).filter(d => d.hotspots.length > 0));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (diagramId: number, hotspotId: number) => {
    try {
      await fetch(`${API_URL}/diagrams/hotspots/${hotspotId}`, { method: 'DELETE' });
      setDiagrams(prev => prev.map(d => {
        if (d.id === diagramId) {
          return { ...d, hotspots: d.hotspots.filter(h => h.id !== hotspotId) };
        }
        return d;
      }).filter(d => d.hotspots.length > 0));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading diagrams...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Review Diagram Hotspots</h1>
        <button onClick={fetchDiagrams} className="p-2 rounded-full hover:bg-surface-strong transition-colors">
          <RefreshCw className="w-5 h-5 text-muted" />
        </button>
      </div>
      
      {diagrams.length === 0 ? (
        <div className="text-center p-12 border border-border-glass rounded-xl bg-surface text-muted">
          No unreviewed hotspots found.
        </div>
      ) : (
        diagrams.map(diag => (
          <div key={diag.id} className="border border-border-glass rounded-xl bg-surface overflow-hidden shadow-glass-sm">
            <div className="p-4 border-b border-border-glass bg-surface-strong">
              <h3 className="font-semibold text-foreground">Diagram #{diag.id}</h3>
              <p className="text-sm text-muted mt-1">{diag.caption}</p>
            </div>
            
            <div className="p-4">
              <DiagramWithHotspots imagePath={diag.image_path} hotspots={diag.hotspots} />
            </div>

            <div className="divide-y divide-border-glass">
              {diag.hotspots.map(h => (
                <div key={h.id} className="flex items-start justify-between p-4 bg-background/50 hover:bg-surface transition-colors">
                  <div>
                    <h4 className="font-medium text-violet uppercase text-sm tracking-wider">{h.part_label}</h4>
                    <p className="text-sm text-foreground/80 mt-1">{h.explanation}</p>
                    <div className="mt-2 text-xs text-muted">
                      Conf: <span className={h.confidence === 'high' ? 'text-emerald-400' : 'text-amber-400'}>{h.confidence}</span>
                      {' | '} Pos: ({h.x_pct.toFixed(1)}%, {h.y_pct.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button 
                      onClick={() => handleReject(diag.id, h.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-strong hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleApprove(diag.id, h.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-strong hover:bg-emerald-500/20 text-muted hover:text-emerald-400 transition-colors"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
