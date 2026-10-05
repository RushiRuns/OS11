export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';

export interface GoalHabitLog {
  goal_id: string;
  check_in_date: string; // 'YYYY-MM-DD'
  created_at: string;
}

export type GoalStreakHealth = 'completed_today' | 'due_today' | 'broken' | 'inactive';

export interface GoalStreakDay {
  date: string; // 'YYYY-MM-DD'
  dayLabel: string; // 'M', 'T', etc.
  checked: boolean;
  isToday: boolean;
}

export interface GoalStreakStatus {
  health: GoalStreakHealth;
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
  lastProgressAt: string | null;
  recentDays: GoalStreakDay[];
}

export interface Goal {
  id: string;
  title: string;
  description?: string | null;
  goal_type: 'habit' | 'milestone' | 'outcome';
  status: GoalStatus;
  parent_goal_id?: string | null;
  category?: string | null;
  target_date?: string | null;
  target_value: number;
  current_value: number;
  streak_count: number;
  longest_streak: number;
  last_progress_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalPayload {
  id?: string;
  title: string;
  description?: string | null;
  goal_type: 'habit' | 'milestone' | 'outcome';
  status?: GoalStatus;
  parent_goal_id?: string | null;
  category?: string | null;
  target_date?: string | null;
  target_value?: number;
  current_value?: number;
  streak_count?: number;
  longest_streak?: number;
  last_progress_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

export interface UpdateGoalPayload {
  title?: string;
  description?: string | null;
  goal_type?: 'habit' | 'milestone' | 'outcome';
  status?: GoalStatus;
  parent_goal_id?: string | null;
  category?: string | null;
  target_date?: string | null;
  target_value?: number;
  current_value?: number;
  streak_count?: number;
  longest_streak?: number;
  last_progress_at?: string | null;
  completed_at?: string | null;
}


