import { TaskRepository } from '../../repositories/TaskRepository.js';
import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { IdentityRepository } from '../../repositories/IdentityRepository.js';
import { ReminderRepository } from '../../repositories/ReminderRepository.js';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { TagRepository } from '../../repositories/TagRepository.js';
import { TaskHistoryRepository } from '../../repositories/TaskHistoryRepository.js';
import { validateCreate, validateUpdate, ValidationError } from '../../domain/task-validation.js';
import { validateTimeBlock, findOverlap } from '../../domain/timeBlock.js';
import { getEffectiveToday } from '../../../shared/utils/date.js';
import { calculateNextOccurrence } from '../../../shared/utils/recurrence.js';
import { wouldCreateCycle } from '../../domain/dependency-check.js';
import { workerManager } from '../worker-manager.js';
import { AttachmentService } from '../attachment/AttachmentService.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload, TaskHistoryRecord } from '@shared/types/index.js';
import type Database from 'better-sqlite3';
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
  private projectRepo: ProjectRepository;
  private identityRepo: IdentityRepository;
  private reminderRepo: ReminderRepository;
  private settingsRepo: SettingsRepository;
  private tagRepo: TagRepository;
  private historyRepo: TaskHistoryRepository;
  private attachmentService?: AttachmentService;

  constructor(
    taskRepo?: TaskRepository,
    identityRepo?: IdentityRepository,
    reminderRepo?: ReminderRepository,
    settingsRepo?: SettingsRepository,
    tagRepo?: TagRepository,
    historyRepo?: TaskHistoryRepository,
    attachmentService?: AttachmentService,
    projectRepo?: ProjectRepository
  ) {
    this.taskRepo = taskRepo ?? new TaskRepository();
    this.projectRepo = projectRepo ?? new ProjectRepository();
    this.identityRepo = identityRepo ?? new IdentityRepository();
    this.reminderRepo = reminderRepo ?? new ReminderRepository();
    this.settingsRepo = settingsRepo ?? new SettingsRepository();
    this.tagRepo = tagRepo ?? new TagRepository();
    const customDb = (this.taskRepo as unknown as { customDb?: Database.Database }).customDb;
    this.historyRepo = historyRepo ?? new TaskHistoryRepository(customDb);
    this.attachmentService = attachmentService;
  }

  public getAll(): Task[] {
    return this.taskRepo.getAll();
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

  public getByAreaId(areaId: string): Task[] {
    return this.taskRepo.getByAreaId(areaId);
  }

  public getInbox(): Task[] {
    return this.taskRepo.getInbox();
  }

  public create(payload: CreateTaskPayload): Task {
    validateCreate(payload);

    let area_id = payload.area_id ?? null;
    if (payload.project_id && !area_id) {
      try {
        const proj = this.projectRepo.getById(payload.project_id);
        if (proj?.area_id) {
          area_id = proj.area_id;
        }
      } catch {
        // fallback
      }
    }

    const identity = this.identityRepo.get();
    const sanitizedNotes = payload.notes ? sanitizeHtml(payload.notes) : null;

    const task = this.taskRepo.create({
      ...payload,
      area_id,
      notes: sanitizedNotes,
      assignee_device_id: identity.id,
    });

    // Auto-tag rules: if project_id, area_id, or list_id is assigned, check settings 'auto_tag_rules'
    const targetContainer = task.project_id || task.area_id || task.list_id;
    if (targetContainer) {
      try {
        const rules = this.settingsRepo.get<Record<string, string[]>>('auto_tag_rules');
        if (rules && rules[targetContainer] && Array.isArray(rules[targetContainer])) {
          for (const tagId of rules[targetContainer]) {
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

    if (actualFields.project_id !== undefined && actualFields.project_id !== null && !actualFields.area_id) {
      try {
        const proj = this.projectRepo.getById(actualFields.project_id);
        if (proj?.area_id) {
          actualFields.area_id = proj.area_id;
        }
      } catch {
        // fallback
      }
    }

    if (actualFields.notes) {
      actualFields.notes = sanitizeHtml(actualFields.notes);
    }

    const existing = this.taskRepo.getById(id);
    if (existing) {
      const diffs: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, value] of Object.entries(actualFields)) {
        if (key === 'id' || key === 'updated_at') continue;
        const oldVal = (existing as unknown as Record<string, unknown>)[key];
        if (
          oldVal !== value &&
          !(oldVal === null && (value === undefined || value === '')) &&
          !(oldVal === undefined && value === null)
        ) {
          diffs[key] = { from: oldVal ?? null, to: value ?? null };
        }
      }
      if (Object.keys(diffs).length > 0) {
        try {
          this.historyRepo.record(id, diffs);
        } catch {
          // History recording is best-effort
        }
      }
    }

    const updated = this.taskRepo.update(id, actualFields);

    // If project_id or area_id was modified on this task, cascade to all child subtasks recursively
    if (actualFields.project_id !== undefined || actualFields.area_id !== undefined) {
      this.cascadeContainerToSubtasks(id, updated.area_id ?? null, updated.project_id ?? null);
    }

    // Notify worker thread to update index
    workerManager.send('INDEX_TASK', { id: updated.id, title: updated.title, notes: updated.notes }).catch(() => {
      // Best-effort notification
    });

    return updated;
  }

  private cascadeContainerToSubtasks(parentId: string, areaId: string | null, projectId: string | null): void {
    const subtasks = this.taskRepo.getSubtasks(parentId);
    for (const sub of subtasks) {
      this.taskRepo.update(sub.id, {
        area_id: areaId,
        project_id: projectId,
      });
      this.cascadeContainerToSubtasks(sub.id, areaId, projectId);
    }
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
          area_id: existing.area_id,
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
    if (this.attachmentService) {
      try {
        this.attachmentService.deleteByTaskId(id);
      } catch {
        // Best-effort attachment file cleanup
      }
    }
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

  private getEffectiveTodayDate(): string {
    const settings = this.settingsRepo.getAll();
    const dayStartsAt = typeof settings.day_starts_at === 'string' ? settings.day_starts_at : '08:00';
    return getEffectiveToday(dayStartsAt);
  }

  public scheduleTask(id: string, startMin: number, durationMin: number): Task {
    validateTimeBlock(startMin, durationMin);
    const task = this.getById(id);
    if (task.is_trashed === 1) {
      throw new ValidationError('Cannot schedule a trashed task.');
    }
    const today = this.getEffectiveTodayDate();
    if (task.my_day_date !== today) {
      throw new ValidationError('Task must be in My Day for today to be scheduled.');
    }
    if (task.is_completed === 1) {
      throw new ValidationError('Cannot schedule a completed task.');
    }

    const myDayTasks = this.getMyDay(today);
    const occupied = myDayTasks
      .filter(
        (t) =>
          t.id !== id &&
          t.is_trashed === 0 &&
          typeof t.scheduled_start_min === 'number' &&
          typeof t.scheduled_duration_min === 'number'
      )
      .map((t) => ({
        id: t.id,
        start: t.scheduled_start_min!,
        duration: t.scheduled_duration_min!,
      }));

    if (findOverlap(occupied, { start: startMin, duration: durationMin })) {
      throw new ValidationError('Time slot overlaps with another scheduled block.');
    }

    return this.taskRepo.setTimeBlock(id, startMin, durationMin);
  }

  public updateTimeBlock(id: string, startMin: number, durationMin: number): Task {
    validateTimeBlock(startMin, durationMin);
    const task = this.getById(id);
    if (task.is_trashed === 1) {
      throw new ValidationError('Cannot update time block of a trashed task.');
    }
    const today = this.getEffectiveTodayDate();

    const myDayTasks = this.getMyDay(today);
    const occupied = myDayTasks
      .filter(
        (t) =>
          t.id !== id &&
          t.is_trashed === 0 &&
          typeof t.scheduled_start_min === 'number' &&
          typeof t.scheduled_duration_min === 'number'
      )
      .map((t) => ({
        id: t.id,
        start: t.scheduled_start_min!,
        duration: t.scheduled_duration_min!,
      }));

    if (findOverlap(occupied, { start: startMin, duration: durationMin }, id)) {
      throw new ValidationError('Time slot overlaps with another scheduled block.');
    }

    return this.taskRepo.setTimeBlock(id, startMin, durationMin);
  }

  public unscheduleTask(id: string): Task {
    return this.taskRepo.clearTimeBlock(id);
  }

  public rollOverToToday(ids: string[], today?: string): Task[] {
    const targetDate = today ?? this.getEffectiveTodayDate();
    return this.taskRepo.rollOverToToday(ids, targetDate);
  }

  public ensureDayRollover(dateStr?: string): number {
    const effectiveToday = dateStr ?? this.getEffectiveTodayDate();
    return this.taskRepo.clearAllTimeBlocks(effectiveToday);
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
      return this.taskRepo.getAll()
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
      area_id: existing.area_id,
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

  public incrementPomodoro(id: string): Task {
    return this.taskRepo.incrementPomodoro(id);
  }

  public getHistory(taskId: string, limit = 50): TaskHistoryRecord[] {
    return this.historyRepo.getByTaskId(taskId, limit);
  }

  public restoreVersion(historyId: string): Task {
    const record = this.historyRepo.getById(historyId);
    if (!record) {
      throw new ValidationError(`Task history record with id "${historyId}" not found.`);
    }

    const rollbackFields: Record<string, unknown> = { id: record.task_id };
    for (const [field, diff] of Object.entries(record.changed_fields)) {
      rollbackFields[field] = diff.from;
    }

    return this.update(record.task_id, rollbackFields as unknown as UpdateTaskPayload);
  }

  public purgeOldHistory(days = 30): number {
    return this.historyRepo.purgeOlderThan(days);
  }
}

export default TaskService;
