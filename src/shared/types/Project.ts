export type ProjectViewMode = 'list' | 'board' | 'timeline' | 'calendar' | 'table';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status: 'active' | 'parked' | 'completed' | 'archived';
  due_date?: string | null;
  default_view: ProjectViewMode;
  views: ProjectViewMode[];
  sort_order: number;
  group_id?: string | null;
  area_id?: string | null;
  is_pinned?: number;
  pinned_sort_order?: number;
  is_someday?: number;
  reviewed_at?: string | null;
  isStalled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status?: 'active' | 'parked' | 'completed' | 'archived';
  due_date?: string | null;
  default_view?: ProjectViewMode;
  views?: ProjectViewMode[];
  sort_order?: number;
  group_id?: string | null;
  area_id?: string | null;
  is_pinned?: boolean | number;
  pinned_sort_order?: number;
  is_someday?: boolean | number;
  reviewed_at?: string | null;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  status?: 'active' | 'parked' | 'completed' | 'archived';
  due_date?: string | null;
  default_view?: ProjectViewMode;
  views?: ProjectViewMode[];
  sort_order?: number;
  group_id?: string | null;
  area_id?: string | null;
  is_pinned?: boolean | number;
  pinned_sort_order?: number;
  is_someday?: boolean | number;
  reviewed_at?: string | null;
}
