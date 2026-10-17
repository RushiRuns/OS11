import type { KeyResult, KRCheckIn, KRHabitLog } from './KeyResult.js';

export type ObjectivePeriodKind = 'quarter' | 'custom';
export type ObjectiveCadence = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type ObjectiveStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Objective {
  id: string;
  title: string;
  notes?: string | null;
  area_id?: string | null;
  period_kind: ObjectivePeriodKind;
  period_start: string; // YYYY-MM-DD local date
  period_end: string;   // YYYY-MM-DD local date, inclusive
  cadence: ObjectiveCadence;
  status: ObjectiveStatus;
  completed_at?: string | null; // ISO 8601
  created_at: string;           // ISO 8601
  updated_at: string;           // ISO 8601
}

export interface CreateObjectivePayload {
  id?: string;
  title: string;
  notes?: string | null;
  area_id?: string | null;
  period_kind?: ObjectivePeriodKind;
  period_start: string;
  period_end: string;
  cadence?: ObjectiveCadence;
  status?: ObjectiveStatus;
}

export interface UpdateObjectivePayload {
  title?: string;
  notes?: string | null;
  area_id?: string | null;
  period_kind?: ObjectivePeriodKind;
  period_start?: string;
  period_end?: string;
  cadence?: ObjectiveCadence;
  status?: ObjectiveStatus;
  completed_at?: string | null;
}

export type ObjectiveListState =
  | 'ended'
  | 'due'
  | 'overdue'
  | 'off_track'
  | 'at_risk'
  | 'behind_pace'
  | 'paused'
  | null;

export interface ResourceLinkPair {
  resourceId: string;
  keyResultId: string;
}

export interface ObjectiveUndoSnapshot {
  objective: Objective;
  keyResults: KeyResult[];
  checkIns: KRCheckIn[];
  habitLogs: KRHabitLog[];
  taskLinks: ResourceLinkPair[];
  projectLinks: ResourceLinkPair[];
}

export interface ObjectiveDeleteResult {
  snapshot: ObjectiveUndoSnapshot;
  clearedTaskIds: string[];
  clearedProjectIds: string[];
}

export interface ObjectiveRestoreResult {
  taskLinks: ResourceLinkPair[];
  projectLinks: ResourceLinkPair[];
}
