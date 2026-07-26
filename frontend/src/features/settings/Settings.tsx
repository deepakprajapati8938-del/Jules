import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, BookOpen, Download } from 'lucide-react';
import { getAllChapters } from '../../core/syllabus';

export default function Settings() {
  const [chapters, setChapters] = useState(() => {
    return getAllChapters().map(ch => ({
      name: ch.name,
      subject: ch.subject,
      included: true,
      weightage_marks: 4
    }));
  });

  const toggleChapter = (name: string) => {
    setChapters(prev => prev.map(c => 
      c.name === name ? { ...c, included: !c.included } : c
    ));
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }
    const handleReady = () => setDeferredPrompt(window.deferredPrompt);
    window.addEventListener('app-install-ready', handleReady);
    return () => window.removeEventListener('app-install-ready', handleReady);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Installation is managed by your browser. Please look for the 'Install' icon in your address bar (laptop) or select 'Add to Home Screen' from your browser menu (mobile).");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    setDeferredPrompt(null);
    window.deferredPrompt = null;
  };

  return (
    <div className="h-full overflow-y-auto pb-24 p-4 md:p-8 max-w-4xl mx-auto w-full scrollbar-hide">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-foreground" />
        <h2 className="text-2xl font-semibold text-foreground">Settings</h2>
      </div>

      {/* PWA Install Section */}
      <div className="glass rounded-2xl p-5 mb-6 flex items-center justify-between border border-accent/20 shadow-glow-accent-sm">
        <div>
            <h3 className="font-semibold text-foreground text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-accent" />
              Install App
            </h3>
            <p className="text-sm text-secondary mt-1 max-w-sm">
              Install Jules on your device for a native full-screen experience and faster access.
            </p>
          </div>
        <button
          onClick={handleInstallClick}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all shrink-0 ${
            deferredPrompt 
              ? 'btn-accent shadow-glow-accent' 
              : 'bg-surface-strong text-secondary border border-border-glass hover:bg-surface-hover'
          }`}
        >
          {deferredPrompt ? 'Install Now' : 'How to Install'}
        </button>
      </div>

      {/* Syllabus Config */}
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
