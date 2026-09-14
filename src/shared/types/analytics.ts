export interface PersonalStats {
  completedCount: number;
  streak: number;
  avgCompletionHours: number;
  onTimeRate: number;
  tasksToday: number;
  totalFocusMinutes: number;
}

export interface ProductiveDayStat {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayName: string;
  count: number;
}

export interface ProductiveHourStat {
  hour: number; // 0..23
  formattedHour: string; // e.g. "2 PM"
  count: number;
}

export interface CompletionDayStat {
  date: string; // YYYY-MM-DD
  count: number;
  onTimeCount: number;
  lateCount: number;
}

export interface DistributionStat {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface PomodoroDayStat {
  date: string;
  sessions: number;
  minutes: number;
}

export interface PomodoroAnalytics {
  totalSessions: number;
  totalMinutes: number;
  sessionsPerDay: PomodoroDayStat[];
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
  completed: number;
}

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  velocity: number; // tasks completed per week
  burndown: BurndownPoint[];
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'all';
