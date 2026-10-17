export type KeyResultKind = 'metric' | 'work' | 'habit';
export type KeyResultStatus = 'on_track' | 'at_risk' | 'off_track';

export interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  kind: KeyResultKind;
  unit?: string | null;
  start_value: number;
  target_value: number;
  current_value: number;
  status?: KeyResultStatus | null;
  sort_order: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface KRCheckIn {
  id: string;
  key_result_id: string;
  checked_in_on: string; // YYYY-MM-DD local date
  value: number | null;
  status: KeyResultStatus;
  note?: string | null;
  created_at: string; // ISO 8601
}

export interface KRHabitLog {
  key_result_id: string;
  log_date: string; // YYYY-MM-DD local date
  created_at: string; // ISO 8601
}

export interface CreateKeyResultPayload {
  id?: string;
  objective_id: string;
  title: string;
  kind: KeyResultKind;
  unit?: string | null;
  start_value?: number;
  target_value?: number;
  current_value?: number;
  status?: KeyResultStatus | null;
  sort_order?: number;
}

export interface UpdateKeyResultPayload {
  title?: string;
  kind?: KeyResultKind;
  unit?: string | null;
  start_value?: number;
  target_value?: number;
  current_value?: number;
  status?: KeyResultStatus | null;
  sort_order?: number;
  resetHistory?: boolean;
}

export interface CheckInEntryPayload {
  keyResultId: string;
  value: number;
  status: KeyResultStatus;
  note?: string | null;
}

export interface KeyResultPreviousState {
  current_value: number;
  status: KeyResultStatus | null;
}

export interface CheckInUndoState {
  entryIds: string[];
  previousStates: Record<string, KeyResultPreviousState>;
}

export interface KeyResultDeleteResult {
  clearedTaskIds: string[];
  clearedProjectIds: string[];
}
