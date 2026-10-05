export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';

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
  last_progress_at?: string | null;
  completed_at?: string | null;
}

