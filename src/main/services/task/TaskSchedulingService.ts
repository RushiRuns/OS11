import type Database from 'better-sqlite3';
import { getDb } from '../../repositories/db.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { ReminderRepository } from '../../repositories/ReminderRepository.js';
import type { ReminderService } from '../reminder/ReminderService.js';
import { applySchedulingTransition } from '../../domain/scheduling.js';
import { isStalled } from '../../domain/project-health.js';
import type {
  Task,
  SchedulingState,
  SchedulingColumns,
  SchedulingCommand,
  SetBucketPayload,
  SetDatePayload,
  SetWaitingPayload,
  ReviewSomedayBatchPayload,
  GtdCounts,
  ChangeReport,
} from '@shared/types/index.js';

/**
 * Pure mapping from SQLite row (snake_case) to domain state (camelCase).
 * Exactly one mapping pair exists in this service.
 */
export function rowToSchedulingState(row: Task): SchedulingState {
  return {
    bucket: row.bucket ?? null,
    dueDate: row.due_date ?? null,
    dueTime: row.due_time ?? null,
    allDay: Boolean(row.all_day),
    recurrenceRule: row.recurrence_rule ?? null,
    waitingOn: row.waiting_on ?? null,
    waitingSince: row.waiting_since ?? null,
    followUpDate: row.follow_up_date ?? null,
    followUpNotifiedOn: row.follow_up_notified_on ?? null,
    reviewedAt: row.reviewed_at ?? null,
  };
}

/**
 * Pure mapping from domain state (camelCase) to SQLite columns (snake_case).
 * Exactly one mapping pair exists in this service.
 */
export function schedulingStateToColumns(state: SchedulingState): SchedulingColumns {
  return {
    bucket: state.bucket,
    due_date: state.dueDate,
    due_time: state.dueTime,
    all_day: state.allDay ? 1 : 0,
    recurrence_rule: state.recurrenceRule,
    waiting_on: state.waitingOn,
    waiting_since: state.waitingSince,
    follow_up_date: state.followUpDate,
    follow_up_notified_on: state.followUpNotifiedOn,
    reviewed_at: state.reviewedAt,
  };
}

/**
 * Single-writer architecture service for all task scheduling, buckets, waiting overlays, and follow-ups.
 */
export class TaskSchedulingService {
  private db: Database.Database;
  private taskRepo: TaskRepository;
  private projectRepo: ProjectRepository;
  private reminderRepo: ReminderRepository;
  private reminderService?: ReminderService;

  constructor(
    customDb?: Database.Database,
    taskRepo?: TaskRepository,
    projectRepo?: ProjectRepository,
    reminderRepo?: ReminderRepository,
    reminderService?: ReminderService
  ) {
    this.db = customDb ?? getDb();
    this.taskRepo = taskRepo ?? new TaskRepository(this.db);
    this.projectRepo = projectRepo ?? new ProjectRepository(this.db);
    this.reminderRepo = reminderRepo ?? new ReminderRepository(this.db);
    this.reminderService = reminderService;
  }

  /**
   * Core atomic state transition executor.
   */
  public executeTransition(
    taskId: string,
    command: SchedulingCommand,
    context?: { today?: string; timestamp?: string }
  ): { task: Task; changeReport: ChangeReport } {
    const currentTask = this.taskRepo.getById(taskId);
    if (!currentTask) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const currentState = rowToSchedulingState(currentTask);
    const { nextState, effects } = applySchedulingTransition(currentState, command, context);
    const nextCols = schedulingStateToColumns(nextState);

    let cancelledReminderIds: string[] = [];
    const now = context?.timestamp ?? new Date().toISOString();

    const runTx = this.db.transaction(() => {
      if (effects.cancelReminders) {
        cancelledReminderIds = this.reminderRepo.deleteByTaskId(taskId);
      }
      this.taskRepo.updateSchedulingFields(taskId, nextCols, now);
    });

    runTx();

    // Cancel in-memory Node timeouts *after* the SQLite transaction commits
    if (this.reminderService && cancelledReminderIds.length > 0) {
      for (const id of cancelledReminderIds) {
        this.reminderService.cancelTimer(id);
      }
    }

    const updatedTask = this.taskRepo.getById(taskId)!;

    const changeReport: ChangeReport = {
      taskId,
      cancelledReminderIds,
      clearedDate: effects.clearDate,
      clearedBucket: effects.clearBucket,
      clearedWaiting: effects.clearWaiting,
      previousState: schedulingStateToColumns(currentState),
      newState: nextCols,
    };

    return { task: updatedTask, changeReport };
  }

