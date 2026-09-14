import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { IdentityRepository } from '../repositories/IdentityRepository.js';

export function registerIdentityHandlers(repo = new IdentityRepository()): void {
  ipcMain.handle(IPC.IDENTITY.GET, async () => {
    try {
      const data = repo.get();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.IDENTITY.UPDATE,
    async (
      _event,
      payload: { displayName?: string; avatarEmoji?: string | null }
    ) => {
      try {
        repo.updateIdentity(payload?.displayName, payload?.avatarEmoji);
        const data = repo.get();
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerIdentityHandlers;
