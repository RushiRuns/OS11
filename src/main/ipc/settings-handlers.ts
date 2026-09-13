import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { SettingsService } from '../services/settings/SettingsService.js';
import type { SettingsMap } from '@shared/types/index.js';

export function registerSettingsHandlers(service = new SettingsService()): void {
  ipcMain.handle(IPC.SETTINGS.GET_ALL, async () => {
    try {
      const data = service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SETTINGS.GET, async (_event, { key, defaultValue }: { key: string; defaultValue?: unknown }) => {
    try {
      const data = service.get(key, defaultValue);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SETTINGS.SET, async (_event, { key, value }: { key: string; value: unknown }) => {
    try {
      if (key === 'theme') {
        service.applyTheme(value as SettingsMap['theme']);
      } else if (key === 'accent_color') {
        service.applyAccentColor(value as string);
      } else if (key === 'launch_at_login') {
        service.applyLoginItem(Boolean(value));
      } else {
        service.set(key, value);
      }
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SETTINGS.RESET, async () => {
    try {
      const data = service.reset();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SYSTEM.GET_INFO, async () => {
    try {
      const data = service.getSystemInfo();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerSettingsHandlers;
