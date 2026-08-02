const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

// ── Smart Caching Helper ─────────────────────────────────────────────────────

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchWithCache<T>(cacheKey: string, endpoint: string): Promise<T> {
  const cachedStr = localStorage.getItem(cacheKey);
  let parsedCache: { data: T, timestamp: number } | null = null;
  
  if (cachedStr) {
    try {
      parsedCache = JSON.parse(cachedStr);
    } catch (e) {}
  }

  // If online and cache is expired, or if no cache, fetch fresh
  if (navigator.onLine) {
    if (!parsedCache || Date.now() - parsedCache.timestamp > CACHE_DURATION) {
      try {
        const data = await fetchApi<T>(endpoint);
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        return data;
      } catch (err) {
        if (parsedCache) return parsedCache.data; // fallback to expired cache
        throw err;
      }
    }
  }

  // If offline or cache is fresh
  if (parsedCache) {
    return parsedCache.data;
  }

  return fetchApi<T>(endpoint);
}

export const clearDashboardCache = () => {
  localStorage.removeItem('jules_home_data');
  localStorage.removeItem('jules_dashboard_stats');
};

// ── Offline Queue ────────────────────────────────────────────────────────────

export class OfflineSubmitError extends Error {
  constructor() {
    super('OFFLINE_SUBMIT');
    this.name = 'OfflineSubmitError';
  }
}

interface OfflineAction {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  timestamp: number;
}

export const pushToOfflineQueue = (endpoint: string, method: string, body: any) => {
  const queue = JSON.parse(localStorage.getItem('jules_offline_queue') || '[]') as OfflineAction[];
  queue.push({
    id: Date.now().toString(),
    endpoint,
    method,
    body,
    timestamp: Date.now()
  });
  localStorage.setItem('jules_offline_queue', JSON.stringify(queue));
};

