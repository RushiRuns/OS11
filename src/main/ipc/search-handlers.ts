import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { workerManager } from '../services/worker-manager.js';

export function registerSearchHandlers(): void {
  ipcMain.handle(IPC.SEARCH.QUERY, async (_event, query: string) => {
    try {
      const data = await workerManager.search(query);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SEARCH.REINDEX, async () => {
    try {
      await workerManager.send('REINDEX');
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerSearchHandlers;
