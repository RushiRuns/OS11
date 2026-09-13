import { TaskRepository } from '../../repositories/task-repository.js';
import {
  validateCreateTask,
  validateUpdateTask,
  buildNewTask,
  ValidationError,
} from '../../domain/task.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import DOMPurify from 'dompurify';

function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    if (typeof (DOMPurify as any).sanitize === 'function') {
      return (DOMPurify as any).sanitize(html);
    }
    if (typeof window !== 'undefined') {
      const purify = (DOMPurify as any)(window);
      if (purify && typeof purify.sanitize === 'function') {
        return purify.sanitize(html);
      }
    }
  } catch {
    // Fallback in Node main process
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export class TaskService {
  private repository: TaskRepository;

  constructor(repository?: TaskRepository) {
    this.repository = repository ?? new TaskRepository();
  }

  public getAll(): Task[] {
    return this.repository.getAll();
  }

  public getById(id: string): Task {
    const task = this.repository.getById(id);
    if (!task) {
      throw new ValidationError(`Task with id "${id}" not found.`);
    }
    return task;
  }

  public create(payload: CreateTaskPayload): Task {
    validateCreateTask(payload);
    const sanitizedNotes = payload.notes ? sanitizeHtml(payload.notes) : null;
    const task = buildNewTask(payload, sanitizedNotes);
    return this.repository.create(task);
  }

  public update(payload: UpdateTaskPayload): Task {
    validateUpdateTask(payload);
    const existing = this.getById(payload.id);

    const now = new Date().toISOString();
    const updated = this.repository.update({
      id: payload.id,
      title: payload.title !== undefined ? payload.title.trim() : existing.title,
      notes: payload.notes !== undefined ? (payload.notes ? sanitizeHtml(payload.notes) : null) : existing.notes,
      list_id: payload.list_id ?? existing.list_id,
      priority: payload.priority !== undefined ? payload.priority : existing.priority,
      is_starred: payload.is_starred !== undefined ? payload.is_starred : existing.is_starred,
      is_completed: payload.is_completed !== undefined ? payload.is_completed : existing.is_completed,
      completed_at:
        payload.is_completed === 1
          ? existing.completed_at ?? now
          : payload.is_completed === 0
            ? null
            : existing.completed_at,
      due_date: payload.due_date !== undefined ? payload.due_date : existing.due_date,
      due_time: payload.due_time !== undefined ? payload.due_time : existing.due_time,
      updated_at: now,
    });

    if (!updated) {
      throw new Error(`Failed to update task with id "${payload.id}".`);
    }
    return updated;
  }

  public toggleComplete(id: string): Task {
    const existing = this.getById(id);
    const newStatus = existing.is_completed === 1 ? 0 : 1;
    return this.update({
      id,
      is_completed: newStatus,
    });
  }

  public delete(id: string): boolean {
    return this.repository.delete(id);
  }
}
