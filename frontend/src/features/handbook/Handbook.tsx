import { useState } from 'react';
import { 
  MessageSquareText, 
  HeartHandshake, 
  PenTool, 
  Map as MapIcon, 
  NotebookPen, 
  Flame, 
  X, 
  BookOpen,
  ChevronRight,
  Upload,
  Search,
  Target,
  BarChart,
  Calendar,
  Smile,
  ShieldAlert,
  FileKey,
  Clock,
  Layers,
  MousePointerClick,
  RefreshCw,
  Zap,
  TrendingUp,
  Pencil,
  BookMarked,
  ListChecks,
  FileText,
  FolderOpen,
  CalendarDays,
  Settings,
  Moon,
  CheckCircle,
  Sparkles
} from 'lucide-react';

type FeatureConfig = {
  id: string;
  title: string;
  icon: any;
  colorClass: string;
  glowClass: string;
  shortDesc: string;
  steps: {
    title: string;
    action: string;
    stepIcon: any;
  }[];
};

const FEATURES: FeatureConfig[] = [
  {
    id: 'ncert-chat',
    title: 'NCERT Chat',
    icon: MessageSquareText,
    colorClass: 'text-amber-400',
    glowClass: 'shadow-glow-amber-sm',
    shortDesc: 'Upload PDFs, ask doubts, and use interactive widgets.',
    steps: [
      { title: 'Upload Material', action: 'Click the "+" button in chat to attach any PDF or Image.', stepIcon: Upload },
      { title: 'Ask Anything', action: 'Type your doubt. Jules will cite the exact page it found the answer on.', stepIcon: Search },
      { title: 'Explore Diagrams', action: 'Click the glowing dots (hotspots) on generated diagrams to reveal labels.', stepIcon: Target },
      { title: 'Play Widgets', action: 'Interact with 3D models or physics graphs directly inside the chat window.', stepIcon: BarChart }
    ]
  },
  {
    id: 'personal-chat',
    title: 'Personal Chat',
    icon: HeartHandshake,
    colorClass: 'text-violet-400',
    glowClass: 'shadow-glow-violet-sm',
    shortDesc: 'Your private space for schedule reviews and motivation.',
    steps: [
      { title: 'Share Timetable', action: 'Upload an image of your study schedule and ask if it\'s realistic.', stepIcon: Calendar },
      { title: 'Vent Stress', action: 'Feeling burnt out? Just text Jules. It remembers your past chats to help better.', stepIcon: Smile },
      { title: 'Get Advice', action: 'Ask for strategy tips or motivation when you are feeling low.', stepIcon: Target }
    ]
  },
  {
    id: 'dashboard',
    title: 'Dashboard & Streaks',
    icon: Flame,
    colorClass: 'text-accent',
    glowClass: 'shadow-glow-accent-sm',
    shortDesc: 'Keep your streak alive and track marks-weighted progress.',
    steps: [
      { title: 'Build Streaks', action: 'Log your study session daily to increase your fire 🔥 counter.', stepIcon: Flame },
      { title: 'Recovery Mode', action: 'Missed a day? Don\'t panic. Click the violet Recovery card to gently restart.', stepIcon: ShieldAlert },
      { title: 'Read NCERT Bytes', action: 'Check the glowing amber box daily for a high-yield NCERT fact.', stepIcon: Zap },
      { title: 'Quick MCQ', action: 'Test your memory with the One Quick MCQ widget right next to your Daily Byte. Limited to 3 per session to keep it pressure-free.', stepIcon: Target },
      { title: 'Track Progress', action: 'Watch the circular progress bar grow as you master high-weightage chapters.', stepIcon: TrendingUp }
    ]
  },
  {
    id: 'daily-log',
    title: 'Daily Log',
    icon: CalendarDays,
    colorClass: 'text-emerald-400',
    glowClass: 'shadow-glow-emerald-sm',
    shortDesc: 'Record your study sessions to track total hours.',
    steps: [
      { title: 'Log Session', action: 'Enter the subject, chapter, and minutes you studied today.', stepIcon: Clock },
      { title: 'Add Notes', action: 'Write a small note about what exactly you covered for future reference.', stepIcon: Pencil },
      { title: 'Build Trends', action: 'Your logged hours automatically feed into the Dashboard study trend graph.', stepIcon: TrendingUp }
    ]
  },
  {
    id: 'mock-tests',
    title: 'Mock Tests (CBT)',
    icon: PenTool,
    colorClass: 'text-blue-400',
    glowClass: 'shadow-glow-blue-sm',
    shortDesc: 'Convert any PDF into a timed NTA-style online exam.',
    steps: [
      { title: 'Upload Paper', action: 'Go to Tests and upload your question paper PDF (even 200 questions work).', stepIcon: Upload },
      { title: 'Upload Key (Optional)', action: 'Upload a separate Answer Key PDF for automatic grading.', stepIcon: FileKey },
      { title: 'Start Exam', action: 'Use the real NTA interface (Mark for Review, Clear Response) to solve.', stepIcon: Clock },
      { title: 'Review Mistakes', action: 'End the test to instantly see your marks and detailed chapter-wise analysis.', stepIcon: Target }
    ]
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    icon: Layers,
    colorClass: 'text-orange-400',
    glowClass: 'shadow-[0_0_16px_rgba(251,146,60,0.2)]',
    shortDesc: 'Swipe through smart Hinglish flashcards to revise fast.',
    steps: [
      { title: 'Smart Priority', action: 'The deck automatically prioritizes facts from chapters you recently logged in Daily Log or marked as low confidence.', stepIcon: SparklesIcon },
      { title: 'Tap to Flip', action: 'Read the Topic on the front, tap to reveal the hidden fact written in engaging Hinglish so it doesn\'t feel like a boring textbook.', stepIcon: MousePointerClick },
      { title: 'Rate Difficulty', action: 'Mark cards as Hard, Okay, or Easy to help Jules understand your prep level.', stepIcon: CheckCircle }
    ]
  },
  {
    id: 'cheatsheet',
    title: 'Cheat Sheet',
    icon: FileText,
    colorClass: 'text-indigo-400',
    glowClass: 'shadow-[0_0_16px_rgba(129,140,248,0.2)]',
    shortDesc: 'Quick reference for formulas & high-yield concepts.',
    steps: [
      { title: 'Formula Review', action: 'Quickly glance through important physics and chemistry formulas.', stepIcon: FileText },
      { title: 'Topic Summaries', action: 'Read ultra-short summaries of complex biology processes.', stepIcon: Zap },
      { title: 'Last-Minute Prep', action: 'Perfect for scanning right before you start a CBT Mock Test.', stepIcon: Clock }
    ]
  },
  {
    id: 'reflection-journal',
    title: 'Reflection Journal',
    icon: NotebookPen,
    colorClass: 'text-rose-400',
    glowClass: 'shadow-glow-rose-sm',
    shortDesc: 'Log your feelings and prevent burnout.',
    steps: [
      { title: 'Write an Entry', action: 'Type what you studied and how hard or stressful it felt today.', stepIcon: Pencil },
      { title: 'Pick a Mood', action: 'Select a mood (Great, Good, Neutral, Low) to track your mental state over time.', stepIcon: Smile },
      { title: 'Get AI Analysis', action: 'Jules analyzes your entries to warn you if you are heading towards burnout.', stepIcon: ActivityIcon }
    ]
  },
  {
    id: 'saved-items',
    title: 'Saved Items',
    icon: BookMarked,
    colorClass: 'text-pink-400',
    glowClass: 'shadow-[0_0_16px_rgba(244,114,182,0.2)]',
    shortDesc: 'Your personal library of bookmarked content.',
    steps: [
      { title: 'Bookmark Anything', action: 'Click the save icon on useful chat responses, facts, or test questions.', stepIcon: BookMarked },
      { title: 'Auto-Categorized', action: 'Everything you save is automatically organized by subject and chapter.', stepIcon: FolderOpen },
      { title: 'Quick Review', action: 'Use this space for rapid revision of tough concepts before a mock test.', stepIcon: Target }
    ]
  },
  {
    id: 'concept-map',
    title: 'Concept Map',
    icon: MapIcon,
    colorClass: 'text-emerald-400',
    glowClass: 'shadow-glow-emerald-sm',
    shortDesc: 'Visualize how syllabus topics connect to each other.',
    steps: [
      { title: 'Switch Views', action: 'Toggle between a structured Tree or a free-floating Graph in the top right.', stepIcon: Layers },
      { title: 'Focus a Topic', action: 'Double-click any bubble to bring it to the center and see what connects to it.', stepIcon: MousePointerClick },
      { title: 'Check Colors', action: 'Find the RED glowing bubbles — these are your weak topics that need revision.', stepIcon: ShieldAlert },
      { title: 'Update Map', action: 'Take tests or chat with Jules; the map colors will auto-update as you improve.', stepIcon: RefreshCw }
    ]
  },
  {
    id: 'syllabus-tracker',
    title: 'Syllabus Tracker',
    icon: ListChecks,
    colorClass: 'text-cyan-400',
    glowClass: 'shadow-[0_0_16px_rgba(34,211,238,0.2)]',
    shortDesc: 'Track the official NTA syllabus and exclusions.',
    steps: [
      { title: 'Official Syllabus', action: 'View all 48 chapters for NEET UG 2027 neatly categorized.', stepIcon: ListChecks },
      { title: 'Excluded Chapters', action: 'See exactly which chapters are excluded based on the latest NTA guidelines.', stepIcon: ShieldAlert },
      { title: 'Progress Check', action: 'Track what you have completed versus what is pending.', stepIcon: TrendingUp }
    ]
  },
  {
    id: 'global-orb',
    title: 'Global Ask Jules',
    icon: Sparkles,
    colorClass: 'text-violet-400',
    glowClass: 'shadow-[0_0_16px_rgba(139,92,246,0.2)]',
    shortDesc: 'Drag the glowing orb anywhere to ask a quick doubt.',
    steps: [
      { title: 'Drag & Drop', action: 'Click and hold the glowing violet orb at the bottom right to drag it freely across the screen.', stepIcon: MousePointerClick },
      { title: 'Quick Doubts', action: 'Click the orb to open a mini chat panel. Type a quick NCERT doubt anytime without leaving your current page.', stepIcon: Zap },
      { title: 'Instant Answers', action: 'Get beautifully formatted answers with markdown and math equations rendered instantly.', stepIcon: BookOpen }
    ]
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    colorClass: 'text-zinc-400',
    glowClass: 'shadow-[0_0_16px_rgba(161,161,170,0.2)]',
    shortDesc: 'Manage your app preferences and theme.',
    steps: [
      { title: 'Dark Mode', action: 'Jules uses a premium dark glassmorphism theme by default for less eye strain.', stepIcon: Moon },
      { title: 'API Configuration', action: 'Update your backend URLs or LLM keys if needed.', stepIcon: Settings },
      { title: 'Data Management', action: 'Clear cache or reset your data if you want to start fresh.', stepIcon: RefreshCw }
    ]
  }
];

function SparklesIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

// Custom tiny icon for journal analysis
function ActivityIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default function Handbook() {
  const [activeFeature, setActiveFeature] = useState<FeatureConfig | null>(null);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-24 p-4 md:p-8 max-w-5xl mx-auto w-full">
        
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-foreground" />
          <div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">Jules User Guide</h2>
            <p className="text-sm text-secondary">Step-by-step instructions for every feature.</p>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature)}
                className="group relative text-left glass-strong rounded-3xl p-6 transition-all duration-300 hover:shadow-glass hover:-translate-y-1 overflow-hidden border border-border-glass flex flex-col h-full"
              >
                {/* Background glow effect on hover */}
                <div className={`absolute -inset-10 opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500 bg-current ${feature.colorClass}`} />
                
                <div className="relative z-10 flex-1 flex flex-col">
                  <div className={`w-12 h-12 rounded-2xl glass flex items-center justify-center mb-4 ${feature.colorClass} ${feature.glowClass}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-accent transition-colors">{feature.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed flex-1">{feature.shortDesc}</p>
                  
                  <div className="mt-6 flex items-center text-xs font-medium text-accent opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300">
                    View Instructions <ChevronRight className="w-3 h-3 ml-1" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* Feature Details Modal (Instructional Format) */}
      {activeFeature && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setActiveFeature(null)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-background/95 glass-strong rounded-[2rem] shadow-2xl border border-border-glass overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top decorative glow */}
            <div className={`absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${activeFeature.colorClass}`} />
            
            {/* Sticky Header */}
            <div className="relative z-10 p-6 sm:p-8 pb-5 border-b border-border-glass shrink-0 flex justify-between items-start bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-surface-strong border border-border-glass shadow-glass-inset ${activeFeature.colorClass} ${activeFeature.glowClass}`}>
                  {<activeFeature.icon className="w-7 h-7" />}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground tracking-tight">{activeFeature.title}</h3>
                  <p className="text-sm text-secondary font-medium mt-1">Quick Instructions</p>
                </div>
              </div>
              
              <button 
                onClick={() => setActiveFeature(null)}
                className="p-2 -mr-2 -mt-1 text-secondary hover:text-foreground hover:bg-surface-hover rounded-xl transition-colors active-scale"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Instructional Steps */}
            <div className="relative z-10 p-6 sm:p-8 overflow-y-auto scrollbar-hide flex-1">
              <div className="space-y-4 relative">
                
                {/* Connecting Line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-px bg-border-glass z-0 hidden sm:block" />

                {activeFeature.steps.map((step, idx) => {
                  const StepIcon = step.stepIcon;
                  return (
                    <div key={idx} className="relative z-10 flex gap-4 items-start animate-fade-in-up group" style={{ animationDelay: `${idx * 100}ms` }}>
                      
                      {/* Step Number / Icon */}
                      <div className="w-14 h-14 shrink-0 rounded-2xl bg-surface border border-border-glass flex items-center justify-center flex-col shadow-sm transition-colors group-hover:bg-surface-strong">
                        <span className="text-[10px] text-secondary font-bold uppercase tracking-widest mb-0.5">Step {idx + 1}</span>
                        <StepIcon className={`w-5 h-5 ${activeFeature.colorClass}`} />
                      </div>
                      
                      {/* Step Content */}
                      <div className="flex-1 pt-1">
                        <h4 className="text-foreground font-semibold mb-1 flex items-center gap-2 text-base">
                          {step.title}
                        </h4>
                        <p className="text-secondary text-sm leading-relaxed max-w-[90%]">
                          {step.action}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Sticky Footer */}
            <div className="relative z-10 p-6 border-t border-border-glass shrink-0 bg-gradient-to-t from-black/20 to-transparent flex justify-end">
              <button 
                onClick={() => setActiveFeature(null)}
                className="btn-accent px-8 py-3 w-full sm:w-auto font-semibold text-sm"
              >
                Got it
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
