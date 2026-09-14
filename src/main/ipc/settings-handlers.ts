import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { SettingsService } from '../services/settings/SettingsService.js';
import { ThemeService } from '../services/settings/ThemeService.js';
import type { SettingsMap } from '@shared/types/index.js';

export function registerSettingsHandlers(
  service = new SettingsService(),
  themeService = new ThemeService()
): void {
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
        themeService.applyTheme(value as SettingsMap['theme']);
        service.set('theme', value);
      } else if (key === 'accent_color') {
        themeService.applyAccentColor(value as string);
        service.set('accent_color', value);
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
      themeService.applyTheme('auto');
      themeService.applyAccentColor('#1B88FF');
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SETTINGS.EMPTY_TRASH, async () => {
    try {
      const deletedCount = service.emptyTrash();
      return { ok: true, data: deletedCount };
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
