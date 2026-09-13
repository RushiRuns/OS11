export interface ListGroup {
  id: string;
  name: string;
  sort_order: number;
  is_collapsed: number;
  created_at: string;
}

export interface CreateListGroupPayload {
  name: string;
  sort_order?: number;
  is_collapsed?: boolean;
}

export interface UpdateListGroupPayload {
  name?: string;
  sort_order?: number;
  is_collapsed?: boolean | number;
}
