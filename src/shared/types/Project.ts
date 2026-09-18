export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status: 'active' | 'archived' | 'completed';
  due_date?: string | null;
  default_view: 'list' | 'board' | 'timeline' | 'calendar' | 'table';
  sort_order: number;
  group_id?: string | null;
  is_pinned?: number;
  pinned_sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status?: 'active' | 'archived' | 'completed';
  due_date?: string | null;
  default_view?: 'list' | 'board' | 'timeline' | 'calendar' | 'table';
  sort_order?: number;
  group_id?: string | null;
  is_pinned?: boolean | number;
  pinned_sort_order?: number;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status?: 'active' | 'archived' | 'completed';
  due_date?: string | null;
  default_view?: 'list' | 'board' | 'timeline' | 'calendar' | 'table';
  sort_order?: number;
  group_id?: string | null;
  is_pinned?: boolean | number;
  pinned_sort_order?: number;
}
