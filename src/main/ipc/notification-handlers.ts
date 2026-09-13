import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { NotificationService } from '../services/notification/NotificationService.js';

export function registerNotificationHandlers(service = new NotificationService()): void {
  ipcMain.handle(IPC.NOTIFICATIONS.GET_HISTORY, async () => {
    try {
      const data = service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.NOTIFICATIONS.CLEAR, async () => {
    try {
      service.clear();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.NOTIFICATIONS.MARK_READ, async (_event, id: string) => {
    try {
      service.markRead(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.NOTIFICATIONS.MARK_ALL_READ, async () => {
    try {
      service.markAllRead();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.NOTIFICATIONS.SEND_NATIVE,
    async (
      _event,
      {
        type,
        title,
        body,
        taskId,
      }: {
        type: 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak';
        title: string;
        body: string;
        taskId?: string;
      }
    ) => {
      try {
        service.send(type, title, body, taskId);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerNotificationHandlers;
