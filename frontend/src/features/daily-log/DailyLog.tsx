import { useState, useEffect } from 'react';
import { CalendarDays, Clock, BookOpen, PenTool, CheckCircle2, History } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { apiClient, type StudySession } from '../../core/api-client';
import { NEET_SYLLABUS } from '../../core/syllabus';

export default function DailyLog() {
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<StudySession[]>([]);

  const fetchHistory = async () => {
    try {
      const data = await apiClient.dailyLog.getHistory();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch daily log history', error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.dailyLog.logSession(subject, chapter, parseInt(timeSpent, 10), notes);
      setIsSubmitted(true);
      fetchHistory(); // refresh history
    } catch (error) {
      console.error('Failed to log session', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubject('');
    setChapter('');
    setTimeSpent('');
    setNotes('');
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-4 md:p-8 animate-fade-in-up">
        <div className="glass-strong rounded-3xl p-8 md:p-12 text-center max-w-md w-full relative overflow-hidden">
          {/* Subtle background glow for the success state */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Animated Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-6 shadow-[0_0_32px_rgba(52,211,153,0.25)] animate-[pulse-slow_4s_infinite]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            
            <h2 className="text-3xl font-semibold text-foreground mb-2">Session Logged!</h2>
            <p className="text-muted text-sm mb-8">Great job staying on track today.</p>
            
            {/* Summary Data Box */}
            <div className="glass rounded-2xl w-full p-5 mb-8 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-border-glass pb-3">
                <span className="text-secondary text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Time
                </span>
                <span className="text-foreground font-medium">{timeSpent} mins</span>
              </div>
              <div className="flex items-center justify-between border-b border-border-glass pb-3">
                <span className="text-secondary text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Subject
                </span>
                <span className="text-foreground font-medium">{subject}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-secondary text-sm">Chapter</span>
                <span className="text-foreground font-medium text-right max-w-[150px] truncate" title={chapter}>{chapter}</span>
              </div>
            </div>

            <button 
              onClick={handleReset}
              className="glass hover:bg-surface-hover w-full py-3.5 rounded-2xl text-foreground font-medium transition-all shadow-glass-sm active-scale border border-border-glass"
            >
              Log another session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <CalendarDays className="w-8 h-8 text-foreground" />
        <h2 className="text-2xl font-semibold text-foreground">Daily Study Log</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 glass rounded-3xl p-6 md:p-8 shadow-glass-sm">
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-secondary" />
            Subject & Chapter
          </label>
          <div className="grid grid-cols-2 gap-4">
            <CustomSelect
              value={subject}
              onChange={setSubject}
              placeholder="Select Subject..."
              options={[
                { value: 'Physics', label: 'Physics' },
                { value: 'Chemistry', label: 'Chemistry' },
                { value: 'Biology', label: 'Biology' }
              ]}
            />
            <CustomSelect
              value={chapter}
              onChange={setChapter}
              placeholder="Select Chapter..."
              options={subject && NEET_SYLLABUS[subject] ? NEET_SYLLABUS[subject].map(ch => ({ value: ch, label: ch })) : []}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            Time Spent
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              value={timeSpent}
              onChange={e => setTimeSpent(e.target.value)}
              placeholder="0"
              min="1"
              className="glass-input px-4 py-3 text-sm w-24"
              required
            />
            <span className="text-sm text-secondary">minutes</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <PenTool className="w-4 h-4 text-secondary" />
            Quick Notes (Optional)
          </label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What did you focus on? Any struggles?"
            className="w-full glass-input px-4 py-3 text-sm resize-none min-h-[80px]"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={!subject || !chapter || !timeSpent || isSubmitting}
            className="btn-accent w-full py-3.5 flex justify-center items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Logging...
              </>
            ) : 'Log Session'}
          </button>
        </div>
      </form>

      {/* History Section */}
      {history.length > 0 && (
        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-2 text-foreground mb-4">
            <History className="w-5 h-5 text-secondary" />
            <h3 className="font-semibold">Recent Sessions</h3>
          </div>
          
          <div className="space-y-3">
            {history.map(session => {
              const d = new Date(session.created_at);
              const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              return (
                <div key={session.id} className="glass p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{session.subject}</h4>
                    <p className="text-xs text-secondary mt-0.5 max-w-[200px] truncate">{session.chapter_name}</p>
                    {session.notes && <p className="text-xs text-muted mt-1 italic max-w-[200px] truncate">"{session.notes}"</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-accent">{session.time_spent_mins} <span className="text-xs text-secondary font-medium">mins</span></span>
                    <p className="text-[10px] text-muted mt-1">{dateStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
