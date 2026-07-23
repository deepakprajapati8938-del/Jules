import type { StudySession } from '../core/api-client';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  isRecoveryMode: boolean;
  recoveryQuote: string | null;
}

const RECOVERY_QUOTES = [
  "Rest is as important as reps. Let's build the momentum again.",
  "A step back is a setup for a comeback.",
  "Consistency is about showing up again, not just showing up every day.",
  "Your dedication didn't disappear overnight. Let's get back to it."
];

function getLocalDateString(date: Date): string {
  // Returns YYYY-MM-DD in local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateStreak(sessions: StudySession[]): StreakData {
  if (!sessions || sessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      isRecoveryMode: false,
      recoveryQuote: null
    };
  }

  // 1. Get unique dates in local time, sorted descending
  const uniqueDates = Array.from(
    new Set(
      sessions.map(s => getLocalDateString(new Date(s.created_at)))
    )
  ).sort((a, b) => b.localeCompare(a));

  // Helper to add days to a date string
  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
  };

  // 2. Calculate longest streak
  let longestStreak = 0;
  let currentRun = 1;
  for (let i = 0; i < uniqueDates.length; i++) {
    if (i < uniqueDates.length - 1) {
      if (uniqueDates[i + 1] === addDays(uniqueDates[i], -1)) {
        currentRun++;
      } else {
        longestStreak = Math.max(longestStreak, currentRun);
        currentRun = 1;
      }
    } else {
      longestStreak = Math.max(longestStreak, currentRun);
    }
  }

  // 3. Calculate current streak
  const today = getLocalDateString(new Date());
  const yesterday = addDays(today, -1);
  
  let currentStreak = 0;
  let isRecoveryMode = false;

  const hasToday = uniqueDates.includes(today);
  const hasYesterday = uniqueDates.includes(yesterday);

  if (hasToday || hasYesterday) {
    // Determine the anchor for the streak
    let cursor = hasToday ? today : yesterday;
    currentStreak = 1;

    // Keep checking the previous day
    while (true) {
      const previousDay = addDays(cursor, -1);
      if (uniqueDates.includes(previousDay)) {
        currentStreak++;
        cursor = previousDay;
      } else {
        break;
      }
    }
  } else {
    // Streak is 0 (broken)
    currentStreak = 0;
    isRecoveryMode = true;
  }

  // If they have 0 sessions, it's not recovery, it's just the start.
  // We already handled sessions.length === 0 above, but if they logged a long time ago:
  if (isRecoveryMode && uniqueDates.length > 0) {
    // Give a random recovery quote
    const quoteIndex = Math.abs(
      new Date().getDay() + uniqueDates.length
    ) % RECOVERY_QUOTES.length;
    
    return {
      currentStreak,
      longestStreak,
      isRecoveryMode,
      recoveryQuote: RECOVERY_QUOTES[quoteIndex]
    };
  }

  return {
    currentStreak,
    longestStreak,
    isRecoveryMode: false,
    recoveryQuote: null
  };
}
