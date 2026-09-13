import { v4 as uuidv4 } from 'uuid';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import { APP_DEFAULTS } from '@shared/constants/index.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateCreateTask(payload: CreateTaskPayload): void {
  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    throw new ValidationError('Task title is required and cannot be empty.');
  }

  if (payload.title.length > 500) {
    throw new ValidationError('Task title cannot exceed 500 characters.');
  }

  if (payload.priority !== undefined && (payload.priority < 0 || payload.priority > 4)) {
    throw new ValidationError('Priority must be between 0 (None) and 4 (Critical).');
  }
}

export function validateUpdateTask(payload: UpdateTaskPayload): void {
  if (!payload.id || typeof payload.id !== 'string') {
    throw new ValidationError('Task ID is required for updating.');
  }

  if (payload.title !== undefined && payload.title.trim().length === 0) {
    throw new ValidationError('Task title cannot be empty.');
  }
}

export function buildNewTask(payload: CreateTaskPayload, sanitizedNotes?: string | null): Task {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: payload.title.trim(),
    notes: sanitizedNotes ?? payload.notes ?? null,
    list_id: payload.list_id ?? APP_DEFAULTS.DEFAULT_LIST_ID,
    project_id: payload.project_id ?? null,
    section_id: payload.section_id ?? null,
    parent_task_id: null,
    due_date: payload.due_date ?? null,
    due_time: payload.due_time ?? null,
    all_day: payload.all_day ? 1 : 0,
    recurrence_rule: null,
    recurrence_basis: null,
    priority: payload.priority ?? 0,
    is_starred: payload.is_starred ? 1 : 0,
    is_completed: 0,
    completed_at: null,
    estimated_minutes: null,
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
