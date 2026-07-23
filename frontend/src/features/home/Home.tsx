import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquareText, 
  HeartHandshake, 
  Lightbulb, 
  Play, 
  Layers, 
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { HomeData } from '../../core/api-client';

const DAILY_MESSAGES = [
  "You're doing better than you think. Keep going.",
  "Rest is just as important as the grind. Breathe.",
  "Small steps every day lead to massive leaps.",
  "Your worth isn't tied to a test score.",
  "Take a moment to appreciate how far you've come.",
  "It's okay to have a slow day. Just don't stop entirely.",
  "Focus on progress, not perfection.",
  "You are capable of learning hard things.",
  "Be kind to your mind today.",
  "One concept at a time. There's no rush.",
];

export default function Home() {
  const [data, setData] = useState<HomeData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.home.getData().then(setData).catch(console.error);
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const dailyMessage = useMemo(() => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
  }, []);

  return (
    <div className="flex-1 overflow-y-auto w-full pb-20 scrollbar-hide">
      
      {/* Hero Section with Mesh Gradient */}
      <div className="relative pt-12 pb-10 px-4 md:px-8 mb-8 overflow-hidden rounded-b-[3rem] shadow-glass-sm border-b border-border-glass">
        <div className="absolute inset-0 hero-mesh opacity-80" />
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-start gap-4">
          <div className="inline-flex items-center gap-2 bg-background/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-glass-inset">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-foreground tracking-wide">{dailyMessage}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight drop-shadow-lg">
            {greeting},<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">Kid</span>
          </h1>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-4xl mx-auto space-y-8">
        
        {/* Quick Actions (Massive Tactile Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <button 
            onClick={() => navigate('/chat')}
            className="tactile-card p-6 md:p-8 flex items-center gap-5 text-left group"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent-tint flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow-accent-sm">
              <MessageSquareText className="w-8 h-8 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-foreground tracking-tight mb-1 group-hover:text-accent transition-colors">Ask a Doubt</h3>
              <p className="text-sm text-secondary">Clear NCERT concepts instantly</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/personal')}
            className="tactile-card p-6 md:p-8 flex items-center gap-5 text-left group"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(52,211,153,0.2)]">
              <HeartHandshake className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-foreground tracking-tight mb-1 group-hover:text-emerald-400 transition-colors">Just Talk</h3>
              <p className="text-sm text-secondary">Vent, plan, or find motivation</p>
            </div>
          </button>
        </div>

        {/* Action Items Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Today's Suggestion */}
          {data?.suggestion && (
            <button 
              onClick={() => navigate('/chat')}
              className="tactile-card p-6 text-left group flex flex-col justify-between"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 shrink-0 flex items-center justify-center group-hover:bg-amber-400/20 transition-colors">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-secondary tracking-widest uppercase">Today's Focus</h3>
              </div>
              <div>
                <h4 className="font-bold text-foreground text-xl tracking-tight mb-1">{data.suggestion.chapter_name}</h4>
                <p className="text-sm text-secondary mb-3">{data.suggestion.reason}</p>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
                  {data.suggestion.subject}
                </div>
              </div>
            </button>
          )}

          <div className="space-y-5">
            {/* Last Incomplete Test */}
            {data?.last_incomplete_test && (
              <button 
                onClick={() => navigate('/tests')}
                className="tactile-card p-5 hover:bg-surface-hover transition-colors text-left flex items-center gap-4 group w-full"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 text-blue-400 ml-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground tracking-tight mb-0.5">Resume Test</h4>
                  <p className="text-sm text-secondary truncate">
                    {data.last_incomplete_test.chapter_name || data.last_incomplete_test.subject || 'Mock Test'}
                  </p>
                </div>
              </button>
            )}

            {/* Flashcards Due */}
            <button 
              onClick={() => navigate('/flashcards')}
              className="tactile-card p-5 hover:bg-surface-hover transition-colors text-left flex items-center gap-4 group w-full"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-400/10 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="font-bold text-foreground tracking-tight mb-0.5">Flashcards Due</h4>
                <p className="text-sm text-secondary">
                  {data?.flashcards_due === 0 ? 'All caught up!' : `${data?.flashcards_due} pending reviews`}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Chats */}
        {data?.recent_chats && data.recent_chats.length > 0 && (
          <section className="pt-4">
            <h3 className="text-sm font-semibold text-secondary tracking-widest uppercase mb-4 px-2">Recent Conversations</h3>
            <div className="space-y-3">
              {data.recent_chats.map((chat, i) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(chat.type === 'NCERT' ? '/chat' : '/personal')}
                  className="chat-pill w-full text-left relative overflow-hidden group"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Subtle color hint on the left edge */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${chat.type === 'NCERT' ? 'bg-accent' : 'bg-emerald-400'}`} />
                  
                  <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${chat.type === 'NCERT' ? 'bg-accent-tint text-accent' : 'bg-emerald-400/10 text-emerald-400'}`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[15px] font-medium text-foreground truncate group-hover:text-white transition-colors">{chat.content}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary mt-1 block">
                      {chat.type} Chat
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        
      </div>
    </div>
  );
}
