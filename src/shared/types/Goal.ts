export interface Goal {
  id: string;
  title: string;
  description?: string | null;
  goal_type: 'habit' | 'milestone' | 'outcome';
  target_date?: string | null;
  target_value: number;
  current_value: number;
  streak_count: number;
  last_progress_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalPayload {
  title: string;
  description?: string | null;
  goal_type: 'habit' | 'milestone' | 'outcome';
  target_date?: string | null;
  target_value?: number;
  current_value?: number;
}

export interface UpdateGoalPayload {
  title?: string;
  description?: string | null;
  goal_type?: 'habit' | 'milestone' | 'outcome';
  target_date?: string | null;
  target_value?: number;
  current_value?: number;
  streak_count?: number;
  last_progress_at?: string | null;
}
