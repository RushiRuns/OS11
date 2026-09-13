import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ModuleRepository } from '../repositories/ModuleRepository.js';

export function registerModuleHandlers(repo = new ModuleRepository()): void {
  ipcMain.handle(IPC.MODULES.GET_ALL, async () => {
    try {
      const data = repo.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MODULES.SET_ACTIVE, async (_event, { moduleName, enabled }: { moduleName: string; enabled: boolean }) => {
    try {
      repo.toggle(moduleName, enabled);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerModuleHandlers;
