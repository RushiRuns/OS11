export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  is_completed: number; // 0 | 1
  sort_order: number;
  created_at: string;
}

export interface CreateMilestonePayload {
  project_id: string;
  title: string;
  due_date: string;
  is_completed?: number | boolean;
  sort_order?: number;
}

export interface UpdateMilestonePayload {
  title?: string;
  due_date?: string;
  is_completed?: number | boolean;
  sort_order?: number;
}
