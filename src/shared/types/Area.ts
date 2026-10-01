export interface Area {
  id: string;
  workspace_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  sort_order: number;
  is_collapsed: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAreaPayload {
  name: string;
  workspace_id?: string;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface UpdateAreaPayload {
  name?: string;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
  is_collapsed?: boolean | number;
}
