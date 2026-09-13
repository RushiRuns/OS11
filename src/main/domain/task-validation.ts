import type { CreateTaskPayload, UpdateTaskPayload } from '@shared/types/index.js';
import { isValidRRule } from './recurrence.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function isValidIsoDateString(str: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!dateRegex.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function isValidTimeString(str: string): boolean {
  const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  return timeRegex.test(str);
}

export function validateCreate(payload: CreateTaskPayload): void {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object.');
  }

  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    throw new ValidationError('Task title is required and cannot be empty.');
  }

  if (payload.title.length > 500) {
    throw new ValidationError('Task title cannot exceed 500 characters.');
  }

  if (payload.priority !== undefined && payload.priority !== null) {
    if (!Number.isInteger(payload.priority) || payload.priority < 0 || payload.priority > 4) {
      throw new ValidationError('Priority must be an integer between 0 (None) and 4 (Critical).');
    }
  }

  if (payload.due_date) {
    if (!isValidIsoDateString(payload.due_date)) {
      throw new ValidationError(`Invalid due date format: "${payload.due_date}". Expected YYYY-MM-DD or ISO 8601.`);
    }
  }

  if (payload.due_time) {
    if (!isValidTimeString(payload.due_time)) {
      throw new ValidationError(`Invalid due time format: "${payload.due_time}". Expected HH:mm or HH:mm:ss.`);
    }
  }

  if (payload.recurrence_rule) {
    if (!isValidRRule(payload.recurrence_rule)) {
      throw new ValidationError(`Invalid recurrence rule (RRULE): "${payload.recurrence_rule}".`);
    }
  }
}

export function validateUpdate(fields: UpdateTaskPayload): void {
  if (!fields || typeof fields !== 'object') {
    throw new ValidationError('Update fields must be an object.');
  }

  if (!fields.id || typeof fields.id !== 'string') {
    throw new ValidationError('Task ID is required for updating.');
  }

  if (fields.title !== undefined) {
    if (typeof fields.title !== 'string' || fields.title.trim().length === 0) {
      throw new ValidationError('Task title cannot be empty.');
    }
    if (fields.title.length > 500) {
      throw new ValidationError('Task title cannot exceed 500 characters.');
    }
  }

  if (fields.priority !== undefined && fields.priority !== null) {
    if (!Number.isInteger(fields.priority) || fields.priority < 0 || fields.priority > 4) {
      throw new ValidationError('Priority must be an integer between 0 (None) and 4 (Critical).');
    }
  }

  if (fields.due_date) {
    if (!isValidIsoDateString(fields.due_date)) {
      throw new ValidationError(`Invalid due date format: "${fields.due_date}". Expected YYYY-MM-DD or ISO 8601.`);
    }
  }

  if (fields.due_time) {
    if (!isValidTimeString(fields.due_time)) {
      throw new ValidationError(`Invalid due time format: "${fields.due_time}". Expected HH:mm or HH:mm:ss.`);
    }
  }

  if (fields.recurrence_rule) {
    if (!isValidRRule(fields.recurrence_rule)) {
      throw new ValidationError(`Invalid recurrence rule (RRULE): "${fields.recurrence_rule}".`);
    }
  }
}
