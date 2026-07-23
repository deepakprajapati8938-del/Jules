import { useState, useEffect } from 'react';
import { PenTool, Clock, CheckCircle2, ChevronRight, ChevronLeft, Grid3X3, Loader2 } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { apiClient } from '../../core/api-client';
import type { TestOut, TestQuestion, SubmitResult } from '../../core/api-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Tests() {
  const [testState, setTestState] = useState<'setup' | 'taking' | 'review'>('setup');
  const [showPalette, setShowPalette] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // default 60 mins
  
  // Data states
  const [testMode, setTestMode] = useState('mock');
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState('');
  const [testData, setTestData] = useState<TestOut | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  // Map of question_id -> { chosen_ans, marked_for_review }
  const [answers, setAnswers] = useState<Record<number, { chosen_ans: string | null; marked_for_review: boolean }>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (testState === 'taking') {
      interval = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [testState]);

  const handleStartTest = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.tests.generate(
        testMode, 
        30,
        testMode !== 'mock' ? subject : undefined,
        testMode === 'chapter' ? chapter : undefined
      );
      setTestData(data);
      setTimeLeft(data.duration_mins * 60);
      
      const initialAnswers: typeof answers = {};
      data.questions.forEach(q => {
        initialAnswers[q.id] = { chosen_ans: null, marked_for_review: false };
      });
      setAnswers(initialAnswers);
      
      setTestState('taking');
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      alert('Failed to generate test. Ensure you have questions in the database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (opt: string) => {
    if (!testData) return;
    const qId = testData.questions[currentIndex].id;
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...prev[qId], chosen_ans: opt }
    }));
  };

  const handleToggleReview = () => {
    if (!testData) return;
    const qId = testData.questions[currentIndex].id;
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...prev[qId], marked_for_review: !prev[qId].marked_for_review }
    }));
  };

  const handleSubmit = async () => {
    if (!testData) return;
    setIsLoading(true);
    try {
      // Mocking time_taken_seconds to 0 for now since we aren't tracking per-question time precisely
      const payload = testData.questions.map(q => ({
        question_id: q.id,
        chosen_ans: answers[q.id]?.chosen_ans || null,
        time_taken_seconds: 0,
        marked_for_review: answers[q.id]?.marked_for_review || false,
      }));
      
      const result = await apiClient.tests.submit(testData.test_id, payload);
      setSubmitResult(result);
      setTestState('review');
    } catch (err) {
      console.error(err);
      alert('Failed to submit test.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const timerStyle = timeLeft <= 300
    ? 'text-rose-400 bg-rose-400/10 border-rose-400/20'
    : timeLeft <= 600
    ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
    : 'text-secondary bg-surface border-border-glass';

  if (testState === 'taking' && testData) {
    const currentQ = testData.questions[currentIndex];
    const currentAns = answers[currentQ.id];

    return (
      <div className="flex flex-col h-full relative">
        {/* CBT Top Bar */}
        <div className="h-16 border-b border-border-glass flex items-center justify-between px-4 md:px-6 shrink-0 bg-background/80 backdrop-blur-xl shadow-glass-inset">
          <div className="font-semibold text-foreground flex items-center gap-2.5 text-[15px] tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <PenTool className="w-4 h-4 text-accent" /> 
            </div>
            {testMode === 'mock' ? 'Mock Test' : 'Practice Test'}
          </div>
          <div className={`flex items-center gap-2 font-mono text-[15px] px-4 py-1.5 rounded-xl border transition-colors shadow-sm ${timerStyle}`}>
            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowPalette(!showPalette)}
              className="md:hidden p-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors active-scale"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-accent px-5 py-2 text-[14px] rounded-xl flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Test'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Question Area */}
          <div className="flex-1 flex flex-col relative">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
              <div className="mb-8 flex justify-between text-xs font-semibold uppercase tracking-widest text-secondary">
                <span>Question {currentIndex + 1} of {testData.questions.length}</span>
                <span>Marks: +4, −1</span>
              </div>
              <div className="text-lg md:text-[22px] text-foreground leading-relaxed mb-10 font-medium markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />
                  }}
                >
                  {currentQ.question_text}
                </ReactMarkdown>
              </div>
              
              <div className="space-y-4">
                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const optText = currentQ[`option_${optKey.toLowerCase()}` as keyof TestQuestion];
                  const isChecked = currentAns?.chosen_ans === optKey;
                  return (
                    <label key={optKey} className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all active-scale ${isChecked ? 'bg-accent-tint border border-accent/40 shadow-[inset_0_1px_1px_rgba(255,138,61,0.2)]' : 'bg-surface border border-border-glass shadow-glass-inset hover:bg-surface-hover'}`}>
                      <input 
                        type="radio" 
                        name={`q-${currentQ.id}`} 
                        checked={isChecked}
                        onChange={() => handleOptionSelect(optKey)}
                        className="w-5 h-5 accent-[#ff8a3d]" 
                      />
                      <span className={`text-[15px] ${isChecked ? 'text-foreground font-medium' : 'text-foreground/90'}`}>{optText}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="h-20 border-t border-border-glass flex items-center justify-between px-4 md:px-8 shrink-0 bg-background/80 backdrop-blur-xl shadow-glass-inset">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 text-secondary hover:text-foreground transition-colors text-sm font-medium disabled:opacity-50 active-scale px-4 py-2 rounded-xl hover:bg-surface-hover"
              >
                <ChevronLeft className="w-5 h-5" /> Previous
              </button>
              
              <label className="flex items-center gap-2.5 text-amber-400 font-medium cursor-pointer text-sm bg-amber-400/10 px-4 py-2 rounded-xl border border-amber-400/20 active-scale transition-colors hover:bg-amber-400/20">
                <input 
                  type="checkbox" 
                  checked={currentAns?.marked_for_review}
                  onChange={handleToggleReview}
                  className="w-4 h-4 rounded accent-amber-500" 
                /> Mark for Review
              </label>

              <button 
                onClick={() => setCurrentIndex(prev => Math.min(testData.questions.length - 1, prev + 1))}
                disabled={currentIndex === testData.questions.length - 1}
                className="flex items-center gap-1.5 text-accent hover:text-accent-hover font-semibold transition-colors text-[15px] disabled:opacity-50 active-scale px-4 py-2"
              >
                Save & Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Palette Sidebar */}
          <div className={`
            absolute md:relative inset-y-0 right-0 z-30
            w-72 border-l border-border-glass bg-surface-strong backdrop-blur-2xl flex flex-col shrink-0
            transform transition-transform duration-300 shadow-[-8px_0_32px_rgba(0,0,0,0.3)] md:shadow-none
            ${showPalette ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}>
            <div className="h-16 px-5 border-b border-border-glass flex items-center justify-between shrink-0 shadow-glass-inset">
              <span className="font-semibold text-[15px] tracking-tight text-foreground">Question Palette</span>
              <button onClick={() => setShowPalette(false)} className="md:hidden p-2 -mr-2 text-secondary hover:text-foreground active-scale">
                <Grid3X3 className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-4 gap-3 overflow-y-auto">
              {testData.questions.map((q, i) => {
                const ans = answers[q.id];
                const isActive = i === currentIndex;
                const isAnswered = !!ans?.chosen_ans;
                const isReview = ans?.marked_for_review;
                
                let style = 'bg-surface border-border-glass-light text-muted hover:bg-surface-hover shadow-glass-inset';
                if (isActive) style = 'bg-accent-gradient border-accent shadow-glow-accent-sm text-white';
                else if (isReview) style = 'bg-amber-400/10 border-amber-400/40 text-amber-400 shadow-[inset_0_1px_1px_rgba(251,191,36,0.2)]';
                else if (isAnswered) style = 'bg-emerald-400/10 border-emerald-400/40 text-emerald-400 shadow-[inset_0_1px_1px_rgba(52,211,153,0.2)]';

                return (
                  <button 
                    key={q.id}
                    onClick={() => { setCurrentIndex(i); setShowPalette(false); }}
                    className={`w-12 h-12 rounded-xl text-sm font-semibold flex items-center justify-center border transition-all active-scale ${style}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (testState === 'review' && submitResult) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center">
        <div className="glass-strong rounded-[2rem] p-10 max-w-md w-full text-center shadow-glass">
          <div className="w-20 h-20 bg-emerald-400/10 border border-emerald-400/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[inset_0_1px_1px_rgba(52,211,153,0.2)]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-[28px] tracking-tight font-bold text-foreground mb-2">Test Submitted</h2>
          <p className="text-secondary mb-10">Let's see how you did.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="p-5 glass rounded-2xl">
              <div className="text-4xl font-bold text-foreground mb-1 tracking-tighter">{submitResult.score}</div>
              <div className="text-xs text-secondary uppercase tracking-widest font-semibold">Score</div>
            </div>
            <div className="p-5 glass rounded-2xl">
              <div className="text-4xl font-bold text-foreground mb-1 tracking-tighter">{submitResult.correct}</div>
              <div className="text-xs text-secondary uppercase tracking-widest font-semibold">Correct</div>
            </div>
          </div>

          <button 
            onClick={() => setTestState('setup')}
            className="btn-accent w-full py-4 text-[15px]"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col items-center justify-center">
      <div className="w-full">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-glow-accent-sm">
            <PenTool className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Generate Test</h2>
        </div>

        <div className="glass-strong rounded-[2rem] p-8 md:p-10 shadow-glass space-y-8">
          <div className="space-y-4">
            <label className="block text-sm font-semibold tracking-wide uppercase text-secondary">Select Mode</label>
            <CustomSelect
              value={testMode}
              onChange={setTestMode}
              options={[
                { value: 'chapter', label: 'Chapter-wise Mock' },
                { value: 'subject', label: 'Subject Mock' },
                { value: 'mock', label: 'Full Syllabus Mock' }
              ]}
            />
          </div>

          {testMode !== 'mock' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold tracking-wide uppercase text-secondary">Select Subject</label>
              <CustomSelect
                value={subject}
                onChange={setSubject}
                options={[
                  { value: 'Physics', label: 'Physics' },
                  { value: 'Chemistry', label: 'Chemistry' },
                  { value: 'Biology', label: 'Biology' }
                ]}
              />
            </div>
          )}

          {testMode === 'chapter' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold tracking-wide uppercase text-secondary">Chapter Name</label>
              <input 
                type="text"
                value={chapter}
                onChange={e => setChapter(e.target.value)}
                placeholder="e.g. Motion in a Straight Line"
                className="w-full glass-input px-5 py-4 text-[15px]"
              />
            </div>
          )}

          <button 
            onClick={handleStartTest}
            disabled={isLoading}
            className="btn-accent w-full py-4 mt-2 flex items-center justify-center gap-2 text-[15px]"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
