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

export interface DashboardStats {
  progress_percentage: number;
  study_trend: StudyTrend[];
  total_study_minutes_7d: number;
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

export interface StudySession {
  id: number;
  subject: string;
  chapter_name: string;
  time_spent_mins: number;
  notes: string | null;
  created_at: string;
}

export const apiClient = {
  dailyLog: {
    logSession: (subject: string, chapter_name: string, time_spent_mins: number, notes?: string) =>
      fetchApi<StudySession>('/daily-log', {
        method: 'POST',
        body: JSON.stringify({ subject, chapter_name, time_spent_mins, notes }),
      }),
    getHistory: () => fetchApi<StudySession[]>('/daily-log/history'),
  },
  chat: {
    sendNcertMessage: (question: string, session_id?: string, attachment_data?: string, attachment_mime_type?: string, require_graph?: boolean) => 
      fetchApi<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({ question, session_id, attachment_data, attachment_mime_type, require_graph }),
      }),
      
    sendPersonalMessage: (message: string, model?: string, session_id?: string, attachment_data?: string, attachment_mime_type?: string, require_graph?: boolean) => 
      fetchApi<PersonalChatResponse>('/personal-chat', {
        method: 'POST',
        body: JSON.stringify({ message, model, session_id, attachment_data, attachment_mime_type, require_graph }),
      }),
      
    getPersonalHistory: (session_id: string) => fetchApi<HistoryResponse>(`/personal-chat/history?session_id=${session_id}`),
    getNcertHistory: (session_id: string) => fetchApi<HistoryResponse>(`/chat/history?session_id=${session_id}`),
    
    getNcertSessions: () => fetchApi<ChatSession[]>('/chat/sessions'),
    getPersonalSessions: () => fetchApi<ChatSession[]>('/personal-chat/sessions'),
    deleteSession: (session_id: string) => fetchApi<{ status: string }>(`/chat/sessions/${session_id}`, { method: 'DELETE' }),
  },
  home: {
    getData: () => fetchApi<HomeData>('/home/data'),
  },
  dashboard: {
    getStats: () => fetchApi<DashboardStats>('/dashboard/stats'),
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
    getTest: (test_id: number) => fetchApi<TestQuestion[]>(`/tests/${test_id}`),
    submit: (test_id: number, answers: Array<{ question_id: number; chosen_ans: string | null; time_taken_seconds: number }>) =>
      fetchApi<SubmitResult>(`/tests/${test_id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    tagMistake: (test_id: number, question_id: number, mistake_type: string) =>
      fetchApi<{ question_id: number; mistake_type: string }>(`/tests/${test_id}/questions/${question_id}/mistake`, {
        method: 'PATCH',
        body: JSON.stringify({ mistake_type }),
      }),
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
};
