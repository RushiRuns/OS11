import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { AppLockService } from '../services/security/AppLockService.js';

export function registerSecurityHandlers(service = new AppLockService()): void {
  ipcMain.handle(IPC.SECURITY.GET_STATUS, async () => {
    try {
      const data = service.getStatus();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECURITY.SET_PIN, async (_event, { pin }: { pin: string }) => {
    try {
      const success = await service.setPin(pin);
      return { ok: true, data: success };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECURITY.VERIFY_PIN, async (_event, { pin }: { pin: string }) => {
    try {
      const valid = await service.verifyPin(pin);
      return { ok: true, data: valid };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECURITY.SET_ENABLED, async (_event, { enabled, currentPin }: { enabled: boolean; currentPin?: string }) => {
    try {
      const result = await service.setEnabled(enabled, currentPin);
      return { ok: true, data: result };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECURITY.LOCK, async () => {
    try {
      service.lock();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECURITY.UNLOCK, async () => {
    try {
      service.unlock();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerSecurityHandlers;
