import { ipcMain, BrowserWindow, app } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { getStartupData } from '../startup.js';
import { getMainWindow, setAlwaysOnTop } from '../window/main-window.js';
import { showOmnibarWindow, hideOmnibarWindow } from '../window/omnibar-window.js';
import { checkForUpdates } from '../services/updater.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';

export function registerAppHandlers(): void {
  ipcMain.handle(IPC.APP.GET_STARTUP_DATA, async () => {
    try {
      const data = await getStartupData();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.APP.GET_INFO, async () => {
    try {
      return {
        ok: true,
        data: {
          name: 'OS11',
          version: typeof app !== 'undefined' && app.getVersion ? app.getVersion() : '0.1.0',
          platform: process.platform,
        },
      };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Window Controls for APP & SYSTEM
  const minimizeHandler = async (event: Electron.IpcMainInvokeEvent) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.minimize();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const maximizeHandler = async (event: Electron.IpcMainInvokeEvent) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win?.isMaximized()) {
        win.unmaximize();
      } else {
        win?.maximize();
      }
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const closeHandler = async (event: Electron.IpcMainInvokeEvent) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.close();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  ipcMain.handle(IPC.APP.MINIMIZE, minimizeHandler);
  ipcMain.handle(IPC.SYSTEM.MINIMIZE, minimizeHandler);

  ipcMain.handle(IPC.APP.MAXIMIZE, maximizeHandler);
  ipcMain.handle(IPC.SYSTEM.MAXIMIZE, maximizeHandler);

  ipcMain.handle(IPC.APP.CLOSE, closeHandler);
  ipcMain.handle(IPC.SYSTEM.CLOSE, closeHandler);

  ipcMain.handle(IPC.APP.QUIT, async () => {
    try {
      app.quit();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Always on top & opacity controls
  ipcMain.handle(
    IPC.APP.SET_ALWAYS_ON_TOP,
    async (_event, payload: { pinned: boolean; opacity?: number }) => {
      try {
        const settingsRepo = new SettingsRepository();
        const pinned = setAlwaysOnTop(payload.pinned, payload.opacity);
        settingsRepo.set('always_on_top', pinned);
        if (payload.opacity !== undefined) {
          settingsRepo.set('always_on_top_opacity', payload.opacity);
        }

        return { ok: true, data: { pinned, opacity: payload.opacity ?? 1.0 } };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.APP.GET_ALWAYS_ON_TOP, async () => {
    try {
      const win = getMainWindow();
      const isPinned = win ? win.isAlwaysOnTop() : false;
      return { ok: true, data: isPinned };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.APP.SET_OPACITY, async (_event, payload: { opacity: number }) => {
    try {
      const settingsRepo = new SettingsRepository();
      const win = getMainWindow();
      const clamped = Math.max(0.5, Math.min(1.0, payload.opacity));
      if (win && !win.isDestroyed()) {
        win.setOpacity(clamped);
      }
      settingsRepo.set('always_on_top_opacity', clamped);
      return { ok: true, data: clamped };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Omnibar window controls
  ipcMain.handle(IPC.APP.SHOW_OMNIBAR, async () => {
    try {
      showOmnibarWindow();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.APP.HIDE_OMNIBAR, async () => {
    try {
      hideOmnibarWindow();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Update check
  ipcMain.handle(IPC.APP.CHECK_FOR_UPDATES, async () => {
    try {
      checkForUpdates();
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // Theme & Accent Runtime Engine
  ipcMain.handle(IPC.APP.SET_THEME, async (_event, payload: { theme: 'auto' | 'dark' | 'light' | 'system' }) => {
    try {
      const { ThemeService } = await import('../services/settings/ThemeService.js');
      const service = new ThemeService();
      const result = service.applyTheme(payload.theme);
      return { ok: true, data: result };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.APP.SET_ACCENT_COLOR, async (_event, payload: { hex: string }) => {
    try {
      const { ThemeService } = await import('../services/settings/ThemeService.js');
      const service = new ThemeService();
      const result = service.applyAccentColor(payload.hex);
      return { ok: true, data: result };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerAppHandlers;

