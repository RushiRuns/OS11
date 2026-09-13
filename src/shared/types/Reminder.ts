export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string; // ISO 8601
  is_triggered: number;
  snoozed_until?: string | null;
  created_at: string;
}

export interface CreateReminderPayload {
  task_id: string;
  remind_at: string;
}
