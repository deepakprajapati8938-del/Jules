import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  MessageSquareText,
  HeartHandshake,
  LayoutDashboard,
  CalendarDays,
  Layers,
  BookMarked,
  Map,
  Settings,
  PenTool,
  NotebookPen,
  FileText,
  ListChecks,
  BookOpen,
} from 'lucide-react';
import { apiClient, flushOfflineQueue } from '../core/api-client';
import StreakResetRitual from '../features/streak/StreakResetRitual';
import GlobalAskJules from '../components/GlobalAskJules';

const NAV_ITEMS = [
  { to: "/chat", label: "NCERT Chat", icon: MessageSquareText },
  { to: "/personal", label: "Personal Chat", icon: HeartHandshake },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/daily-log", label: "Daily Log", icon: CalendarDays },
  { to: "/tests", label: "Tests", icon: PenTool },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/cheatsheet", label: "Cheat Sheet", icon: FileText },
  { to: "/journal", label: "Reflection Journal", icon: NotebookPen },
  { to: "/saves", label: "Saved Items", icon: BookMarked },
  { to: "/concept-map", label: "Concept Map", icon: Map },
  { to: "/syllabus", label: "Syllabus Tracker", icon: ListChecks },
  { to: "/guide", label: "User Guide", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const [pendingRitual, setPendingRitual] = useState(false);
  const [showExitMessage, setShowExitMessage] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    if (location.pathname === '/home') return 'Home';
    const match = NAV_ITEMS.find(item => location.pathname.startsWith(item.to));
    return match?.label ?? 'Jules';
  }, [location.pathname]);

  useEffect(() => {
    apiClient.streak.ping().then(data => {
      setStreak(data.current_streak);
      setPendingRitual(data.pending_reset_ritual);
    }).catch(console.error);
    
    // Background pre-caching for offline readiness
    if (navigator.onLine) {
      apiClient.syllabusTracker.get().catch(() => {});
      apiClient.dailyLog.getHistory().catch(() => {});
      flushOfflineQueue();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setShowExitMessage(true);
        setTimeout(() => setShowExitMessage(false), 3000);
      }
    };
    
    const handleOnline = () => {
      setIsOffline(false);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background relative z-10">
      {/* Top Bar — frosted glass */}
      <header className="flex-shrink-0 h-14 border-b border-border-glass flex items-center justify-between px-4 bg-surface backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsNavOpen(true)}
            className="p-2 -ml-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <NavLink to="/home" className="font-semibold text-lg tracking-tight text-foreground hover:text-accent transition-colors">Jules</NavLink>
            <span className="text-muted/40">|</span>
            <span className="text-sm text-secondary font-medium">{pageTitle}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {streak !== null && (
            <div className="text-sm font-medium flex items-center gap-1.5 bg-accent-tint text-accent px-2.5 py-1 rounded-lg border border-accent/20">
              🔥 {streak}
            </div>
          )}
        </div>
      </header>

      {/* Offline Indicator */}
      {isOffline && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-1.5 flex items-center justify-center gap-2 shrink-0 relative z-20 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.2em]">Device Offline</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>

      {/* Nav Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isNavOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsNavOpen(false)} 
      />

      {/* Nav Panel — glass */}
      <nav 
        className={`fixed top-0 left-0 bottom-0 w-72 glass-strong z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-glass ${
          isNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border-glass shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/pwa-192x192.png" alt="Jules Logo" className="w-8 h-8 rounded-lg shadow-glow-accent-sm" />
            <span className="font-semibold text-lg text-foreground tracking-tight">Jules</span>
          </div>
          <button 
            onClick={() => setIsNavOpen(false)}
            className="p-2 -mr-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors active-scale"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active-scale ${
                    isActive 
                      ? 'bg-accent-tint text-accent shadow-glass-inset border border-accent/20' 
                      : 'text-secondary hover:bg-surface-hover hover:text-foreground border border-transparent'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </div>

        {/* Nav Footer */}
        <div className="p-4 border-t border-border-glass shrink-0">
          <p className="text-[11px] text-muted font-medium tracking-wide text-center">
            NEET UG 2027 • Personal Study Tool
          </p>
        </div>
      </nav>

      {/* Streak Reset Ritual */}
      {pendingRitual && (
        <StreakResetRitual onComplete={() => setPendingRitual(false)} />
      )}

      {/* Global Ask Jules */}
      <GlobalAskJules />

      {/* Gentle Exit Message */}
      {showExitMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-strong px-6 py-3 rounded-full text-sm font-medium shadow-glass flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-accent" />
          <span className="text-foreground">See you tomorrow!</span>
        </div>
      )}
    </div>
  );
}
