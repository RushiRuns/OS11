import { v4 as uuidv4 } from 'uuid';
import type { Task, CreateTaskPayload } from '@shared/types/index.js';
import { APP_DEFAULTS } from '@shared/constants/index.js';
import { ValidationError, validateCreate, validateUpdate } from './task-validation.js';

export { ValidationError, validateCreate, validateUpdate };
export const validateCreateTask = validateCreate;
export const validateUpdateTask = validateUpdate;

export function buildNewTask(payload: CreateTaskPayload, sanitizedNotes?: string | null): Task {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: payload.title.trim(),
    notes: sanitizedNotes ?? payload.notes ?? null,
    list_id: payload.list_id ?? APP_DEFAULTS.DEFAULT_LIST_ID,
    project_id: payload.project_id ?? null,
    section_id: payload.section_id ?? null,
    parent_task_id: payload.parent_task_id ?? null,
    due_date: payload.due_date ?? null,
    due_time: payload.due_time ?? null,
    all_day: payload.all_day ? 1 : 0,
    recurrence_rule: payload.recurrence_rule ?? null,
    recurrence_basis: payload.recurrence_basis ?? null,
    priority: payload.priority ?? 0,
    is_starred: payload.is_starred ? 1 : 0,
    is_completed: 0,
    completed_at: null,
    estimated_minutes: payload.estimated_minutes ?? null,
    assignee_device_id: null,
    created_by_device: 'local',
    sort_order: Date.now(),
    my_day_date: null,
    pomodoro_count: 0,
    is_trashed: 0,
    trashed_at: null,
    created_at: now,
    updated_at: now,
  };
}
