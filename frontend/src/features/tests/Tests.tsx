import { useState, useEffect } from 'react';
import { PenTool, Clock, CheckCircle2, ChevronRight, ChevronLeft, Grid3X3, Loader2 } from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { apiClient, OfflineSubmitError } from '../../core/api-client';
import type { TestOut, TestQuestion, SubmitResult, FactOut } from '../../core/api-client';
import { vibrate } from '../../core/haptics';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NEET_SYLLABUS } from '../../core/syllabus';

export default function Tests() {
  const [testState, setTestState] = useState<'setup' | 'taking' | 'summary' | 'review' | 'offline_summary'>('setup');
  const [showPalette, setShowPalette] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // default 60 mins
  
  // Data states
  const [testMode, setTestMode] = useState('mock');
  const [subject, setSubject] = useState('Physics');
  const [chapter, setChapter] = useState('');
  const [testData, setTestData] = useState<TestOut | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFact, setLoadingFact] = useState<FactOut | null>(null);
  
  // Map of question_id -> { chosen_ans, marked_for_review, visited }
  const [answers, setAnswers] = useState<Record<number, { chosen_ans: string | null; marked_for_review: boolean; visited: boolean }>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);

  // Loading progress
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Preparing your test...');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (testState === 'taking') {
      interval = setInterval(() => {
        setTimeLeft((t) => (t > 0 ? t - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [testState]);

  useEffect(() => {
    let progressInterval: ReturnType<typeof setInterval>;
    if (isLoading && testMode === 'pdf') {
      setLoadingProgress(0);
      setLoadingText('Uploading and analyzing PDF...');
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 30) {
            if (prev === 29) setLoadingText('Extracting questions & options...');
            return prev + 1;
          }
          if (prev < 80) {
            if (prev === 79) setLoadingText('Solving & mapping answer keys...');
            return prev + 0.5;
          }
          if (prev < 95) {
            if (prev === 94) setLoadingText('Finalizing Mock Test interface...');
            return prev + 0.2;
          }
          return prev;
        });
      }, 300);
    }
    return () => clearInterval(progressInterval);
  }, [isLoading, testMode]);

  const handleStartTest = async () => {
    setIsLoading(true);
    // Fetch a fact to show while loading
    apiClient.facts.getRandom(1).then(res => {
      if (res && res.length > 0) setLoadingFact(res[0]);
    }).catch(console.error);

    try {
      let data: TestOut;
      if (testMode === 'pdf' && pdfFile) {
        data = await apiClient.tests.generateFromPdf(pdfFile, answerKeyFile || undefined);
      } else {
        data = await apiClient.tests.generate(
          testMode, 
          30,
          testMode !== 'mock' ? subject : undefined,
          testMode === 'chapter' ? chapter : undefined
        );
      }
      setTestData(data);
      setTimeLeft(data.duration_mins * 60);
      
      const initialAnswers: typeof answers = {};
      data.questions.forEach((q, i) => {
        initialAnswers[q.id] = { chosen_ans: null, marked_for_review: false, visited: i === 0 };
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
    vibrate(15); // Light tick for selecting option
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

  const handleClearResponse = () => {
    if (!testData) return;
    const qId = testData.questions[currentIndex].id;
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...prev[qId], chosen_ans: null }
    }));
  };

  const changeQuestion = (newIndex: number) => {
    if (!testData) return;
    vibrate(10); // Very light tick for changing questions
    setCurrentIndex(newIndex);
    const qId = testData.questions[newIndex].id;
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...(prev[qId] || { chosen_ans: null, marked_for_review: false }), visited: true }
    }));
  };

  const handleSubmit = async () => {
    if (!testData) return;
    vibrate([50, 50, 100]); // Heavier success vibration for submit
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
      setTestState('summary');
    } catch (err: any) {
      console.error(err);
      if (err instanceof OfflineSubmitError || err.name === 'OfflineSubmitError') {
        setTestState('offline_summary');
      } else {
        alert('Failed to submit test.');
      }
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

  if ((testState === 'taking' || testState === 'review') && testData) {
    const currentQ = testData.questions[currentIndex];
    const currentAns = answers[currentQ.id];

    return (
      <div className="flex flex-col h-full relative">
        {/* CBT Top Bar */}
        <div className="h-16 border-b border-border-glass flex items-center justify-between px-3 md:px-6 shrink-0 bg-background/80 backdrop-blur-xl shadow-glass-inset gap-2">
          <div className="font-semibold text-foreground flex items-center gap-2 md:gap-2.5 text-[14px] md:text-[15px] tracking-tight truncate">
            <div className="hidden sm:flex w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 items-center justify-center shrink-0">
              <PenTool className="w-4 h-4 text-accent" /> 
            </div>
            <span className="truncate">{testMode === 'mock' ? 'Mock Test' : 'Practice Test'}</span>
            {testState === 'review' && <span className="ml-1 md:ml-2 text-[10px] md:text-xs uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-1.5 md:px-2 py-1 rounded-md shrink-0">Review</span>}
          </div>
          
          {testState === 'taking' && (
            <div className={`flex items-center gap-1.5 md:gap-2 font-mono text-[13px] md:text-[15px] px-3 md:px-4 py-1.5 rounded-xl border transition-colors shadow-sm shrink-0 ${timerStyle}`}>
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" /> {formatTime(timeLeft)}
            </div>
          )}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            <button 
              onClick={() => setShowPalette(!showPalette)}
              className="md:hidden p-1.5 md:p-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors active-scale shrink-0"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>
            {testState === 'taking' ? (
              <button 
                onClick={handleSubmit}
                disabled={isLoading}
                className="btn-accent px-3 md:px-5 py-1.5 md:py-2 text-[13px] md:text-[14px] rounded-xl flex items-center gap-2 shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span className="hidden sm:inline">Submit</span> Test</>}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                <span className="text-emerald-400 font-bold px-2 md:px-3 py-1 bg-emerald-400/10 border border-emerald-400/20 rounded-lg whitespace-nowrap text-[11px] md:text-sm">
                  <span className="hidden sm:inline">Score: </span>{submitResult?.score}
                </span>
                <button 
                  onClick={() => setTestState('setup')}
                  className="bg-surface hover:bg-surface-hover text-foreground border border-border-glass px-3 md:px-4 py-1.5 md:py-2 text-[12px] md:text-[13px] rounded-xl whitespace-nowrap shrink-0"
                >
                  Exit <span className="hidden sm:inline">Review</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Question Area */}
          <div className="flex-1 flex flex-col relative">
            <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-6 md:p-10 max-w-4xl mx-auto w-full">
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
                  
                  const isReviewMode = testState === 'review';
                  const isCorrectAns = isReviewMode && submitResult?.breakdown?.[currentQ.id]?.correct === optKey;
                  const isWrongChosen = isReviewMode && isChecked && !isCorrectAns;
                  
                  let labelClass = 'bg-surface border border-border-glass shadow-glass-inset';
                  let textClass = 'text-foreground/90';
                  
                  if (!isReviewMode) {
                    if (isChecked) {
                      labelClass = 'bg-accent-tint border border-accent/40 shadow-[inset_0_1px_1px_rgba(255,138,61,0.2)]';
                      textClass = 'text-foreground font-medium';
                    } else {
                      labelClass += ' hover:bg-surface-hover';
                    }
                  } else {
                    if (isCorrectAns) {
                      labelClass = 'bg-emerald-500/10 border-emerald-500/40 shadow-[inset_0_1px_1px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500';
                      textClass = 'text-emerald-400 font-bold';
                    } else if (isWrongChosen) {
                      labelClass = 'bg-rose-500/10 border-rose-500/40 shadow-[inset_0_1px_1px_rgba(244,63,94,0.2)]';
                      textClass = 'text-rose-400 font-bold line-through opacity-80';
                    } else {
                      labelClass += ' opacity-40';
                    }
                  }

                  return (
                    <label key={optKey} className={`flex items-center gap-4 p-5 rounded-2xl transition-all ${!isReviewMode ? 'cursor-pointer active-scale' : ''} ${labelClass}`}>
                      <input 
                        type="radio" 
                        name={`q-${currentQ.id}`} 
                        checked={isChecked}
                        onChange={() => !isReviewMode && handleOptionSelect(optKey)}
                        disabled={isReviewMode}
                        className={`w-5 h-5 ${isReviewMode ? (isCorrectAns ? 'accent-emerald-500' : (isWrongChosen ? 'accent-rose-500' : 'accent-[#ff8a3d]')) : 'accent-[#ff8a3d]'}`} 
                      />
                      <span className={`text-[15px] ${textClass}`}>{optText}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bottom Nav (NTA CBT Style) */}
            <div className="h-auto py-3 md:h-20 md:py-0 border-t border-border-glass flex flex-col md:flex-row items-center justify-between px-4 md:px-8 shrink-0 bg-background/80 backdrop-blur-xl shadow-glass-inset gap-3 md:gap-4 overflow-x-auto">
              <div className="flex gap-2 md:gap-3 w-full md:w-auto overflow-x-auto hide-scrollbar">
                {testState === 'taking' && (
                  <>
                    <button 
                      onClick={() => {
                        handleToggleReview();
                        if (currentIndex < testData.questions.length - 1) changeQuestion(currentIndex + 1);
                      }}
                      className="flex items-center justify-center gap-1.5 text-white bg-purple-600 hover:bg-purple-700 transition-colors text-[13px] font-semibold active-scale px-3 py-2.5 rounded-xl shadow-sm whitespace-nowrap flex-1 md:flex-none"
                    >
                      {currentIndex === testData.questions.length - 1 ? 'Mark for Review' : 'Mark for Review & Next'}
                    </button>
                    <button 
                      onClick={handleClearResponse}
                      className="flex items-center justify-center gap-1.5 text-foreground bg-surface border border-border-glass hover:bg-surface-hover transition-colors text-[13px] font-semibold active-scale px-3 py-2.5 rounded-xl shadow-sm whitespace-nowrap flex-1 md:flex-none"
                    >
                      Clear Response
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex gap-2 md:gap-3 w-full md:w-auto ml-auto">
                <button 
                  onClick={() => changeQuestion(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center gap-1.5 text-secondary hover:text-foreground transition-colors text-sm font-medium disabled:opacity-50 active-scale px-4 py-2.5 rounded-xl hover:bg-surface-hover flex-1 md:flex-none"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button 
                  onClick={() => {
                    if (currentIndex < testData.questions.length - 1) changeQuestion(currentIndex + 1);
                  }}
                  disabled={currentIndex === testData.questions.length - 1}
                  className="flex items-center justify-center gap-1.5 text-white bg-emerald-600 hover:bg-emerald-700 transition-colors text-[14px] font-bold active-scale px-6 py-2.5 rounded-xl shadow-sm flex-1 md:flex-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  Save & Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
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
            <div className="p-4 grid grid-cols-5 gap-2.5 overflow-y-auto content-start">
              {testData.questions.map((q, i) => {
                const ans = answers[q.id];
                const isActive = i === currentIndex;
                const isAnswered = !!ans?.chosen_ans;
                const isReview = ans?.marked_for_review;
                
                let style = 'bg-[#E2E8F0] text-slate-700 border-transparent'; // Not Visited (Gray/White)
                
                if (testState === 'taking') {
                  if (ans?.visited) style = 'bg-[#ef4444] text-white border-transparent shadow-sm';
                  if (isAnswered) style = 'bg-[#10b981] text-white border-transparent shadow-sm';
                  if (isReview) style = 'bg-[#9333ea] text-white border-transparent shadow-sm';
                } else if (testState === 'review') {
                  const revData = submitResult?.breakdown?.[q.id];
                  if (revData?.is_correct === true) style = 'bg-[#10b981] text-white border-transparent shadow-sm';
                  else if (revData?.is_correct === false) style = 'bg-[#ef4444] text-white border-transparent shadow-sm';
                  else style = 'bg-surface border-border-glass opacity-50';
                }
                
                return (
                  <button 
                    key={q.id}
                    onClick={() => { changeQuestion(i); setShowPalette(false); }}
                    className={`relative w-full aspect-square rounded-lg text-[14px] font-bold flex items-center justify-center border transition-all active-scale ${style} ${isActive ? 'ring-2 ring-offset-2 ring-offset-surface-strong ring-blue-500 scale-105' : ''}`}
                    title={isAnswered && isReview ? "Answered & Marked for Review" : undefined}
                  >
                    {i + 1}
                    {/* Small green dot indicator if answered AND marked for review */}
                    {testState === 'taking' && isAnswered && isReview && (
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#10b981] border-2 border-surface-strong rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (testState === 'summary' && submitResult) {
    return (
      <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 flex flex-col items-center justify-center">
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

          <div className="flex gap-4">
            <button 
              onClick={() => {
                setCurrentIndex(0);
                setTestState('review');
              }}
              className="btn-accent flex-1 py-4 text-[15px]"
            >
              Review Answers
            </button>
            <button 
              onClick={() => setTestState('setup')}
              className="bg-surface hover:bg-surface-hover text-foreground border border-border-glass flex-1 py-4 text-[15px] rounded-[1.25rem] font-semibold transition-colors active-scale shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (testState === 'offline_summary') {
    return (
      <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
        <div className="glass-strong rounded-[2rem] p-10 max-w-md w-full text-center shadow-glass relative overflow-hidden">
          <div className="absolute inset-0 bg-rose-500/5 pointer-events-none" />
          <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full animate-ping" />
            <Clock className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-[28px] tracking-tight font-bold text-foreground mb-2">Saved Offline</h2>
          <p className="text-secondary mb-8">Your test has been saved securely on this device.</p>
          
          <div className="bg-surface/50 border border-border-glass p-5 rounded-2xl mb-8">
            <p className="text-sm font-medium text-foreground mb-2">Sync Pending</p>
            <p className="text-xs text-secondary leading-relaxed">
              We couldn't reach the servers to calculate your score. Don't worry! 
              The moment your internet reconnects, Jules will sync your answers in the background and your score will be available in the dashboard.
            </p>
          </div>

          <button 
            onClick={() => setTestState('setup')}
            className="btn-accent w-full py-4 text-[15px]"
          >
            Got it, take me back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col items-center justify-center">
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
                { value: 'mock', label: 'Full Syllabus Mock' },
                { value: 'pdf', label: 'Upload PDF to Test' }
              ]}
            />
          </div>

          {testMode === 'pdf' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-semibold tracking-wide uppercase text-secondary">Upload Test PDF</label>
              <div className="border-2 border-dashed border-border-glass rounded-2xl p-6 text-center hover:border-accent/50 transition-colors bg-surface cursor-pointer relative">
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setPdfFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-secondary font-medium">
                  {pdfFile ? (
                    <span className="text-emerald-400 font-semibold">{pdfFile.name} ({(pdfFile.size/1024/1024).toFixed(2)} MB)</span>
                  ) : (
                    "Click or drag Question PDF here (Max 20MB)"
                  )}
                </div>
              </div>

              <label className="block text-sm font-semibold tracking-wide uppercase text-secondary pt-2">Upload Answer Key PDF (Optional)</label>
              <div className="border-2 border-dashed border-border-glass rounded-2xl p-6 text-center hover:border-accent/50 transition-colors bg-surface cursor-pointer relative">
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAnswerKeyFile(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="text-secondary font-medium">
                  {answerKeyFile ? (
                    <span className="text-purple-400 font-semibold">{answerKeyFile.name} ({(answerKeyFile.size/1024/1024).toFixed(2)} MB)</span>
                  ) : (
                    "Click or drag Answer Key PDF here"
                  )}
                </div>
              </div>
            </div>
          )}

          {testMode !== 'mock' && testMode !== 'pdf' && (
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
              <CustomSelect
                value={chapter}
                onChange={setChapter}
                placeholder="Select Chapter..."
                options={subject && NEET_SYLLABUS[subject] ? NEET_SYLLABUS[subject].map(ch => ({ value: ch, label: ch })) : []}
              />
            </div>
          )}

          <button 
            onClick={handleStartTest}
            disabled={isLoading || (testMode === 'pdf' && !pdfFile)}
            className="btn-accent w-full py-4 mt-2 flex items-center justify-center gap-2 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Preparing...' : testMode === 'pdf' ? 'Extract & Start Test' : 'Start Test'}
          </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="glass-strong rounded-3xl p-8 max-w-md w-full mx-4 shadow-glass border border-accent/20 flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-6" />
            <h3 className="text-xl font-bold text-foreground mb-4 tracking-tight">{testMode === 'pdf' ? loadingText : 'Preparing your test...'}</h3>
            
            {testMode === 'pdf' && (
              <div className="w-full bg-surface-strong rounded-full h-2.5 mb-6 border border-border-glass overflow-hidden">
                <div className="bg-accent-gradient h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }}></div>
              </div>
            )}

            {loadingFact && (
              <div className="bg-surface/50 rounded-2xl p-4 border border-border-glass">
                <p className="text-sm font-medium text-amber-400 uppercase tracking-wider mb-2">Did You Know?</p>
                <p className="text-foreground/90 text-[15px] leading-relaxed">"{loadingFact.fact_text}"</p>
                <p className="text-xs text-secondary mt-2">{loadingFact.chapter_name}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
