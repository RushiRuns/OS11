export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  parent_tag_id?: string | null;
  sort_order: number;
  created_at: string;
}

export interface CreateTagPayload {
  name: string;
  color?: string | null;
  parent_tag_id?: string | null;
  sort_order?: number;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string | null;
  parent_tag_id?: string | null;
  sort_order?: number;
}
