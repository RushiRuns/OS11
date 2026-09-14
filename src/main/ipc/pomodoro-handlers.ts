import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { PomodoroService } from '../services/pomodoro/PomodoroService.js';
import { setTrayPomodoroActionCallback } from '../tray/tray.js';
import { getMainWindow } from '../window/main-window.js';
import type { CreatePomodoroPayload, ActivePomodoroSession } from '@shared/types/index.js';

export function registerPomodoroHandlers(service = new PomodoroService()): void {
  // Wire tray context menu callbacks to forward remote actions to renderer
  setTrayPomodoroActionCallback((action: 'pause' | 'resume' | 'skip' | 'reset') => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('pomodoro:remote-action', action);
    }
  });

  ipcMain.handle(IPC.POMODORO.START, async (_event, payload: CreatePomodoroPayload) => {
    try {
      const data = service.startSession(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.STOP, async (_event, { id, endedAt }: { id: string; endedAt?: string }) => {
    try {
      service.completeSession(id, endedAt);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.GET_TODAY_STATS, async () => {
    try {
      const data = service.getTodayStats();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.GET_SESSIONS, async (_event, taskId: string) => {
    try {
      const data = service.getByTaskId(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.POMODORO.SYNC_STATE,
    async (
      _event,
      payload: {
        activeSession: ActivePomodoroSession | null;
        timeText: string | null;
        progress?: number;
      }
    ) => {
      try {
        service.syncState(payload);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.POMODORO.SHOW_MINI_WINDOW, async () => {
    try {
      service.showMiniWindow();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.HIDE_MINI_WINDOW, async () => {
    try {
      service.hideMiniWindow();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.ACTION, async (_event, action: 'pause' | 'resume' | 'skip' | 'reset') => {
    try {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('pomodoro:remote-action', action);
      }
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerPomodoroHandlers;
