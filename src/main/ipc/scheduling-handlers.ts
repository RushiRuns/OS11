import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { TaskSchedulingService } from '../services/task/TaskSchedulingService.js';
import { TaskRepository } from '../repositories/TaskRepository.js';
import type {
  SetBucketPayload,
  SetDatePayload,
  SetWaitingPayload,
  SchedulingColumns,
} from '@shared/types/index.js';

export function registerSchedulingHandlers(
  schedulingService = new TaskSchedulingService(),
  taskRepo = new TaskRepository()
): void {
  ipcMain.handle(IPC.TASKS.SET_BUCKET, async (_event, payload: SetBucketPayload) => {
    try {
      const data = schedulingService.setBucket(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.CLEAR_BUCKET, async (_event, taskId: string) => {
    try {
      const data = schedulingService.clearBucket(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.SET_DATE, async (_event, payload: SetDatePayload) => {
    try {
      const data = schedulingService.setDate(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.CLEAR_DATE, async (_event, taskId: string) => {
    try {
      const data = schedulingService.clearDate(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  const handleSetWaiting = async (_event: unknown, payload: SetWaitingPayload) => {
    try {
      const data = schedulingService.setWaiting(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
  ipcMain.handle(IPC.TASKS.SET_WAITING, handleSetWaiting);
  ipcMain.handle(IPC.TASKS.MARK_WAITING, handleSetWaiting);

  const handleClearWaiting = async (_event: unknown, taskId: string) => {
    try {
      const data = schedulingService.clearWaiting(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
  ipcMain.handle(IPC.TASKS.CLEAR_WAITING, handleClearWaiting);
  ipcMain.handle(IPC.TASKS.RESOLVE_WAITING, handleClearWaiting);

  ipcMain.handle(
    IPC.TASKS.GET_ANYTIME,
    async (_event, filter?: { areaId?: string; projectId?: string }) => {
      try {
        const data = taskRepo.getAnytime(filter);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.TASKS.GET_SOMEDAY, async (_event, filter?: { projectId?: string }) => {
    try {
      const data = taskRepo.getSomeday(filter);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.GET_WAITING, async () => {
    try {
      const data = taskRepo.getWaitingFor();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.GET_GTD_COUNTS, async (_event, today?: string) => {
    try {
      const data = schedulingService.getGtdCounts(today);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.TASKS.RESTORE_SCHEDULING_STATE,
    async (_event, payload: { taskId: string; state: SchedulingColumns }) => {
      try {
        const data = schedulingService.restoreSchedulingState(payload.taskId, payload.state);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.TASKS.GET_RECENT_WAITING_ON, async (_event, limit?: number) => {
    try {
      const data = taskRepo.getRecentWaitingOn(limit ?? 10);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.TASKS.SNOOZE_FOLLOW_UP,
    async (_event, payload: { taskId: string; followUpDate: string }) => {
      try {
        const task = taskRepo.getById(payload.taskId);
        if (!task) {
          throw new Error(`Task not found: ${payload.taskId}`);
        }
        const updated = taskRepo.updateSchedulingFields(
          payload.taskId,
          {
            bucket: task.bucket ?? null,
            due_date: task.due_date ?? null,
            due_time: task.due_time ?? null,
            all_day: task.all_day ?? 0,
            recurrence_rule: task.recurrence_rule ?? null,
            waiting_on: task.waiting_on ?? null,
            waiting_since: task.waiting_since ?? null,
            follow_up_date: payload.followUpDate,
            follow_up_notified_on: null,
            reviewed_at: task.reviewed_at ?? null,
          },
          new Date().toISOString()
        );
        return { ok: true, data: updated };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerSchedulingHandlers;
