import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { CalendarService } from '../services/calendar/CalendarService.js';
import type { CalendarProvider } from '@shared/types/index.js';

export function registerCalendarHandlers(service = new CalendarService()): void {
  ipcMain.handle(IPC.CALENDAR.GET_STATUS, async () => {
    try {
      const data = service.getStatus();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CALENDAR.GET_EVENTS, async (_event, payload?: { from?: string; to?: string }) => {
    try {
      const data = await service.getEvents(payload?.from, payload?.to);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CALENDAR.CONNECT, async (_event, provider: CalendarProvider) => {
    try {
      const data = await service.connectProvider(provider);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CALENDAR.DISCONNECT, async (_event, provider: CalendarProvider) => {
    try {
      const data = await service.disconnectProvider(provider);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CALENDAR.SYNC_TASK, async (_event, { taskId, provider }: { taskId: string; provider?: CalendarProvider }) => {
    try {
      const data = await service.syncTaskToCalendar(taskId, provider);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerCalendarHandlers;
