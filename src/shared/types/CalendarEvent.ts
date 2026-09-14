export type CalendarProvider = 'google' | 'apple' | 'outlook';

export interface CalendarEvent {
  id: string;
  provider: CalendarProvider;
  title: string;
  description?: string | null;
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
  all_day: boolean;
  location?: string | null;
  calendar_name?: string;
  calendar_color?: string;
  external_id?: string;
  task_id?: string | null;
}

export interface CalendarSyncResult {
  success: boolean;
  syncedCount: number;
  provider: CalendarProvider;
  error?: string;
}

export interface CalendarStatus {
  enabled: boolean;
  connectedProviders: CalendarProvider[];
  lastSyncTime?: string | null;
}
