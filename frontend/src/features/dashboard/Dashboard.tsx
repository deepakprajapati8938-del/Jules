import { useState, useEffect } from 'react';
import { LayoutDashboard, CheckCircle2, Flame, HeartHandshake, Lightbulb, CalendarDays, Loader2 } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import type { FactOut } from '../../core/api-client';
import { calculateStreak, type StreakData } from '../../utils/streak-calculator';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import QuickMCQWidget from './QuickMCQWidget';

const DASHBOARD_AFFIRMATIONS = [
  "You are capable of mastering this material.",
  "Every small step brings you closer to your goal.",
  "Your dedication today will pay off tomorrow.",
  "Take it one concept at a time.",
  "You have what it takes to succeed.",
];

export default function Dashboard() {
  const [dailyAffirmation] = useState(() => DASHBOARD_AFFIRMATIONS[Math.floor(Math.random() * DASHBOARD_AFFIRMATIONS.length)]);
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning! Ready for a light review?";
    if (hour >= 12 && hour < 17) return "Good afternoon! Keep up the momentum.";
    if (hour >= 17 && hour < 22) return "Good evening! Great job showing up today.";
    return "Late night study? Remember to rest!";
  };

  const [confidenceStats, setConfidenceStats] = useState({
    confident: 0,
    comfortable: 0,
    revised: 0,
    learning: 0,
    not_started: 0
  });

  const [stats, setStats] = useState({
    progress_percentage: 0,
    study_trend: [
      { date: 'Mon', minutes: 0 },
      { date: 'Tue', minutes: 0 },
      { date: 'Wed', minutes: 0 },
      { date: 'Thu', minutes: 0 },
      { date: 'Fri', minutes: 0 },
      { date: 'Sat', minutes: 0 },
      { date: 'Sun', minutes: 0 },
    ],
    total_study_minutes_7d: 0,
    neglected_chapters: [] as string[],
    subject_balance: { physics: 0, chemistry: 0, biology: 0 }
  });

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [dailyFact, setDailyFact] = useState<FactOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const p1 = apiClient.dashboard.getStats().then(setStats).catch(console.error);
    
    const p2 = apiClient.confidence.list().then(items => {
      const stats = {
        confident: 0, comfortable: 0, revised: 0, learning: 0, not_started: 0
      };
      items.forEach(item => {
        if (stats[item.status as keyof typeof stats] !== undefined) {
          stats[item.status as keyof typeof stats]++;
        }
      });
      setConfidenceStats(stats);
    }).catch(console.error);
    
    const p3 = apiClient.dailyLog.getHistory().then(history => {
      setStreakData(calculateStreak(history));
    }).catch(console.error);

    const p4 = apiClient.facts.getRandom(1)
      .then(res => {
        if (res && res.length > 0) setDailyFact(res[0]);
      })
      .catch(console.error);
      
    Promise.all([p1, p2, p3, p4]).finally(() => setIsLoading(false));
  }, []);

  const studyData = stats.study_trend;

  const confidenceData = [
    { name: 'Confident', value: confidenceStats.confident, color: '#06ffa5' },
    { name: 'Comfortable', value: confidenceStats.comfortable, color: '#8b5cf6' },
    { name: 'Revised', value: confidenceStats.revised, color: '#f59e0b' },
    { name: 'Learning', value: confidenceStats.learning, color: '#06b6d4' },
    { name: 'Not Started', value: confidenceStats.not_started, color: '#334155' },
  ].filter(d => d.value > 0);

  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-5xl mx-auto w-full relative">
      {/* Animated Ambient Background */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet/5 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-400/5 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-foreground hidden sm:block" />
          <div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">{getGreeting()}</h2>
            <p className="text-secondary text-sm mt-1 uppercase tracking-wider">Your Personal Dashboard</p>
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 glass-strong px-4 py-2 rounded-full border border-border-glass shrink-0 opacity-70">
            <Loader2 className="w-4 h-4 text-secondary animate-spin" />
            <span className="text-secondary text-sm font-medium">Connecting...</span>
          </div>
        ) : (streakData && streakData.currentStreak > 0) ? (
          <div className="flex items-center gap-2 glass-strong px-4 py-2 rounded-full shadow-glow-accent-sm border border-accent/20 shrink-0">
            <Flame className="w-5 h-5 text-accent animate-pulse" />
            <span className="text-foreground font-bold">{streakData.currentStreak} Day Streak!</span>
          </div>
        ) : null}
      </div>

      {/* Daily Affirmation Widget - Styled cleaner without borders/orbs */}
      <div className="mb-6 py-4 px-6 glass-strong rounded-2xl border border-white/5 flex items-center justify-center text-center relative overflow-hidden bg-gradient-to-r from-violet/5 via-surface/50 to-amber-400/5 shadow-sm">
        <p className="text-sm md:text-base font-medium text-foreground/80 tracking-wide z-10">
          "<span className="italic">{dailyAffirmation}</span>"
        </p>
      </div>

      {/* Alerts (Neglected Chapters / Recovery) */}
      {stats.neglected_chapters && stats.neglected_chapters.length > 0 && (
        <div className="mb-6 p-5 glass-strong rounded-2xl border border-secondary/20 shadow-glass-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-strong border border-border-glass flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm tracking-tight mb-0.5">Time for a quick review?</h3>
              <p className="text-sm text-secondary">
                You haven't touched these in 14+ days: <span className="text-foreground/90 font-medium">{stats.neglected_chapters.join(', ')}</span>
              </p>
            </div>
          </div>
          <button onClick={() => window.location.hash = '#/tests'} className="btn-secondary px-5 py-2 text-sm shrink-0 whitespace-nowrap">
            Take a Test
          </button>
        </div>
      )}

      {streakData?.isRecoveryMode && (
        <div className="mb-6 p-6 glass-strong rounded-3xl border border-violet/20 shadow-glow-violet bg-gradient-to-r from-violet/5 to-transparent flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HeartHandshake className="w-5 h-5 text-violet" />
              <h3 className="font-semibold text-foreground tracking-tight">Recovery Mode</h3>
            </div>
            <p className="text-sm text-foreground/80 font-medium italic">"{streakData.recoveryQuote}"</p>
          </div>
          <button onClick={() => window.location.hash = '#/daily-log'} className="btn-accent px-6 py-2 shrink-0">
            Log Today's Session
          </button>
        </div>
      )}

      {/* Study Time Chart & Activity Strip (Moved Up) */}
      <div className="glass rounded-3xl p-6 lg:p-8 mb-6 relative z-10">
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground tracking-tight text-lg mb-1">Study Time Trend</h3>
            <p className="text-xs text-secondary tracking-wide uppercase">Past 7 Days</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-foreground tracking-tight">{stats.total_study_minutes_7d} <span className="text-base text-secondary font-medium">mins</span></span>
          </div>
        </div>
        
        {/* 7-Day Activity Strip */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 mb-8 px-0 sm:px-2 md:px-8">
          {stats.study_trend.map((day, i) => {
            const isActive = day.minutes > 0;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    isActive 
                      ? 'bg-accent text-white shadow-glow-accent scale-110' 
                      : 'border-2 border-border-glass text-secondary bg-surface-strong'
                  }`}
                  title={`${day.minutes} mins`}
                >
                  {isActive ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <span className="opacity-50">-</span>}
                </div>
                <span className="text-[10px] uppercase text-secondary font-medium tracking-wider">{day.date}</span>
              </div>
            );
          })}
        </div>
        
        <div className="h-64 relative">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-xl">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={studyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: '1px solid rgba(255,255,255,0.10)', 
                  background: 'rgba(20,20,25,0.95)', 
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  fontSize: '13px',
                  color: '#fafafa',
                }}
              />
              <Area type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorMinutes)" activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 3, filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.6))' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid 2: Progress, Balance, Confidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 relative z-10">
        
        {/* Completion Progress */}
        <div className="glass rounded-3xl p-6 flex flex-col items-center text-center lg:col-span-1">
          <h3 className="font-semibold text-foreground mb-1 tracking-tight">Marks-Weighted Progress</h3>
          <p className="text-xs text-secondary mb-6 tracking-wide">CONFIDENCE VS WEIGHTAGE</p>
          
          <div className="relative w-36 h-36 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <circle cx="72" cy="72" r="60" stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none" />
              <circle 
                cx="72" cy="72" r="60" 
                stroke="url(#progressGrad)" 
                strokeWidth="10" fill="none" 
                strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={2 * Math.PI * 60 * (1 - Math.min(stats.progress_percentage, 100) / 100)}
                strokeLinecap="round"
                filter="url(#glow)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-foreground tracking-tighter">{Math.min(stats.progress_percentage, 100)}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/15">
            <CheckCircle2 className="w-4 h-4" />
            {stats.progress_percentage >= 50 ? 'On track' : 'Needs attention'}
          </div>
        </div>

        {/* Subject Balance Indicator */}
        <div className="glass rounded-3xl p-6 flex flex-col justify-center lg:col-span-1">
          <h3 className="font-semibold text-foreground mb-1 tracking-tight">Subject Balance</h3>
          <p className="text-xs text-secondary mb-6 tracking-wide">PAST 7 DAYS TIME RATIO</p>
          
          <div className="space-y-4 w-full">
            {[
              { label: 'Biology', val: stats.subject_balance?.biology || 0, color: 'bg-emerald-400', glow: 'shadow-[0_0_12px_rgba(52,211,153,0.5)]' },
              { label: 'Chemistry', val: stats.subject_balance?.chemistry || 0, color: 'bg-amber-400', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.5)]' },
              { label: 'Physics', val: stats.subject_balance?.physics || 0, color: 'bg-violet', glow: 'shadow-[0_0_12px_rgba(139,92,246,0.5)]' },
            ].map(subj => {
              const total = (stats.subject_balance?.biology || 0) + (stats.subject_balance?.chemistry || 0) + (stats.subject_balance?.physics || 0);
              const pct = total > 0 ? (subj.val / total) * 100 : 0;
              return (
                <div key={subj.label} className="w-full">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-secondary">{subj.label}</span>
                    <span className="text-foreground font-semibold">{subj.val} m</span>
                  </div>
                  <div className="w-full h-2 bg-surface-strong rounded-full overflow-hidden border border-border-glass">
                    <div 
                      className={`h-full ${subj.color} ${subj.glow} rounded-full transition-all duration-1000`}
                      style={{ width: `${Math.max(pct, 5)}%` }} // Minimum 5% width so it's visible
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-secondary mt-5 text-center leading-relaxed">
            {(stats.subject_balance?.physics || 0) > 0 || (stats.subject_balance?.biology || 0) > 0 || (stats.subject_balance?.chemistry || 0) > 0
              ? "A balanced diet of PCB is key to success! Keep mixing it up."
              : "No study time recorded yet this week."}
          </p>
        </div>

        {/* Confidence Breakdown */}
        <div className="glass rounded-3xl p-6 flex flex-col lg:col-span-1">
          <div className="text-center md:text-left mb-4">
            <h3 className="font-semibold text-foreground mb-1 tracking-tight">Chapter Confidence</h3>
            <p className="text-xs text-secondary tracking-wide uppercase">Distribution across syllabus</p>
          </div>
          <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-8">
            <div className="w-full h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={confidenceData}
                    cx="50%" cy="50%"
                    innerRadius={65} outerRadius={85}
                    paddingAngle={3} dataKey="value"
                    stroke="none"
                  >
                    {confidenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.10)', 
                      background: 'rgba(20,20,25,0.95)', 
                      backdropFilter: 'blur(16px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      fontSize: '13px',
                      color: '#fafafa',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner glow shadow overlay */}
              <div className="absolute inset-0 pointer-events-none rounded-full shadow-[inset_0_0_20px_rgba(0,0,0,0.4)]" style={{ margin: 'auto', width: '130px', height: '130px' }} />
            </div>
            
            {/* Legend as structured list */}
            <div className="w-full flex flex-col justify-center gap-2">
              {confidenceData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-xs glass-strong px-3 py-1.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }} />
                    <span className="text-secondary font-medium">{entry.name}</span>
                  </div>
                  <span className="text-foreground font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid 1: Daily Byte + MCQ (Moved Down) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {dailyFact && (
          <div className="glass rounded-2xl p-5 shadow-glass-sm border-l-4 border-l-amber-400 relative overflow-hidden group h-full flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Lightbulb className="w-16 h-16 text-amber-400" />
            </div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">NCERT Daily Byte</h3>
              </div>
              <p className="text-foreground/90 font-medium md:text-lg leading-relaxed flex-1">
                "{dailyFact.fact_text}"
              </p>
              <div className="mt-4 text-xs text-secondary font-medium">
                Source: {dailyFact.chapter_name} • {dailyFact.subject}
              </div>
            </div>
          </div>
        )}
        
        <QuickMCQWidget />
      </div>

    </div>
  );
}
