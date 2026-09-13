export type SmartListType =
  | 'my_day'
  | 'important'
  | 'planned'
  | 'assigned'
  | 'all'
  | 'completed';

export interface List {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  background_type: 'none' | 'solid' | 'gradient' | 'image' | 'animated';
  background_value?: string | null;
  sort_order: number;
  is_smart: number;
  smart_type?: SmartListType | null;
  group_id?: string | null;
  notification_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface CreateListPayload {
  id?: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  background_type?: 'none' | 'solid' | 'gradient' | 'image' | 'animated';
  background_value?: string | null;
  sort_order?: number;
  is_smart?: boolean;
  smart_type?: SmartListType | null;
  group_id?: string | null;
  notification_enabled?: boolean;
}

export interface UpdateListPayload {
  name?: string;
  icon?: string | null;
  color?: string | null;
  background_type?: 'none' | 'solid' | 'gradient' | 'image' | 'animated';
  background_value?: string | null;
  sort_order?: number;
  group_id?: string | null;
  notification_enabled?: boolean | number;
}
