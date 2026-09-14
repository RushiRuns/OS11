import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IPC } from '@shared/ipc-channels.js';
import { ImportService } from '../services/import/ImportService.js';
import type { ImportOptions, ImportFormat, ImportProgress } from '@shared/types/index.js';

export function registerImportHandlers(importService = new ImportService()): void {
  ipcMain.handle(IPC.IMPORT.SELECT_FILE, async (_event, format?: ImportFormat) => {
    try {
      if (typeof dialog === 'undefined' || !dialog.showOpenDialog) {
        return { ok: false, error: 'File dialog unavailable in current environment.' };
      }

      let extensions = ['json', 'csv'];
      if (format === 'os11_json' || format === 'todoist_json') {
        extensions = ['json'];
      } else if (format === 'ms_todo_csv' || format === 'notion_csv') {
        extensions = ['csv'];
      }

      const res = await dialog.showOpenDialog({
        title: 'Select File to Import',
        properties: ['openFile'],
        filters: [
          { name: 'Supported Data Files', extensions },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (res.canceled || res.filePaths.length === 0) {
        return { ok: true, data: null };
      }

      const selectedPath = res.filePaths[0];
      const content = fs.readFileSync(selectedPath, 'utf-8');
      const fileName = path.basename(selectedPath);

      return {
        ok: true,
        data: {
          filePath: selectedPath,
          fileName,
          content,
        },
      };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.IMPORT.EXECUTE, async (event, options: ImportOptions) => {
    try {
      let content = options.content;
      if (!content && options.filePath && fs.existsSync(options.filePath)) {
        content = fs.readFileSync(options.filePath, 'utf-8');
      }

      const progressCallback = (progress: ImportProgress) => {
        try {
          event.sender.send(IPC.IMPORT.PROGRESS, progress);
        } catch {
          // Window may be closed or backgrounded
        }
      };

      const result = await importService.importData(
        { ...options, content },
        progressCallback
      );

      return { ok: result.success, data: result, error: result.error };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerImportHandlers;
