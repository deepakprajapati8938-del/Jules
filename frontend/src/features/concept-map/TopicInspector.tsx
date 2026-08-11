import { useState, useEffect } from 'react';
import { X, BookOpen, Link2, Lightbulb, ChevronRight, Dna, Zap, Beaker, Sparkles } from 'lucide-react';

interface TopicDetail {
  topic_name: string;
  chapter: string;
  subject: string;
  confidence_status: string;
  facts: Array<{ text: string; type: string }>;
  connected_topics: Array<{ topic: string; relationship: string }>;
}

interface TopicInspectorProps {
  topicName: string | null;
  onClose: () => void;
  onNavigateToChat?: (topic: string) => void;
}

const SUBJECT_STYLES: Record<string, { icon: React.ReactNode; accent: string; bg: string; border: string }> = {
  Biology: {
    icon: <Dna className="w-4 h-4" />,
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  Physics: {
    icon: <Zap className="w-4 h-4" />,
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
  Chemistry: {
    icon: <Beaker className="w-4 h-4" />,
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'text-slate-400' },
  learning: { label: 'Learning', color: 'text-cyan-400' },
  revised: { label: 'Revised', color: 'text-amber-400' },
  comfortable: { label: 'Comfortable', color: 'text-violet-400' },
  confident: { label: 'Confident', color: 'text-emerald-400' },
};

export default function TopicInspector({ topicName, onClose, onNavigateToChat }: TopicInspectorProps) {
  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!topicName) {
      setDetail(null);
      return;
    }

    setLoading(true);
    fetch(`http://localhost:8000/api/v1/concept-map/topic-detail?topic_name=${encodeURIComponent(topicName)}`)
      .then(res => res.json())
      .then(data => setDetail(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [topicName]);

  if (!topicName) return null;

  const subjectStyle = SUBJECT_STYLES[detail?.subject || ''] || SUBJECT_STYLES['Biology'];
  const statusInfo = STATUS_LABELS[detail?.confidence_status || 'not_started'] || STATUS_LABELS['not_started'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm z-40 flex flex-col bg-[#0c0d12]/98 backdrop-blur-xl border-l border-border-glass shadow-2xl animate-fade-in-up"
        style={{ animationDuration: '300ms' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-glass shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl ${subjectStyle.bg} ${subjectStyle.border} border flex items-center justify-center shrink-0`}>
              <span className={subjectStyle.accent}>{subjectStyle.icon}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground tracking-tight truncate">{topicName}</h3>
              <p className="text-[10px] text-muted uppercase tracking-wider">Topic Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl glass-strong border border-border-glass flex items-center justify-center text-muted hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-violet/40 border-t-violet rounded-full animate-spin" />
              <span className="text-xs text-muted">Loading topic details...</span>
            </div>
          ) : detail ? (
            <>
              {/* Meta Info Card */}
              <div className="glass rounded-2xl p-4 border border-border-glass space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-xs text-secondary font-medium">{detail.chapter}</span>
                  </div>
                  <span className={`text-xs font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${subjectStyle.bg} ${subjectStyle.accent} ${subjectStyle.border} border`}>
                    {detail.subject}
                  </span>
                  <span className="text-xs text-muted">
                    {detail.connected_topics.length} connection{detail.connected_topics.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Key Facts */}
              {detail.facts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Key Facts</h4>
                  </div>
                  <div className="space-y-2">
                    {detail.facts.map((fact, i) => (
                      <div key={i} className="glass rounded-xl p-3 border border-border-glass text-xs text-foreground/85 leading-relaxed">
                        "{fact.text}"
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Topics */}
              {detail.connected_topics.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Connected Topics</h4>
                  </div>
                  <div className="space-y-1.5">
                    {detail.connected_topics.map((conn, i) => (
                      <div key={i} className="glass rounded-xl p-3 border border-border-glass flex items-start gap-3 group hover:border-violet/30 transition-colors">
                        <div className="w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[9px] font-bold text-cyan-400">{i + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{conn.topic}</p>
                          {conn.relationship && (
                            <p className="text-[10px] text-muted mt-0.5 italic">"{conn.relationship}"</p>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted group-hover:text-violet-400 transition-colors shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ask Jules CTA */}
              {onNavigateToChat && (
                <button
                  onClick={() => onNavigateToChat(topicName)}
                  className="w-full btn-accent py-3 flex items-center justify-center gap-2 text-sm font-medium tracking-wide active-scale"
                >
                  <Sparkles className="w-4 h-4" />
                  Ask Jules about this topic
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-xs text-muted">
              No details available for this topic.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
