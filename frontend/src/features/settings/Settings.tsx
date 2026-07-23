import { useState } from 'react';
import { Settings as SettingsIcon, BookOpen } from 'lucide-react';

export default function Settings() {
  const [chapters, setChapters] = useState([
    { name: 'Motion in a Straight Line', subject: 'Physics', included: true, weightage_marks: 8 },
    { name: 'Reproduction In Organisms', subject: 'Biology', included: false, weightage_marks: 0 },
  ]);

  const toggleChapter = (name: string) => {
    setChapters(prev => prev.map(c => 
      c.name === name ? { ...c, included: !c.included } : c
    ));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-foreground" />
        <h2 className="text-2xl font-semibold text-foreground">Settings & Syllabus Config</h2>
      </div>

      <div className="glass rounded-2xl overflow-hidden shadow-glass-sm">
        <div className="p-4 border-b border-border-glass bg-surface-strong flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-secondary" />
            <h3 className="font-medium text-foreground">Syllabus Chapters</h3>
          </div>
          <span className="text-xs font-medium bg-accent-tint text-accent px-2 py-1 rounded-md border border-accent/15">
            {chapters.filter(c => c.included).length} Included
          </span>
        </div>
        
        <div className="divide-y divide-border-glass-light">
          {chapters.map((chapter) => (
            <div key={chapter.name} className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors">
              <div>
                <p className={`font-medium ${chapter.included ? 'text-foreground' : 'text-muted line-through'}`}>
                  {chapter.name}
                </p>
                <p className="text-xs text-secondary mt-0.5">{chapter.subject}</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-xs text-muted font-medium">
                  Wt: {chapter.weightage_marks}
                </div>
                
                {/* Toggle switch */}
                <button
                  onClick={() => toggleChapter(chapter.name)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${
                    chapter.included ? 'bg-accent shadow-glow-accent-sm' : 'bg-surface-strong border border-border-glass'
                  }`}
                >
                  <span className="sr-only">Toggle {chapter.name}</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      chapter.included ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
