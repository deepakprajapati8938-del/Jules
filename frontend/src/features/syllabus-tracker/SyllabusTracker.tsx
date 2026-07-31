import { useState, useEffect } from 'react';
import { BookMarked, ChevronDown, ChevronRight, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { SubjectProgress } from '../../core/api-client';

export default function SyllabusTracker() {
  const [syllabus, setSyllabus] = useState<SubjectProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>('Botany');
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  useEffect(() => {
    fetchSyllabus();
  }, []);

  const fetchSyllabus = async () => {
    try {
      const data = await apiClient.syllabusTracker.get();
      setSyllabus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (
    subjectIndex: number, 
    chapterIndex: number, 
    topicIndex: number | null, 
    currentStatus: boolean
  ) => {
    const chap = syllabus[subjectIndex].chapters[chapterIndex];
    const newStatus = !currentStatus;
    
    // Optimistic UI update
    const newSyllabus = [...syllabus];
    if (topicIndex === null) {
      newSyllabus[subjectIndex].chapters[chapterIndex].is_completed = newStatus;
    } else {
      newSyllabus[subjectIndex].chapters[chapterIndex].topics[topicIndex].is_completed = newStatus;
    }
    setSyllabus(newSyllabus);

    // API Call
    try {
      const topicName = topicIndex === null ? "" : chap.topics[topicIndex].name;
      await apiClient.syllabusTracker.toggle(chap.name, topicName, newStatus);
    } catch (err) {
      console.error(err);
      // Revert on failure
      fetchSyllabus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glow-accent-sm">
          <BookMarked className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Syllabus Tracker</h2>
          <p className="text-secondary text-sm">Track your Yakeen 2.0 NEET 2027 progress</p>
        </div>
      </div>

      <div className="space-y-6">
        {syllabus.map((subject, sIdx) => {
          const totalChapters = subject.chapters.length;
          const completedChapters = subject.chapters.filter(c => {
            const hasTopics = c.topics.length > 0;
            const completedTopics = c.topics.filter(t => t.is_completed).length;
            return c.is_completed || (hasTopics && completedTopics === c.topics.length);
          }).length;
          const isExpanded = expandedSubject === subject.name;
          
          type SubjectTheme = { ring: string; avatarBg: string; avatarText: string; bar: string; expandedBg: string; };
          const themes: Record<string, SubjectTheme> = {
            Botany:    { ring: 'ring-emerald-500/40', avatarBg: 'bg-emerald-500/10', avatarText: 'text-emerald-400', bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',    expandedBg: 'bg-emerald-950/40 border-b border-emerald-500/20' },
            Zoology:   { ring: 'ring-blue-500/40',    avatarBg: 'bg-blue-500/10',    avatarText: 'text-blue-400',    bar: 'bg-gradient-to-r from-blue-500 to-cyan-400',      expandedBg: 'bg-blue-950/40 border-b border-blue-500/20' },
            Physics:   { ring: 'ring-rose-500/40',    avatarBg: 'bg-rose-500/10',    avatarText: 'text-rose-400',    bar: 'bg-gradient-to-r from-rose-500 to-pink-400',      expandedBg: 'bg-rose-950/40 border-b border-rose-500/20' },
            Chemistry: { ring: 'ring-amber-500/40',   avatarBg: 'bg-amber-500/10',   avatarText: 'text-amber-400',   bar: 'bg-gradient-to-r from-amber-500 to-orange-400',   expandedBg: 'bg-amber-950/40 border-b border-amber-500/20' },
          };
          const theme = themes[subject.name] ?? { ring: 'ring-border-glass', avatarBg: 'bg-surface', avatarText: 'text-foreground', bar: 'bg-accent-gradient', expandedBg: 'bg-surface-hover/50 border-b border-border-glass' };

          return (
            <div key={subject.name} className="glass-strong rounded-[2rem] overflow-hidden shadow-glass transition-all duration-300">
              {/* Subject Header */}
              <button 
                onClick={() => setExpandedSubject(isExpanded ? null : subject.name)}
                className={`w-full flex items-center justify-between p-6 transition-colors ${isExpanded ? theme.expandedBg : 'hover:bg-surface-hover/30'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${theme.avatarBg} ring-1 ${theme.ring} shadow-glass-inset`}>
                    <span className={`font-bold text-lg ${theme.avatarText}`}>{subject.name[0]}</span>
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">{subject.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-1.5 bg-surface-strong rounded-full overflow-hidden border border-border-glass">
                        <div 
                          className={`h-full transition-all duration-500 ${theme.bar}`}
                          style={{ width: `${totalChapters === 0 ? 0 : (completedChapters / totalChapters) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-secondary">{completedChapters} / {totalChapters}</span>
                    </div>
                  </div>
                </div>
                <div className="p-2 rounded-full bg-surface border border-border-glass text-secondary">
                  {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Chapters List */}
              {isExpanded && (
                <div className="pt-2 pb-6 px-1 md:px-4 space-y-3">
                  {subject.chapters.map((chapter, cIdx) => {
                    const isChapExpanded = expandedChapter === chapter.name;
                    const hasTopics = chapter.topics.length > 0;
                    const completedTopics = chapter.topics.filter(t => t.is_completed).length;
                    const isFullyCompleted = chapter.is_completed || (hasTopics && completedTopics === chapter.topics.length);

                    return (
                      <div key={chapter.name} className="bg-black/40 backdrop-blur-md rounded-[1.25rem] border border-white/[0.03] overflow-hidden transition-all duration-300">
                        <div className="flex items-center p-3 md:p-4 gap-3">
                          {/* Chapter Checkbox */}
                          <button 
                            onClick={() => handleToggle(sIdx, cIdx, null, chapter.is_completed)}
                            className="shrink-0 transition-transform active-scale group"
                          >
                            {isFullyCompleted ? (
                              <CheckCircle2 className="w-7 h-7 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                            ) : (
                              <Circle className="w-7 h-7 text-muted group-hover:text-secondary" />
                            )}
                          </button>
                          
                          {/* Chapter Info */}
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => hasTopics && setExpandedChapter(isChapExpanded ? null : chapter.name)}
                          >
                            <h4 className={`text-base font-semibold tracking-tight transition-colors ${isFullyCompleted ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-foreground/90'}`}>
                              {chapter.name}
                            </h4>
                            {hasTopics ? (
                              <p className="text-xs text-secondary mt-0.5">
                                {completedTopics} of {chapter.topics.length} topics completed
                              </p>
                            ) : (
                              <p className="text-xs text-muted/60 mt-0.5 italic">
                                Topics pending extraction
                              </p>
                            )}
                          </div>

                          {/* Expand Topics Button */}
                          {hasTopics && (
                            <button 
                              onClick={() => setExpandedChapter(isChapExpanded ? null : chapter.name)}
                              className="p-2 text-secondary hover:text-foreground rounded-xl transition-colors active-scale bg-white/[0.02] hover:bg-white/[0.06]"
                            >
                              {isChapExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </div>

                        {/* Topics List */}
                        {isChapExpanded && hasTopics && (
                          <div className="px-3 pb-3 pt-1 space-y-0.5">
                            {chapter.topics.map((topic, tIdx) => (
                              <label key={topic.name} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] cursor-pointer transition-colors group">
                                <button 
                                  onClick={() => handleToggle(sIdx, cIdx, tIdx, topic.is_completed)}
                                  className="shrink-0 transition-transform active-scale"
                                >
                                  {topic.is_completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-accent" />
                                  ) : (
                                    <Circle className="w-5 h-5 text-muted group-hover:text-secondary" />
                                  )}
                                </button>
                                <span className={`text-[14px] leading-snug transition-colors ${topic.is_completed ? 'text-white/30 line-through decoration-white/20' : 'text-white/80'}`}>
                                  {topic.name.replace(/\*\*/g, '').replace(/^[0-9.]+\s*/, '') /* Fallback cleanup if backend not restarted */}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
