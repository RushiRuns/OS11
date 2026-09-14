export interface TaskHistoryDiff {
  from: unknown;
  to: unknown;
}

export interface TaskHistoryRecord {
  id: string;
  task_id: string;
  changed_fields: Record<string, TaskHistoryDiff>;
  changed_at: string;
}

export interface TaskHistoryRow {
  id: string;
  task_id: string;
  changed_fields: string;
  changed_at: string;
}
