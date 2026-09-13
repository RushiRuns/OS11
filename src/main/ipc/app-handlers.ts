import { ipcMain, BrowserWindow, app } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { getStartupData } from '../startup.js';

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
}

export default registerAppHandlers;
