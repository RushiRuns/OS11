export interface PomodoroSession {
  id: string;
  task_id?: string | null;
  type: 'work' | 'short_break' | 'long_break';
  duration_seconds: number;
  started_at: string;
  ended_at?: string | null;
  was_completed: number;
  created_at: string;
}

export interface CreatePomodoroPayload {
  task_id?: string | null;
  type: 'work' | 'short_break' | 'long_break';
  duration_seconds: number;
  started_at?: string;
}

export interface PomodoroStats {
  totalSessions: number;
  totalMinutes: number;
  sessionsByDay: Record<string, number>;
}