  public setDate(payload: SetDatePayload): { task: Task; changeReport: ChangeReport } {
    if (!payload.dueDate) {
      return this.clearDate(payload.taskId);
    }
    return this.executeTransition(payload.taskId, {
      type: 'SET_DATE',
      dueDate: payload.dueDate,
      dueTime: payload.dueTime ?? null,
      allDay: payload.allDay,
      recurrenceRule: payload.recurrenceRule ?? null,
    });
  }

  public clearDate(taskId: string): { task: Task; changeReport: ChangeReport } {
    return this.executeTransition(taskId, { type: 'CLEAR_DATE' });
  }

  public setBucket(payload: SetBucketPayload): { task: Task; changeReport: ChangeReport } {
    if (!payload.bucket) {
      return this.clearBucket(payload.taskId);
    }
    return this.executeTransition(payload.taskId, {
      type: 'SET_BUCKET',
      bucket: payload.bucket,
    });
  }

  public clearBucket(taskId: string): { task: Task; changeReport: ChangeReport } {
    return this.executeTransition(taskId, { type: 'CLEAR_BUCKET' });
  }

  public setWaiting(payload: SetWaitingPayload): { task: Task; changeReport: ChangeReport } {
    return this.executeTransition(payload.taskId, {
      type: 'SET_WAITING',
      waitingOn: payload.waitingOn,
      followUpDate: payload.followUpDate ?? null,
    });
  }

  public clearWaiting(taskId: string): { task: Task; changeReport: ChangeReport } {
    return this.executeTransition(taskId, { type: 'CLEAR_WAITING' });
  }

  /**
   * Reverts scheduling fields for Undo / Redo.
   */
  public restoreSchedulingState(
    taskId: string,
    previousState: SchedulingColumns
  ): { task: Task; changeReport: ChangeReport } {
    const currentTask = this.taskRepo.getById(taskId);
    if (!currentTask) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const currentState = rowToSchedulingState(currentTask);
    const now = new Date().toISOString();

    const runTx = this.db.transaction(() => {
      this.taskRepo.updateSchedulingFields(taskId, previousState, now);
    });
    runTx();

    const updatedTask = this.taskRepo.getById(taskId)!;

    const changeReport: ChangeReport = {
      taskId,
      cancelledReminderIds: [],
      clearedDate: Boolean(currentTask.due_date && !previousState.due_date),
      clearedBucket: Boolean(currentTask.bucket && !previousState.bucket),
      clearedWaiting: Boolean(currentTask.waiting_since && !previousState.waiting_since),
      previousState: schedulingStateToColumns(currentState),
      newState: previousState,
    };

    return { task: updatedTask, changeReport };
  }

  /**
   * Aggregates badge counts for GTD navigation, including stalled projects count.
   */
  public getGtdCounts(today?: string): GtdCounts {
    const effectiveToday = today ?? new Date().toISOString().split('T')[0];
    const taskCounts = this.taskRepo.getGtdTaskCounts(effectiveToday);

    // Calculate stalled active projects
    const allProjects = this.projectRepo.getAll();
    const activeProjects = allProjects.filter((p) => p.status === 'active' && p.is_someday !== 1);

    let stalledCount = 0;
    if (activeProjects.length > 0) {
      const allTasks = this.taskRepo.getAll();
      for (const proj of activeProjects) {
        if (isStalled(proj, allTasks)) {
          stalledCount++;
        }
      }
    }

    return {
      inbox: taskCounts.inbox,
      anytime: taskCounts.anytime,
      someday: taskCounts.someday,
      waitingFor: taskCounts.waitingFor,
      waitingOverdue: taskCounts.waitingOverdue,
      stalledProjects: stalledCount,
    };
  }

  /**
   * Marks a batch of someday tasks and projects as reviewed.
   */
  public reviewSomedayBatch(payload: ReviewSomedayBatchPayload): void {
    const now = new Date().toISOString();
    const runTx = this.db.transaction(() => {
      if (payload.taskIds.length > 0) {
        this.taskRepo.markSomedayReviewedBatch(payload.taskIds, now);
      }
      if (payload.projectIds.length > 0) {
        this.projectRepo.markReviewedBatch(payload.projectIds, now);
      }
    });
    runTx();
  }
}
