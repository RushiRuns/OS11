export interface Task {
  id: string;
  title: string;
  notes?: string | null;
  list_id: string;
  project_id?: string | null;
  section_id?: string | null;
  parent_task_id?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  all_day: number;
  recurrence_rule?: string | null;
  recurrence_basis?: 'fixed' | 'after_completion' | null;
  priority: number;
  is_starred: number;
  is_completed: number;
  completed_at?: string | null;
  estimated_minutes?: number | null;
  assignee_device_id?: string | null;
  created_by_device: string;
  sort_order: number;
  my_day_date?: string | null;
  pomodoro_count: number;
  is_trashed: number;
  trashed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskPayload {
  title: string;
  notes?: string | null;
  list_id?: string;
  project_id?: string | null;
  section_id?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  all_day?: boolean;
  priority?: number;
  is_starred?: boolean;
}

export interface UpdateTaskPayload {
  id: string;
  title?: string;
  notes?: string | null;
  list_id?: string;
  priority?: number;
  is_starred?: number;
  is_completed?: number;
  due_date?: string | null;
  due_time?: string | null;
}
