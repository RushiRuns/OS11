import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { BackupService } from '../services/backup/BackupService.js';
import type { BackupSettings } from '@shared/types/index.js';

export function registerBackupHandlers(backupService = new BackupService()): void {
  ipcMain.handle(IPC.BACKUP.GET_SETTINGS, async () => {
    try {
      const data = backupService.getSettings();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKUP.SET_SETTINGS, async (_event, updates: Partial<BackupSettings>) => {
    try {
      const data = backupService.updateSettings(updates);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKUP.LIST, async () => {
    try {
      const data = backupService.listBackups();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKUP.CREATE, async (_event, destinationFolder?: string) => {
    try {
      const data = await backupService.createBackup(destinationFolder);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKUP.RESTORE, async (_event, backupFilePath?: string) => {
    try {
      let targetPath = backupFilePath;
      if (!targetPath && typeof dialog !== 'undefined' && dialog.showOpenDialog) {
        const res = await dialog.showOpenDialog({
          title: 'Select Backup File to Restore',
          properties: ['openFile'],
          filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
        });
        if (res.canceled || res.filePaths.length === 0) {
          return { ok: false, error: 'Restore canceled: No file selected.' };
        }
        targetPath = res.filePaths[0];
      }

      if (!targetPath) {
        return { ok: false, error: 'No backup file path provided.' };
      }

      const result = await backupService.restoreFromBackup(targetPath);
      return { ok: result.success, data: result, error: result.error };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.BACKUP.SELECT_FOLDER, async () => {
    try {
      if (typeof dialog === 'undefined' || !dialog.showOpenDialog) {
        return { ok: false, error: 'Folder selection dialog unavailable.' };
      }

      const res = await dialog.showOpenDialog({
        title: 'Select Backup Destination Folder',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (res.canceled || res.filePaths.length === 0) {
        return { ok: true, data: null };
      }

      return { ok: true, data: res.filePaths[0] };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerBackupHandlers;
