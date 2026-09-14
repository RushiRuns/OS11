import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { BackgroundService } from '../services/settings/BackgroundService.js';

export function registerBackgroundHandlers(service = new BackgroundService()): void {
  ipcMain.handle(IPC.BACKGROUNDS.UPLOAD, async (_event, payload?: { sourcePath?: string }) => {
    try {
      if (payload?.sourcePath) {
        const item = service.upload(payload.sourcePath);
        return { ok: true, data: item };
      }
      const item = await service.pickAndUpload();
      return { ok: true, data: item };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKGROUNDS.GET_ALL, async () => {
    try {
      const items = service.getAll();
      return { ok: true, data: items };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerBackgroundHandlers;
