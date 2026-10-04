export type TaskBucket = 'anytime' | 'someday' | null;

/**
 * SQLite row representation of scheduling fields (snake_case).
 */
export interface SchedulingColumns {
  bucket: TaskBucket;
  due_date: string | null;
  due_time: string | null;
  all_day: number;
  recurrence_rule: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  follow_up_date: string | null;
  follow_up_notified_on: string | null;
  reviewed_at: string | null;
}

/**
 * Pure domain representation of scheduling state (camelCase).
 */
export interface SchedulingState {
  bucket: TaskBucket;
  dueDate: string | null;
  dueTime: string | null;
  allDay: boolean;
  recurrenceRule: string | null;
  waitingOn: string | null;
  waitingSince: string | null;
  followUpDate: string | null;
  followUpNotifiedOn: string | null;
  reviewedAt: string | null;
}

/**
 * Commands accepted by the pure scheduling transition function.
 */
export type SchedulingCommand =
  | { type: 'SET_DATE'; dueDate: string; dueTime?: string | null; allDay?: boolean; recurrenceRule?: string | null }
  | { type: 'CLEAR_DATE' }
  | { type: 'SET_BUCKET'; bucket: 'anytime' | 'someday' }
  | { type: 'CLEAR_BUCKET' }
  | { type: 'SET_WAITING'; waitingOn: string; followUpDate?: string | null }
  | { type: 'CLEAR_WAITING' }
  | { type: 'MARK_SOMEDAY_REVIEWED'; reviewedAt?: string }
  | { type: 'ADD_TO_MY_DAY' }
  | { type: 'COMPLETE_TASK'; autoClearWaiting?: boolean };

/**
 * Side-effect report emitted by state transitions.
 */
export interface TransitionEffects {
  cancelReminders: boolean;
  clearBucket: boolean;
  clearDate: boolean;
  clearWaiting: boolean;
}

/**
 * IPC Payload: Set or clear task bucket.
 */
export interface SetBucketPayload {
  taskId: string;
  bucket: 'anytime' | 'someday' | null;
}

/**
 * IPC Payload: Set or clear task schedule date.
 */
export interface SetDatePayload {
  taskId: string;
  dueDate: string | null;
  dueTime?: string | null;
  allDay?: boolean;
  recurrenceRule?: string | null;
}

/**
 * IPC Payload: Mark task waiting on someone/something.
 */
export interface SetWaitingPayload {
  taskId: string;
  waitingOn: string;
  followUpDate?: string | null;
}

/**
 * IPC Payload: Mark batch of someday tasks / projects reviewed.
 */
export interface ReviewSomedayBatchPayload {
  taskIds: string[];
  projectIds: string[];
}

/**
 * Summary badge counts for GTD sidebar navigation.
 */
export interface GtdCounts {
  inbox: number;
  anytime: number;
  someday: number;
  waitingFor: number;
  waitingOverdue: number;
  stalledProjects: number;
}

/**
 * Audit / Undo report produced by TaskSchedulingService.
 */
export interface ChangeReport {
  taskId: string;
  cancelledReminderIds: string[];
  clearedDate: boolean;
  clearedBucket: boolean;
  clearedWaiting: boolean;
  previousState: SchedulingColumns;
  newState: SchedulingColumns;
}
