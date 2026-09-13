import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { PomodoroRepository } from '../repositories/PomodoroRepository.js';
import type { CreatePomodoroPayload } from '@shared/types/index.js';

export function registerPomodoroHandlers(repo = new PomodoroRepository()): void {
  ipcMain.handle(IPC.POMODORO.START, async (_event, payload: CreatePomodoroPayload) => {
    try {
      const data = repo.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.STOP, async (_event, { id, endedAt }: { id: string; endedAt?: string }) => {
    try {
      repo.complete(id, endedAt);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.GET_TODAY_STATS, async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = repo.getStats(today, today);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.POMODORO.GET_SESSIONS, async (_event, taskId: string) => {
    try {
      const data = repo.getByTaskId(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerPomodoroHandlers;
