export type PomodoroType = 'work' | 'short_break' | 'long_break';

export type PomodoroSound = 'chime' | 'bell' | 'digital' | 'calm' | 'none';

export interface PomodoroSession {
  id: string;
  task_id?: string | null;
  type: PomodoroType;
  duration_seconds: number;
  started_at: string;
  ended_at?: string | null;
  was_completed: number;
  created_at: string;
}

export interface CreatePomodoroPayload {
  task_id?: string | null;
  type: PomodoroType;
  duration_seconds: number;
  started_at?: string;
}

export interface PomodoroStats {
  totalSessions: number;
  totalMinutes: number;
  sessionsByDay: Record<string, number>;
  completed_count?: number;
  total_seconds?: number;
}

export interface ActivePomodoroSession {
  id: string;
  taskId: string | null;
  type: PomodoroType;
  durationSeconds: number;
  elapsedSeconds: number;
  isPaused: boolean;
}

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStart: boolean;
  soundAlert: PomodoroSound;
  dndEnabled: boolean;
}
