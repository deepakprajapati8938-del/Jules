import { useState } from 'react';
import { X } from 'lucide-react';

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
    <div className="relative w-full rounded-2xl overflow-hidden border border-border-glass bg-surface my-6 group">
      <img src={imagePath} alt="Diagram" className="w-full h-auto object-contain" />
      
      {hotspots.map((hotspot, idx) => (
        <button
          key={hotspot.id}
          className="absolute flex items-center justify-center z-10 transition-transform hover:scale-125 active-scale"
          style={{ left: `${hotspot.x_pct}%`, top: `${hotspot.y_pct}%`, transform: 'translate(-50%, -50%)' }}
          onClick={(e) => {
            e.preventDefault();
            setActiveHotspot(hotspot === activeHotspot ? null : hotspot);
          }}
          aria-label={hotspot.part_label}
        >
          {/* Animated ripple rings */}
          <span className="absolute w-8 h-8 rounded-full border border-violet/40 animate-ping" style={{ animationDuration: '2s' }} />
          <span className="absolute w-10 h-10 rounded-full border border-violet/20 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
          {/* Core numbered marker */}
          <span className="relative w-7 h-7 rounded-full bg-violet/90 border-2 border-white/80 shadow-[0_0_12px_rgba(139,92,246,0.6)] flex items-center justify-center">
            <span className="text-[10px] font-bold text-white leading-none">{idx + 1}</span>
          </span>
        </button>
      ))}

      {activeHotspot && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#08090c]/98 via-[#08090c]/95 to-transparent pt-10 pb-5 px-5 z-20 animate-fade-in-up">
          <div className="glass-strong rounded-2xl p-5 border border-violet/20 shadow-glass-lg max-w-lg mx-auto">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet/20 border border-violet/40 flex items-center justify-center text-[10px] font-bold text-violet">
                  {hotspots.indexOf(activeHotspot) + 1}
                </span>
                <h4 className="text-sm font-bold text-violet uppercase tracking-wider">{activeHotspot.part_label}</h4>
              </div>
              <button 
                onClick={() => setActiveHotspot(null)}
                className="w-7 h-7 rounded-lg bg-surface-strong border border-border-glass flex items-center justify-center text-muted hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/90">{activeHotspot.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
