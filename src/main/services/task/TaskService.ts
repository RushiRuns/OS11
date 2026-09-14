import { TaskRepository } from '../../repositories/TaskRepository.js';
import { IdentityRepository } from '../../repositories/IdentityRepository.js';
import { ReminderRepository } from '../../repositories/ReminderRepository.js';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { TagRepository } from '../../repositories/TagRepository.js';
import { validateCreate, validateUpdate, ValidationError } from '../../domain/task-validation.js';
import { calculateNextOccurrence } from '../../../shared/utils/recurrence.js';
import { wouldCreateCycle } from '../../domain/dependency-check.js';
import { workerManager } from '../worker-manager.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/index.js';
import DOMPurify from 'dompurify';

function sanitizeHtml(html: string): string {
  if (!html) return '';
  try {
    const purify = DOMPurify as unknown as { sanitize?: (s: string) => string };
    if (typeof purify.sanitize === 'function') {
      return purify.sanitize(html);
    }
  } catch {
    // Fallback in Node main process if window is unavailable
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

export class TaskService {
  private taskRepo: TaskRepository;
  private identityRepo: IdentityRepository;
  private reminderRepo: ReminderRepository;
  private settingsRepo: SettingsRepository;
  private tagRepo: TagRepository;

  constructor(
    taskRepo?: TaskRepository,
    identityRepo?: IdentityRepository,
    reminderRepo?: ReminderRepository,
    settingsRepo?: SettingsRepository,
    tagRepo?: TagRepository
  ) {
    this.taskRepo = taskRepo ?? new TaskRepository();
    this.identityRepo = identityRepo ?? new IdentityRepository();
    this.reminderRepo = reminderRepo ?? new ReminderRepository();
    this.settingsRepo = settingsRepo ?? new SettingsRepository();
    this.tagRepo = tagRepo ?? new TagRepository();
  }

  public getAll(): Task[] {
    return this.taskRepo.getAllTasks();
  }

  public getById(id: string): Task {
    const task = this.taskRepo.getById(id);
    if (!task) {
      throw new ValidationError(`Task with id "${id}" not found.`);
    }
    return task;
  }

  public getByListId(listId: string, offset = 0, limit = 50): Task[] {
    return this.taskRepo.getByListId(listId, offset, limit);
  }

  public getFirst50(listId?: string): Task[] {
    return this.taskRepo.getFirst50(listId);
  }

  public getMyDay(date?: string): Task[] {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    return this.taskRepo.getMyDay(targetDate);
  }

  public getImportant(): Task[] {
    return this.taskRepo.getImportant();
  }

  public getPlanned(): Task[] {
    return this.taskRepo.getPlanned();
  }

  public getCompleted(): Task[] {
    return this.taskRepo.getCompleted();
  }

  public getTrashed(): Task[] {
    return this.taskRepo.getTrashed();
  }

  public getSubtasks(parentId: string): Task[] {
    return this.taskRepo.getSubtasks(parentId);
  }

  public create(payload: CreateTaskPayload): Task {
    validateCreate(payload);

    const identity = this.identityRepo.get();
    const sanitizedNotes = payload.notes ? sanitizeHtml(payload.notes) : null;

    const task = this.taskRepo.create({
      ...payload,
      notes: sanitizedNotes,
      assignee_device_id: identity.id,
    });

    // Auto-tag rules: if list_id is assigned, check settings 'auto_tag_rules'
    if (task.list_id) {
      try {
        const rules = this.settingsRepo.get<Record<string, string[]>>('auto_tag_rules');
        if (rules && rules[task.list_id] && Array.isArray(rules[task.list_id])) {
          for (const tagId of rules[task.list_id]) {
            this.tagRepo.addTagToTask(task.id, tagId);
          }
        }
      } catch {
        // Auto-tag rule application is non-blocking
      }
    }

    // Notify worker thread to index in background
    workerManager.send('INDEX_TASK', { id: task.id, title: task.title, notes: task.notes }).catch(() => {
      // Background indexing is best-effort; database triggers already sync FTS5
    });

    return task;
  }

  public update(idOrPayload: string | UpdateTaskPayload, fields?: UpdateTaskPayload): Task {
    const id = typeof idOrPayload === 'string' ? idOrPayload : idOrPayload.id;
    const actualFields = (typeof idOrPayload === 'string' ? fields : idOrPayload) ?? { id };

    validateUpdate({ ...actualFields, id });

    if (actualFields.notes) {
      actualFields.notes = sanitizeHtml(actualFields.notes);
    }

    const updated = this.taskRepo.update(id, actualFields);

    // Notify worker thread to update index
    workerManager.send('INDEX_TASK', { id: updated.id, title: updated.title, notes: updated.notes }).catch(() => {
      // Best-effort notification
    });

    return updated;
  }

  public complete(id: string, options?: { skipRecurrence?: boolean }): Task {
    const existing = this.getById(id);
    const now = new Date().toISOString();

    this.taskRepo.complete(id, now);
    const completedTask = this.getById(id);

    // If task has recurrence rule and skipRecurrence is not requested, create next instance automatically
    if (existing.recurrence_rule && !options?.skipRecurrence) {
      const nextDate = calculateNextOccurrence(
        existing.recurrence_rule,
        existing.recurrence_basis,
        existing.due_date,
        new Date()
      );
      if (nextDate) {
        const nextDateStr = nextDate.toISOString().split('T')[0];
        this.create({
          title: existing.title,
          notes: existing.notes,
          list_id: existing.list_id,
          project_id: existing.project_id,
          section_id: existing.section_id,
          parent_task_id: existing.parent_task_id,
          due_date: nextDateStr,
          due_time: existing.due_time,
          all_day: existing.all_day === 1,
          recurrence_rule: existing.recurrence_rule,
          recurrence_basis: existing.recurrence_basis,
          priority: existing.priority,
          is_starred: existing.is_starred === 1,
          estimated_minutes: existing.estimated_minutes,
        });
      }
    }

    return completedTask;
  }

  public uncomplete(id: string): Task {
    this.taskRepo.uncomplete(id);
    return this.getById(id);
  }

  public toggleComplete(id: string, options?: { skipRecurrence?: boolean }): Task {
    const existing = this.getById(id);
    return existing.is_completed === 1 ? this.uncomplete(id) : this.complete(id, options);
  }

  public star(id: string): Task {
    this.taskRepo.star(id);
    return this.getById(id);
  }

  public unstar(id: string): Task {
    this.taskRepo.unstar(id);
    return this.getById(id);
  }

  public trash(id: string): Task {
    const now = new Date().toISOString();
    this.taskRepo.trash(id, now);

    // Cancel all scheduled reminders for this trashed task
    try {
      this.reminderRepo.deleteByTaskId(id);
    } catch {
      // Ignore if no reminders exist
    }

    return this.getById(id);
  }

  public restore(id: string): Task {
    this.taskRepo.restore(id);
    return this.getById(id);
  }

  public delete(id: string): boolean {
    this.taskRepo.permanentDelete(id);
    return true;
  }

  public addToMyDay(id: string, date?: string): Task {
    const targetDate = date ?? new Date().toISOString().split('T')[0];
    this.taskRepo.addToMyDay(id, targetDate);
    return this.getById(id);
  }

  public removeFromMyDay(id: string): Task {
    this.taskRepo.removeFromMyDay(id);
    return this.getById(id);
  }

  public moveToList(id: string, listId: string): Task {
    return this.update(id, { id, list_id: listId });
  }

  public makeSubtask(id: string, parentId: string): Task {
    if (id === parentId) {
      throw new ValidationError('A task cannot be a subtask of itself.');
    }

    // Cycle check: verify parentId does not depend on id
    const existingSubtasks = this.taskRepo.getSubtasks(id);
    const subtaskIds = new Set(existingSubtasks.map((s) => s.id));
    if (subtaskIds.has(parentId)) {
      throw new ValidationError('Cannot make task a subtask: creates a cyclic hierarchy.');
    }

    // Check dependency cycle
    const cycle = wouldCreateCycle(id, parentId, () => {
      // Return parent-child relationships as dependency edges
      return this.taskRepo.getAllTasks()
        .filter((t) => t.parent_task_id !== null)
        .map((t) => ({ task_id: t.id, depends_on_task_id: t.parent_task_id! }));
    });

    if (cycle) {
      throw new ValidationError('Cyclic subtask relationship detected.');
    }

    return this.taskRepo.update(id, { parent_task_id: parentId });
  }

  public promoteToTask(id: string): Task {
    return this.taskRepo.update(id, { parent_task_id: null });
  }

  public reorder(id: string, sortOrder: number): Task {
    this.taskRepo.updateSortOrder(id, sortOrder);
    return this.getById(id);
  }

  public duplicate(id: string): Task {
    const existing = this.getById(id);
    return this.create({
      title: `${existing.title} (Copy)`,
      notes: existing.notes,
      list_id: existing.list_id,
      project_id: existing.project_id,
      section_id: existing.section_id,
      due_date: existing.due_date,
      due_time: existing.due_time,
      all_day: existing.all_day === 1,
      recurrence_rule: existing.recurrence_rule,
      recurrence_basis: existing.recurrence_basis,
      priority: existing.priority,
      is_starred: existing.is_starred === 1,
      estimated_minutes: existing.estimated_minutes,
    });
  }
}

export default TaskService;
