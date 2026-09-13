export interface NotificationHistoryItem {
  id: string;
  type: 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak';
  task_id?: string | null;
  title: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export interface CreateNotificationPayload {
  type: 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak';
  task_id?: string | null;
  title: string;
  body: string;
}
