import { autoUpdater } from 'electron-updater';
import { getMainWindow } from '../window/main-window.js';
import { IPC } from '@shared/ipc-channels.js';

let isUpdaterInitialized = false;

export function initAutoUpdater(): void {
  if (isUpdaterInitialized) return;
  isUpdaterInitialized = true;

  try {
    // Configure background non-blocking download
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[OS11 AutoUpdater] Update available:', info.version);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.APP.UPDATE_AVAILABLE, {
          version: info.version,
          releaseDate: info.releaseDate,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[OS11 AutoUpdater] Update downloaded:', info.version);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.APP.UPDATE_DOWNLOADED, {
          version: info.version,
        });
      }
    });

    autoUpdater.on('error', (err) => {
      // Background non-blocking failure: log and continue
      console.warn('[OS11 AutoUpdater] Background update check encountered error:', err.message);
    });

    // Run initial background update check
    checkForUpdates();
  } catch (err) {
    console.warn('[OS11 AutoUpdater] Could not initialize electron-updater:', err);
  }
}

export function checkForUpdates(): void {
  try {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[OS11 AutoUpdater] Check for updates caught error:', err.message);
    });
  } catch (err) {
    console.warn('[OS11 AutoUpdater] Check for updates failed:', err);
  }
}

export default initAutoUpdater;
