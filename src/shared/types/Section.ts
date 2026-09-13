export interface Section {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  is_collapsed: number;
  created_at: string;
}

export interface CreateSectionPayload {
  project_id: string;
  name: string;
  sort_order?: number;
  is_collapsed?: boolean;
}

export interface UpdateSectionPayload {
  name?: string;
  sort_order?: number;
  is_collapsed?: boolean | number;
}