export const flushOfflineQueue = async () => {
  if (!navigator.onLine) return;
  
  const queue = JSON.parse(localStorage.getItem('jules_offline_queue') || '[]') as OfflineAction[];
  if (queue.length === 0) return;
  
  // Clear immediately to prevent duplicate submissions
  localStorage.removeItem('jules_offline_queue');
  
  for (const action of queue) {
    try {
      await fetchApi(action.endpoint, {
        method: action.method,
        body: action.body ? JSON.stringify(action.body) : undefined
      });
    } catch (e) {
      console.error('Failed to sync offline action:', action, e);
    }
  }
  
  // Clear caches since we synced modifications
  clearDashboardCache();
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChunkOut {
  similarity: number;
  chapter: string;
  topic: string;
  content_snippet: string;
}

export interface ChatResponse {
  question: string;
  answer: string;
  fallback_applied: boolean;
  chunks: ChunkOut[];
  session_id: string;
  widget_html?: string;
}

export interface PersonalChatResponse {
  reply: string;
  session_id: string;
}

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatSearchResult {
  session_id: string;
  content: string;
  created_at: string;
}

export interface HistoryResponse {
  messages: HistoryMessage[];
}

export interface ChatSession {
  id: string;
  chat_type: 'ncert' | 'personal';
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StreakState {
  current_streak: number;
  last_active_date: string | null;
  pending_reset_ritual: boolean;
}

export interface StudyTrend {
  date: string;
  minutes: number;
}

export interface DashboardStatsOut {
  progress_percentage: number;
  study_trend: Array<{ date: string; minutes: number }>;
  total_study_minutes_7d: number;
  neglected_chapters: string[];
  subject_balance: {
    physics: number;
    chemistry: number;
    biology: number;
  };
}

export interface DashboardStats {
  progress_percentage: number;
  study_trend: { date: string; minutes: number }[];
  total_study_minutes_7d: number;
  neglected_chapters: string[];
  subject_balance: {
    physics: number;
    chemistry: number;
    biology: number;
  };
}

export interface QuickMCQResponse {
  question: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
}

export interface Suggestion {
  chapter_name: string;
  subject: string;
  confidence_status: string;
  reason: string;
  score: number;
}

export interface RecentChat {
  id: string;
  role: string;
  content: string;
  type: string;
  created_at: string;
}

export interface HomeData {
  suggestion: Suggestion | null;
  last_incomplete_test: any | null;
  flashcards_due: number;
  recent_chats: RecentChat[];
}

export interface ConfidenceItem {
  chapter_name: string;
  subject: string;
  status: 'not_started' | 'learning' | 'revised' | 'comfortable' | 'confident';
}

// ── API Methods ──────────────────────────────────────────────────────────────

export type ValidMood = 'great' | 'good' | 'neutral' | 'low';

export interface JournalEntry {
  entry_date: string;
  mood: ValidMood;
  one_line_reflection?: string | null;
}

export interface JournalSummary {
  period_type: string;
  period_start: string;
  period_end: string;
  summary_text: string;
}

export interface TestQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  subject: string;
  chapter_name?: string | null;
  source_type: string;
}

export interface TestOut {
  test_id: number;
  attempt_id: number;
  test_type: string;
  duration_mins: number;
  questions: TestQuestion[];
}

export interface SubmitResult {
  score: number;
  total_marks: number;
  correct: number;
  wrong: number;
  unattempted: number;
  breakdown: Record<string, any>;
}

export interface SavedItem {
  id: number;
  item_type: 'message' | 'diagram' | 'answer' | 'image';
  source_reference: string;
  category: 'notes' | 'revision' | 'favorites' | 'read_later';
  created_at: string;
}

export interface FactOut {
  id: number;
  subject: string;
  chapter_name: string;
  fact_text: string;
  fact_type: string;
}

export interface StudySession {
  id: number;
  subject: string;
  chapter_name: string;
  time_spent_mins: number;
  notes: string | null;
  created_at: string;
}

export interface TopicProgress {
  name: string;
  is_completed: boolean;
}
export interface ChapterProgress {
  name: string;
  is_completed: boolean;
  topics: TopicProgress[];
}
export interface SubjectProgress {
  name: string;
  chapters: ChapterProgress[];
}

export const apiClient = {
  dailyLog: {
    logSession: (subject: string, chapter_name: string, time_spent_mins: number, notes?: string) => {
      clearDashboardCache();
      return fetchApi<StudySession>('/daily-log', {
        method: 'POST',
        body: JSON.stringify({ subject, chapter_name, time_spent_mins, notes }),
      });
    },
    getHistory: () => fetchWithCache<StudySession[]>('jules_daily_log_history', '/daily-log/history'),
  },
  chat: {
    sendNcertMessage: (question: string, model?: string, session_id?: string, attachment_data?: string, attachment_mime_type?: string, require_graph?: boolean) => 
      fetchApi<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({ question, model, session_id, attachment_data, attachment_mime_type, require_graph }),
      }),
      
    sendPersonalMessage: (message: string, model?: string, session_id?: string, attachment_data?: string, attachment_mime_type?: string, require_graph?: boolean) => 
      fetchApi<PersonalChatResponse>('/personal-chat', {
        method: 'POST',
        body: JSON.stringify({ message, model, session_id, attachment_data, attachment_mime_type, require_graph }),
      }),
      
    getPersonalHistory: (session_id: string) => fetchApi<HistoryResponse>(`/personal-chat/history?session_id=${session_id}`),
    getNcertHistory: (session_id: string) => fetchApi<HistoryResponse>(`/chat/history?session_id=${session_id}`),
    searchHistory: (query: string) => fetchApi<ChatSearchResult[]>(`/chat/search?query=${encodeURIComponent(query)}`),
    
    getNcertSessions: () => fetchApi<ChatSession[]>('/chat/sessions'),
    getPersonalSessions: () => fetchApi<ChatSession[]>('/personal-chat/sessions'),
    deleteSession: (session_id: string) => fetchApi<{ status: string }>(`/chat/sessions/${session_id}`, { method: 'DELETE' }),
    
    quickLookup: (query: string) => fetchApi<{ answer: string }>('/chat/quick-lookup', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  },
  home: {
    getData: () => fetchWithCache<HomeData>('jules_home_data', '/home/data'),
  },
  dashboard: {
    getStats: () => fetchWithCache<DashboardStats>('jules_dashboard_stats', '/dashboard/stats'),
    getQuickMCQ: () => fetchApi<QuickMCQResponse>('/dashboard/quick-mcq'),
  },
  streak: {
    get: () => fetchApi<StreakState>('/streak'),
    ping: () => fetchApi<StreakState>('/streak/ping', { method: 'POST' }),
    completeRitual: () => fetchApi<StreakState>('/streak/complete-ritual', { method: 'POST' }),
  },
  confidence: {
    list: () => fetchApi<ConfidenceItem[]>('/confidence'),
    update: (chapter_name: string, subject: string, status: ConfidenceItem['status']) => 
      fetchApi<ConfidenceItem>(`/confidence/${encodeURIComponent(chapter_name)}?subject=${encodeURIComponent(subject)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },
  journal: {
    list: () => fetchApi<JournalEntry[]>('/journal'),
    upsert: (mood: ValidMood, one_line_reflection?: string) =>
      fetchApi<JournalEntry>('/journal', {
        method: 'POST',
        body: JSON.stringify({ mood, one_line_reflection }),
      }),
    summary: (period_type: 'weekly' | 'monthly' = 'weekly') =>
      fetchApi<JournalSummary>(`/journal/summary?period_type=${period_type}`),
  },
  tests: {
    generate: (test_type: string, num_questions = 30, subject?: string, chapter_name?: string) =>
      fetchApi<TestOut>('/tests/generate', {
        method: 'POST',
        body: JSON.stringify({ test_type, num_questions, subject, chapter_name }),
      }),
    generateFromPdf: async (file: File, answerKeyFile?: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (answerKeyFile) {
        formData.append('answer_key_file', answerKeyFile);
      }
      const url = `${API_BASE}/tests/generate-from-pdf`;
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        let err = 'Failed to generate test from PDF';
        try { const d = await response.json(); err = d.detail || err; } catch {}
        throw new Error(err);
      }
      return response.json() as Promise<TestOut>;
    },
    getTest: (test_id: number) => fetchApi<TestQuestion[]>(`/tests/${test_id}`),
    submit: async (test_id: number, answers: Array<{ question_id: number; chosen_ans: string | null; time_taken_seconds: number }>) => {
      clearDashboardCache();
      try {
        return await fetchApi<SubmitResult>(`/tests/${test_id}/submit`, {
          method: 'POST',
          body: JSON.stringify({ answers }),
        });
      } catch (err: any) {
        if (!navigator.onLine || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          pushToOfflineQueue(`/tests/${test_id}/submit`, 'POST', { answers });
          throw new OfflineSubmitError();
        }
        throw err;
      }
    },
    tagMistake: (test_id: number, question_id: number, mistake_type: string) =>
      fetchApi<{ question_id: number; mistake_type: string }>(`/tests/${test_id}/questions/${question_id}/mistake`, {
        method: 'PATCH',
        body: JSON.stringify({ mistake_type }),
      }),
    getAvailablePyqChapters: () => fetchApi<string[]>('/tests/available-pyq-chapters'),
  },
  saves: {
    list: (category?: string) => fetchApi<SavedItem[]>(category ? `/saves?category=${category}` : '/saves'),
    save: (item_type: string, source_reference: string, category: string) =>
      fetchApi<SavedItem>('/saves', {
        method: 'POST',
        body: JSON.stringify({ item_type, source_reference, category }),
      }),
  },
  suggestions: {
    get: () => fetchApi<any>('/suggestions'),
  },
  facts: {
    getRandom: (count = 1) => fetchApi<FactOut[]>(`/facts/random?count=${count}`),
    getFlashcards: async (subject?: string, chapter?: string) => {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `jules_daily_flashcards_${today}`;
      
      // Return cached flashcards for today if no specific subject/chapter requested
      if (!subject && !chapter) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as FactOut[];
            if (parsed && parsed.length > 0) return parsed;
          } catch (e) {}
        }
      }

      const params = new URLSearchParams();
      if (subject) params.append('subject', subject);
      if (chapter) params.append('chapter', chapter);
      const qs = params.toString();
      
      const data = await fetchApi<FactOut[]>(`/facts/flashcards${qs ? `?${qs}` : ''}`);
      
      // Save to cache if it's the daily deck
      if (data && data.length > 0 && !subject && !chapter) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
      return data;
    },
  },
  syllabusTracker: {
    get: () => fetchWithCache<SubjectProgress[]>('jules_syllabus_tracker', '/syllabus/tracker'),
    toggle: (chapter_name: string, topic_name: string, is_completed: boolean) => fetchApi<any>('/syllabus/tracker/toggle', {
      method: 'POST',
      body: JSON.stringify({ chapter_name, topic_name, is_completed })
    })
  },
};
