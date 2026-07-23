import { useState, useEffect } from 'react';
import { LayoutDashboard, CheckCircle2, Flame, HeartHandshake } from 'lucide-react';
import { apiClient } from '../../core/api-client';
import { calculateStreak, type StreakData } from '../../utils/streak-calculator';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function Dashboard() {
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
    total_study_minutes_7d: 0
  });

  const [streakData, setStreakData] = useState<StreakData | null>(null);

  useEffect(() => {
    apiClient.dashboard.getStats().then(setStats).catch(console.error);
    apiClient.confidence.list().then(items => {
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
    
    apiClient.dailyLog.getHistory().then(history => {
      setStreakData(calculateStreak(history));
    }).catch(console.error);
  }, []);

  const studyData = stats.study_trend;

  const confidenceData = [
    { name: 'Confident', value: confidenceStats.confident, color: '#3b82f6' },
    { name: 'Comfortable', value: confidenceStats.comfortable, color: '#60a5fa' },
    { name: 'Revised', value: confidenceStats.revised, color: '#93c5fd' },
    { name: 'Learning', value: confidenceStats.learning, color: '#bfdbfe' },
    { name: 'Not Started', value: confidenceStats.not_started, color: '#f1f5f9' },
  ].filter(d => d.value > 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-foreground" />
          <h2 className="text-2xl font-semibold text-foreground">Dashboard</h2>
        </div>
        {streakData && streakData.currentStreak > 0 && (
          <div className="flex items-center gap-2 glass-strong px-4 py-2 rounded-full shadow-glow-accent-sm border border-accent/20">
            <Flame className="w-5 h-5 text-accent animate-pulse" />
            <span className="text-foreground font-bold">{streakData.currentStreak} Day Streak!</span>
          </div>
        )}
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Completion Progress */}
        <div className="glass rounded-3xl p-6 flex flex-col items-center text-center lg:col-span-1">
          <h3 className="font-semibold text-foreground mb-1 tracking-tight">Marks-Weighted Progress</h3>
          <p className="text-xs text-secondary mb-6 tracking-wide">CONFIDENCE VS WEIGHTAGE</p>
          
          <div className="relative w-36 h-36 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <defs>
                <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff8a3d" />
                  <stop offset="100%" stopColor="#ff4d8d" />
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

        {/* Confidence Breakdown */}
        <div className="glass rounded-3xl p-6 flex flex-col lg:col-span-2">
          <div className="text-center md:text-left mb-4">
            <h3 className="font-semibold text-foreground mb-1 tracking-tight">Chapter Confidence</h3>
            <p className="text-xs text-secondary tracking-wide uppercase">Distribution across syllabus</p>
          </div>
          <div className="flex-1 min-h-[200px] flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="w-full md:w-1/2 h-48 relative">
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
            <div className="w-full md:w-1/2 flex flex-col justify-center gap-3">
              {confidenceData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm glass-strong px-4 py-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}80` }} />
                    <span className="text-secondary font-medium">{entry.name}</span>
                  </div>
                  <span className="text-foreground font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Study Time Chart & Activity Strip */}
      <div className="glass rounded-3xl p-6 lg:p-8">
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
        <div className="flex items-center justify-between gap-2 mb-8 px-2 md:px-8">
          {stats.study_trend.map((day, i) => {
            const isActive = day.minutes > 0;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                    isActive 
                      ? 'bg-accent text-white shadow-glow-accent scale-110' 
                      : 'border-2 border-border-glass text-secondary bg-surface-strong'
                  }`}
                  title={`${day.minutes} mins`}
                >
                  {isActive ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span className="opacity-50">-</span>}
                </div>
                <span className="text-[10px] uppercase text-secondary font-medium tracking-wider">{day.date}</span>
              </div>
            );
          })}
        </div>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={studyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff8a3d" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff8a3d" stopOpacity={0}/>
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
              <Area type="monotone" dataKey="minutes" stroke="#ff8a3d" strokeWidth={3} fillOpacity={1} fill="url(#colorMinutes)" activeDot={{ r: 6, fill: '#ff8a3d', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
