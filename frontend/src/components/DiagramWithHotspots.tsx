import { useState } from 'react';

interface Hotspot {
  id: number;
  part_label: string;
  x_pct: number;
  y_pct: number;
  explanation: string;
}

interface DiagramWithHotspotsProps {
  imagePath: string;
  hotspots: Hotspot[];
}

export default function DiagramWithHotspots({ imagePath, hotspots }: DiagramWithHotspotsProps) {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border-glass bg-surface my-6">
      <img src={imagePath} alt="Diagram" className="w-full h-auto object-contain" />
      
      {hotspots.map((hotspot) => (
        <button
          key={hotspot.id}
          className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-violet/80 border-2 border-white shadow-glow-violet hover:scale-110 transition-transform flex items-center justify-center animate-pulse-slow z-10"
          style={{ left: `${hotspot.x_pct}%`, top: `${hotspot.y_pct}%` }}
          onClick={(e) => {
            e.preventDefault();
            setActiveHotspot(hotspot === activeHotspot ? null : hotspot);
          }}
          aria-label={hotspot.part_label}
        >
          <span className="w-1.5 h-1.5 bg-white rounded-full pointer-events-none" />
        </button>
      ))}

      {activeHotspot && (
        <div className="absolute bottom-4 left-4 right-4 bg-surface-strong/95 backdrop-blur-xl border border-border-glass rounded-xl p-4 shadow-glass-lg z-20 animate-fade-in-up">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-bold text-violet uppercase tracking-wider">{activeHotspot.part_label}</h4>
            <button 
              onClick={() => setActiveHotspot(null)}
              className="text-muted hover:text-white transition-colors text-xs px-2 py-1 bg-background/50 rounded"
            >
              Close
            </button>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/90">{activeHotspot.explanation}</p>
        </div>
      )}
    </div>
  );
}
