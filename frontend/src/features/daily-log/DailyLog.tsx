import { useState, useEffect, useMemo } from 'react';
import { 
  CalendarDays, 
  Clock, 
  BookOpen, 
  PenTool, 
  CheckCircle2, 
  History, 
  Search, 
  Sparkles, 
  Flame, 
  Zap, 
  Beaker, 
  Dna,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
  TrendingUp
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import CustomSelect from '../../components/CustomSelect';
import { apiClient, type StudySession } from '../../core/api-client';
import { NEET_SYLLABUS } from '../../core/syllabus';

export default function DailyLog() {
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [notes, setNotes] = useState('');
  
  // Date state for logging: 'today' | 'yesterday' | 'custom'
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<StudySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Chart Timeframe State: '7d' | '30d' | '90d' | 'all'
  const [chartTimeframe, setChartTimeframe] = useState<'7d' | '30d' | '90d' | 'all'>('all');

  // Search & History Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('All');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('All');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<StudySession | null>(null);

  // Expanded Month Accordions state (default all expanded)
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // Get formatted today & yesterday string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const getEffectiveDate = () => {
    if (dateMode === 'today') return todayStr;
    if (dateMode === 'yesterday') return yesterdayStr;
    return customDate;
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await apiClient.dailyLog.getHistory(500);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch daily log history', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !chapter || !timeSpent || isSubmitting) return;

    setIsSubmitting(true);
    const sessionDate = getEffectiveDate();

    try {
      await apiClient.dailyLog.logSession(
        subject,
        chapter,
        parseInt(timeSpent, 10),
        notes,
        sessionDate
      );
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        try { navigator.vibrate([30, 50, 30]); } catch (e) {}
      }

      setToastMessage(`Saved! ${subject} - ${chapter} (${timeSpent}m)`);
      setTimeout(() => setToastMessage(null), 4000);

      // Reset form fields smoothly without hiding form
      setChapter('');
      setTimeSpent('');
      setNotes('');
      fetchHistory();
    } catch (error) {
      console.error('Failed to log session', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickTime = (mins: number) => {
    setTimeSpent(mins.toString());
  };

  const handleSelectSubjectCard = (subjName: string) => {
    setSubject(subjName);
    setChapter('');
  };

  // Aggregated Overall Stats
  const totalStats = useMemo(() => {
    let totalMins = 0;
    const subjectMins: Record<string, number> = { Physics: 0, Chemistry: 0, Biology: 0 };

    history.forEach(s => {
      totalMins += s.time_spent_mins || 0;
      if (subjectMins[s.subject] !== undefined) {
        subjectMins[s.subject] += s.time_spent_mins || 0;
      }
    });

    return {
      totalHours: (totalMins / 60).toFixed(1),
      totalSessions: history.length,
      subjectMins
    };
  }, [history]);

  // ── All-Days Study Chart Data Generation ──
  const chartData = useMemo(() => {
    const dateMinsMap: Record<string, number> = {};
    history.forEach(s => {
      const dKey = s.created_at ? s.created_at.split('T')[0] : '';
      if (dKey) {
        dateMinsMap[dKey] = (dateMinsMap[dKey] || 0) + (s.time_spent_mins || 0);
      }
    });

    const now = new Date();
    let daysToInclude = 7;
    if (chartTimeframe === '30d') daysToInclude = 30;
    if (chartTimeframe === '90d') daysToInclude = 90;

    let resultData: Array<{ date: string; fullDate: string; hours: number; mins: number }> = [];

    if (chartTimeframe === 'all') {
      const allDates = Object.keys(dateMinsMap).sort((a, b) => a.localeCompare(b));
      if (allDates.length === 0) {
        allDates.push(todayStr);
      }
      resultData = allDates.map(dKey => {
        const mins = dateMinsMap[dKey] || 0;
        const dObj = new Date(dKey + 'T00:00:00');
        const dateLabel = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return {
          date: dateLabel,
          fullDate: dKey,
          hours: parseFloat((mins / 60).toFixed(1)),
          mins
        };
      });
    } else {
      for (let i = daysToInclude - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dKey = d.toISOString().split('T')[0];
        const mins = dateMinsMap[dKey] || 0;
        const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        resultData.push({
          date: dateLabel,
          fullDate: dKey,
          hours: parseFloat((mins / 60).toFixed(1)),
          mins
        });
      }
    }

    let peakHours = 0;
    let peakDate = '';
    let activeDaysCount = 0;
    let sumHours = 0;

    resultData.forEach(item => {
      if (item.hours > peakHours) {
        peakHours = item.hours;
        peakDate = item.date;
      }
      if (item.hours > 0) {
        activeDaysCount++;
        sumHours += item.hours;
      }
    });

    const avgHours = activeDaysCount > 0 ? (sumHours / activeDaysCount).toFixed(1) : '0';

    return {
      points: resultData,
      peakHours,
      peakDate,
      activeDaysCount,
      avgHours
    };
  }, [history, chartTimeframe, todayStr]);

  // Extract distinct Month options (YYYY-MM) from history
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    history.forEach(s => {
      if (s.created_at) {
        const yyyyMm = s.created_at.substring(0, 7);
        monthsSet.add(yyyyMm);
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [history]);

  const formatMonthLabel = (yyyyMm: string) => {
    if (yyyyMm === 'All') return 'All Months';
    const [year, month] = yyyyMm.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(s => {
      const sessionDate = s.created_at ? s.created_at.split('T')[0] : '';
      const sessionMonth = s.created_at ? s.created_at.substring(0, 7) : '';

      const matchesSubject = selectedSubjectFilter === 'All' || s.subject === selectedSubjectFilter;
      const matchesMonth = selectedMonthFilter === 'All' || sessionMonth === selectedMonthFilter;
      const matchesExactDate = !selectedDateFilter || sessionDate === selectedDateFilter;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        s.chapter_name.toLowerCase().includes(q) || 
        s.subject.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      return matchesSubject && matchesMonth && matchesExactDate && matchesQuery;
    });
  }, [history, selectedSubjectFilter, selectedMonthFilter, selectedDateFilter, searchQuery]);

  // Group by Month -> Date
  const monthGroups = useMemo(() => {
    const monthMap: { [monthKey: string]: { [dateKey: string]: StudySession[] } } = {};

    filteredHistory.forEach(s => {
      const dateKey = s.created_at ? s.created_at.split('T')[0] : 'Unknown Date';
      const monthKey = dateKey.substring(0, 7);

      if (!monthMap[monthKey]) monthMap[monthKey] = {};
      if (!monthMap[monthKey][dateKey]) monthMap[monthKey][dateKey] = [];
      monthMap[monthKey][dateKey].push(s);
    });

    const sortedMonths = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));
    
    return sortedMonths.map(monthKey => {
      const datesObj = monthMap[monthKey];
      const sortedDates = Object.keys(datesObj).sort((a, b) => b.localeCompare(a));
      
      let monthTotalMins = 0;
      let monthTotalSessions = 0;

      sortedDates.forEach(dKey => {
        datesObj[dKey].forEach(sess => {
          monthTotalMins += sess.time_spent_mins || 0;
          monthTotalSessions += 1;
        });
      });

      return {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        totalMins: monthTotalMins,
        totalSessions: monthTotalSessions,
        dates: sortedDates.map(dateKey => ({
          dateKey,
          dateLabel: dateKey === todayStr ? 'Today' : dateKey === yesterdayStr ? 'Yesterday' : new Date(dateKey + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          sessions: datesObj[dateKey]
        }))
      };
    });
  }, [filteredHistory, todayStr, yesterdayStr]);

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const getSubjectBadgeStyle = (subj: string) => {
    switch (subj) {
      case 'Biology':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400 font-medium',
          border: 'border-emerald-500/20',
          icon: <Dna className="w-3.5 h-3.5 text-emerald-400" />
        };
      case 'Physics':
        return {
          bg: 'bg-violet-500/10',
          text: 'text-violet-400 font-medium',
          border: 'border-violet-500/20',
          icon: <Zap className="w-3.5 h-3.5 text-violet-400" />
        };
      case 'Chemistry':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400 font-medium',
          border: 'border-amber-500/20',
          icon: <Beaker className="w-3.5 h-3.5 text-amber-400" />
        };
      default:
        return {
          bg: 'bg-surface',
          text: 'text-secondary font-medium',
          border: 'border-border-glass',
          icon: <BookOpen className="w-3.5 h-3.5 text-muted" />
        };
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedSubjectFilter('All');
    setSelectedMonthFilter('All');
    setSelectedDateFilter('');
  };

  return (
    <div className="h-full overflow-y-auto pb-28 scrollbar-hide p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8 relative">
      {/* Soft Ambient Background Orbs */}
      <div className="absolute top-0 right-0 w-[350px] h-[350px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-[350px] h-[350px] bg-violet/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Studio Header & Bento Stats ── */}
      <div className="space-y-6 animate-fade-in-up relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glass-sm">
              <CalendarDays className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Daily Study Studio</h2>
              <p className="text-xs text-secondary mt-0.5">Track every milestone on your path to NEET 2027</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface backdrop-blur-md px-3.5 py-1.5 rounded-full border border-border-glass">
            <Flame className="w-4 h-4 text-accent fill-accent/20" />
            <span className="text-xs text-foreground font-medium">NEET 2027 Study Vault</span>
          </div>
        </div>

        {/* Bento Overview Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass p-4 rounded-2xl border border-border-glass">
            <div className="text-xs text-secondary mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" /> Total Hours
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totalStats.totalHours} <span className="text-xs font-normal text-muted">hrs</span>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl border border-border-glass">
            <div className="text-xs text-secondary mb-1 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-400" /> Sessions Logged
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {totalStats.totalSessions} <span className="text-xs font-normal text-muted">total</span>
            </div>
          </div>

          <div className="glass p-4 rounded-2xl border border-border-glass col-span-2">
            <div className="text-xs text-secondary mb-2 flex items-center justify-between">
              <span>Subject Balance</span>
              <span className="text-[10px] text-muted">Hours distribution</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <Dna className="w-3 h-3" /> Bio
                </span>
                <span className="text-[11px] font-semibold text-foreground">{Math.round((totalStats.subjectMins.Biology || 0)/60)}h</span>
              </div>
              <div className="flex-1 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-medium text-violet-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Phy
                </span>
                <span className="text-[11px] font-semibold text-foreground">{Math.round((totalStats.subjectMins.Physics || 0)/60)}h</span>
              </div>
              <div className="flex-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                  <Beaker className="w-3 h-3" /> Chem
                </span>
                <span className="text-[11px] font-semibold text-foreground">{Math.round((totalStats.subjectMins.Chemistry || 0)/60)}h</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Logger Form Card ── */}
      <form onSubmit={handleSubmit} className="space-y-6 glass-strong rounded-3xl p-6 md:p-8 border border-border-glass relative overflow-hidden shadow-glass-sm">
        
        {/* Inline Toast Banner */}
        {toastMessage && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-2xl flex items-center gap-2.5 animate-fade-in text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Date Selector Row */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              Date of Study
            </span>
            <span className="text-[11px] text-muted normal-case font-normal">Missed yesterday? Select it below!</span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDateMode('today')}
              className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all border ${
                dateMode === 'today'
                  ? 'bg-accent/20 border-accent text-accent shadow-glow-accent-sm'
                  : 'glass border-border-glass text-secondary hover:text-foreground'
              }`}
            >
              Today ({new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
            </button>

            <button
              type="button"
              onClick={() => setDateMode('yesterday')}
              className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all border ${
                dateMode === 'yesterday'
                  ? 'bg-accent/20 border-accent text-accent shadow-glow-accent-sm'
                  : 'glass border-border-glass text-secondary hover:text-foreground'
              }`}
            >
              Yesterday ({new Date(Date.now() - 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
            </button>

            <button
              type="button"
              onClick={() => setDateMode('custom')}
              className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all border ${
                dateMode === 'custom'
                  ? 'bg-accent/20 border-accent text-accent shadow-glow-accent-sm'
                  : 'glass border-border-glass text-secondary hover:text-foreground'
              }`}
            >
              Custom Date
            </button>

            {dateMode === 'custom' && (
              <input
                type="date"
                value={customDate}
                max={todayStr}
                onChange={e => setCustomDate(e.target.value)}
                className="glass-input px-3 py-1.5 text-xs text-foreground border-accent/40 rounded-xl focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Visual 1-Tap Subject Selector Cards */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            Subject & Chapter
          </label>

          <div className="grid grid-cols-3 gap-2.5 pb-1">
            {[
              { name: 'Biology', icon: <Dna className="w-4 h-4" />, activeColor: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' },
              { name: 'Physics', icon: <Zap className="w-4 h-4" />, activeColor: 'bg-violet-500/15 border-violet-500/50 text-violet-300' },
              { name: 'Chemistry', icon: <Beaker className="w-4 h-4" />, activeColor: 'bg-amber-500/15 border-amber-500/50 text-amber-300' }
            ].map(subjCard => (
              <button
                key={subjCard.name}
                type="button"
                onClick={() => handleSelectSubjectCard(subjCard.name)}
                className={`p-3 rounded-2xl border text-xs font-medium transition-all flex flex-col items-center gap-1.5 active-scale ${
                  subject === subjCard.name
                    ? `${subjCard.activeColor} shadow-glass-sm`
                    : 'glass border-border-glass text-secondary hover:text-foreground'
                }`}
              >
                {subjCard.icon}
                <span>{subjCard.name}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 pt-1">
            <CustomSelect
              value={chapter}
              onChange={setChapter}
              placeholder={subject ? `Select ${subject} Chapter...` : 'Select Subject first...'}
              options={subject && NEET_SYLLABUS[subject] ? NEET_SYLLABUS[subject].map(ch => ({ value: ch, label: ch })) : []}
            />
          </div>
        </div>

        {/* Time Spent Input with Quick Chips */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent" />
              Duration
            </span>
            <span className="text-[11px] text-muted normal-case font-normal">Quick Select:</span>
          </label>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
            {[30, 45, 60, 90, 120, 180].map(mins => (
              <button
                key={mins}
                type="button"
                onClick={() => handleQuickTime(mins)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all border shrink-0 ${
                  timeSpent === mins.toString()
                    ? 'bg-accent/20 border-accent text-accent shadow-glow-accent-sm'
                    : 'glass border-border-glass text-secondary hover:text-foreground'
                }`}
              >
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input 
              type="number"
              value={timeSpent}
              onChange={e => setTimeSpent(e.target.value)}
              placeholder="e.g. 45"
              min="1"
              className="glass-input px-4 py-3 text-sm w-36 font-semibold"
              required
            />
            <span className="text-sm font-medium text-secondary">minutes studied</span>
          </div>
        </div>

        {/* Quick Notes */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <PenTool className="w-4 h-4 text-accent" />
            Study Notes & Topics Covered (Optional)
          </label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Completed 30 NCERT line questions on Genetics, revised formula sheet..."
            className="w-full glass-input px-4 py-3 text-sm resize-none min-h-[84px]"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={!subject || !chapter || !timeSpent || isSubmitting}
            className="btn-accent w-full py-3.5 flex justify-center items-center gap-2 font-medium tracking-wide text-sm active-scale"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving to Vault...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Log Study Session
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── All-Days Study Analytics & Trend Graph ── */}
      <div className="glass-strong rounded-3xl p-6 border border-border-glass shadow-glass-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-bold text-base text-foreground tracking-tight">All-Days Study Trend Graph</h3>
              <p className="text-xs text-muted">Visual timeline of study hours logged across your journey</p>
            </div>
          </div>

          {/* Timeframe Selector Pills */}
          <div className="flex items-center gap-1 glass p-1 rounded-xl border border-border-glass self-start sm:self-auto">
            {[
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' }
            ].map(tf => (
              <button
                key={tf.id}
                type="button"
                onClick={() => setChartTimeframe(tf.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  chartTimeframe === tf.id
                    ? 'bg-accent/20 text-accent border border-accent/40 shadow-glass-sm'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Peak & Average Study Metrics Banner */}
        <div className="grid grid-cols-3 gap-2 glass p-3 rounded-2xl border border-border-glass text-center">
          <div>
            <span className="text-[10px] text-muted block uppercase font-semibold">Active Days</span>
            <span className="text-sm font-semibold text-foreground">{chartData.activeDaysCount} days</span>
          </div>
          <div className="border-x border-border-glass">
            <span className="text-[10px] text-muted block uppercase font-semibold">Daily Avg</span>
            <span className="text-sm font-semibold text-accent">{chartData.avgHours} hrs/day</span>
          </div>
          <div>
            <span className="text-[10px] text-muted block uppercase font-semibold">Peak Day</span>
            <span className="text-sm font-semibold text-foreground">
              {chartData.peakHours > 0 ? `${chartData.peakHours}h (${chartData.peakDate})` : '0h'}
            </span>
          </div>
        </div>

        {/* Recharts Area Trend Component */}
        <div className="h-52 w-full pt-2">
          {chartData.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.points} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="studyTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff8a3d" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ff8a3d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  unit="h"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="glass p-3 rounded-xl border border-border-glass shadow-glass-sm text-xs space-y-1">
                          <p className="font-semibold text-foreground">{data.fullDate}</p>
                          <p className="text-accent font-bold">{data.hours} hrs ({data.mins} mins)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#ff8a3d" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#studyTrendGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              No study trend data available.
            </div>
          )}
        </div>
      </div>

      {/* ── NEET 2027 Study Vault & Multi-Filter Section ── */}
      <div className="space-y-6 pt-4 relative z-10">
        
        {/* Vault Section Title & Controls Bar */}
        <div className="space-y-4 border-b border-border-glass pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-bold text-lg text-foreground tracking-tight flex items-center gap-2">
                  Study Vault & Archive
                  <span className="text-xs bg-surface border border-border-glass text-secondary px-2.5 py-0.5 rounded-full font-medium">
                    {filteredHistory.length} sessions
                  </span>
                </h3>
                <p className="text-xs text-muted">Jump to any date, month, or topic across 300+ days</p>
              </div>
            </div>

            {(searchQuery || selectedSubjectFilter !== 'All' || selectedMonthFilter !== 'All' || selectedDateFilter) && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-medium text-accent hover:underline flex items-center gap-1 self-start md:self-auto"
              >
                <X className="w-3.5 h-3.5" /> Clear active filters
              </button>
            )}
          </div>

          {/* Multi-filter Control Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 glass p-3.5 rounded-2xl border border-border-glass">
            
            {/* 1. Text Search */}
            <div className="relative md:col-span-1">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search topic or notes..."
                className="w-full glass-input text-xs pl-8 pr-7 py-2 rounded-xl"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. Subject Filter Tabs */}
            <div className="flex items-center gap-1 glass p-1 rounded-xl border border-border-glass overflow-x-auto scrollbar-hide">
              {['All', 'Biology', 'Physics', 'Chemistry'].map(subj => (
                <button
                  key={subj}
                  onClick={() => setSelectedSubjectFilter(subj)}
                  className={`flex-1 min-w-[48px] py-1 text-[11px] font-medium rounded-lg transition-all text-center ${
                    selectedSubjectFilter === subj
                      ? 'bg-accent/20 text-accent border border-accent/40 shadow-glass-sm'
                      : 'text-secondary hover:text-foreground'
                  }`}
                >
                  {subj === 'All' ? 'All' : subj.substring(0, 3)}
                </button>
              ))}
            </div>

            {/* 3. Month Quick-Jump Select */}
            <div>
              <select
                value={selectedMonthFilter}
                onChange={e => setSelectedMonthFilter(e.target.value)}
                className="w-full glass-input text-xs px-3 py-2 rounded-xl text-foreground focus:outline-none cursor-pointer"
              >
                <option value="All" className="bg-[#08090c] text-foreground">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m} className="bg-[#08090c] text-foreground">
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Jump to Specific Date Picker */}
            <div className="relative">
              <input
                type="date"
                value={selectedDateFilter}
                max={todayStr}
                onChange={e => setSelectedDateFilter(e.target.value)}
                className="w-full glass-input text-xs px-3 py-2 rounded-xl text-foreground focus:outline-none"
              />
              {selectedDateFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedDateFilter('')}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* History Month-Wise Accordion & Day Timeline */}
        {historyLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-xs text-muted">Loading study vault...</p>
          </div>
        ) : monthGroups.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center flex flex-col items-center justify-center relative overflow-hidden border border-border-glass">
            <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <Filter className="w-8 h-8 text-accent/60" />
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1">No Study Logs Found</h4>
            <p className="text-xs text-secondary max-w-sm mb-4">
              {searchQuery || selectedSubjectFilter !== 'All' || selectedMonthFilter !== 'All' || selectedDateFilter
                ? 'No study sessions matched your current search/date filters.'
                : 'Start logging your study sessions above to build your NEET 2027 vault archive!'}
            </p>
            {(searchQuery || selectedSubjectFilter !== 'All' || selectedMonthFilter !== 'All' || selectedDateFilter) && (
              <button 
                onClick={clearAllFilters}
                className="btn-accent px-5 py-2.5 text-xs font-medium rounded-2xl text-white"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {monthGroups.map(mGroup => {
              const isCollapsed = collapsedMonths[mGroup.monthKey];
              const monthHours = (mGroup.totalMins / 60).toFixed(1);

              return (
                <div key={mGroup.monthKey} className="glass-strong rounded-3xl border border-border-glass overflow-hidden shadow-glass-sm transition-all">
                  
                  {/* Month Accordion Header */}
                  <div 
                    onClick={() => toggleMonthCollapse(mGroup.monthKey)}
                    className="p-4 md:p-5 flex items-center justify-between cursor-pointer hover:bg-surface-hover transition-colors border-b border-border-glass"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{mGroup.monthLabel}</h4>
                        <p className="text-xs text-muted">
                          {mGroup.totalSessions} sessions logged
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {monthHours} hrs total
                      </span>
                      <button className="text-muted hover:text-foreground">
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Days Timeline Content */}
                  {!isCollapsed && (
                    <div className="p-4 md:p-6 space-y-6 relative before:absolute before:left-7 md:before:left-9 before:top-6 before:bottom-6 before:w-0.5 before:bg-border-glass">
                      {mGroup.dates.map(dGroup => {
                        const dayMins = dGroup.sessions.reduce((acc, curr) => acc + (curr.time_spent_mins || 0), 0);
                        const dayHoursStr = dayMins >= 60 ? `${(dayMins / 60).toFixed(1)} hrs` : `${dayMins} mins`;

                        return (
                          <div key={dGroup.dateKey} className="space-y-3 relative pl-8 md:pl-10">
                            {/* Dot indicator */}
                            <div className="absolute left-1 md:left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-background border-2 border-accent shadow-glow-accent-sm -translate-x-1/2" />
                            
                            {/* Date sub-header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h5 className="text-xs font-semibold text-foreground">{dGroup.dateLabel}</h5>
                                <span className="text-[10px] text-muted">({dGroup.dateKey})</span>
                              </div>
                              <span className="text-[10px] font-medium text-secondary glass px-2 py-0.5 rounded-md border border-border-glass">
                                {dayHoursStr}
                              </span>
                            </div>

                            {/* Session Cards */}
                            <div className="grid grid-cols-1 gap-2.5">
                              {dGroup.sessions.map(session => {
                                const badgeStyle = getSubjectBadgeStyle(session.subject);
                                return (
                                  <div 
                                    key={session.id}
                                    onClick={() => setSelectedSessionForModal(session)}
                                    className="glass hover:bg-surface-hover p-4 rounded-2xl border border-border-glass transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-glass-sm flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                                  >
                                    <div className="space-y-1.5 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {/* Subject Badge */}
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                                          {badgeStyle.icon}
                                          {session.subject}
                                        </span>

                                        {/* Time Badge */}
                                        <span className="text-[11px] font-medium text-accent bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-accent" />
                                          {session.time_spent_mins} mins
                                        </span>
                                      </div>

                                      <h6 className="text-xs md:text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                                        {session.chapter_name}
                                      </h6>

                                      {session.notes && (
                                        <p className="text-xs text-secondary/90 italic glass p-2.5 rounded-xl border border-border-glass line-clamp-2 leading-relaxed">
                                          "{session.notes}"
                                        </p>
                                      )}
                                    </div>

                                    <div className="text-right md:self-center shrink-0">
                                      <span className="text-[10px] text-muted block">
                                        {new Date(session.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal for Full Notes Inspection ── */}
      {selectedSessionForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-strong rounded-3xl p-6 md:p-8 max-w-lg w-full border border-border-glass shadow-glass border-border-glass relative space-y-5 animate-scale-up">
            <button 
              onClick={() => setSelectedSessionForModal(null)}
              className="absolute right-5 top-5 text-muted hover:text-foreground p-2 glass rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs ${getSubjectBadgeStyle(selectedSessionForModal.subject).bg} ${getSubjectBadgeStyle(selectedSessionForModal.subject).text} ${getSubjectBadgeStyle(selectedSessionForModal.subject).border}`}>
                {getSubjectBadgeStyle(selectedSessionForModal.subject).icon}
                {selectedSessionForModal.subject}
              </span>
              <span className="text-xs font-medium text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full">
                {selectedSessionForModal.time_spent_mins} Mins
              </span>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-foreground">{selectedSessionForModal.chapter_name}</h3>
              <p className="text-xs text-muted mt-1">Logged on {new Date(selectedSessionForModal.created_at).toLocaleString()}</p>
            </div>

            {selectedSessionForModal.notes ? (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary">Study Notes</h4>
                <div className="glass p-4 rounded-2xl border border-border-glass text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-hide">
                  {selectedSessionForModal.notes}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted italic">No notes were written for this session.</p>
            )}

            <button
              onClick={() => setSelectedSessionForModal(null)}
              className="glass hover:bg-surface-hover w-full py-3 rounded-2xl text-xs font-semibold text-foreground border border-border-glass"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
