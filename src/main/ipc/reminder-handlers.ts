import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ReminderService } from '../services/reminder/ReminderService.js';
import type { CreateReminderPayload } from '@shared/types/index.js';

export function registerReminderHandlers(service = new ReminderService()): void {
  ipcMain.handle(IPC.REMINDERS.GET_ALL, async () => {
    try {
      const data = service.getUpcomingAndOverdue();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.REMINDERS.SET, async (_event, payload: CreateReminderPayload) => {
    try {
      const data = service.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.REMINDERS.DISMISS, async (_event, id: string) => {
    try {
      service.cancel(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.REMINDERS.SNOOZE, async (_event, { id, until }: { id: string; until: string }) => {
    try {
      service.snooze(id, until);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.REMINDERS.GET_BY_TASK, async (_event, taskId: string) => {
    try {
      const data = service.getByTaskId(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.REMINDERS.DELETE, async (_event, id: string) => {
    try {
      service.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerReminderHandlers;
