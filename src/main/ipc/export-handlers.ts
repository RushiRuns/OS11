import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ExportService } from '../services/export/ExportService.js';
import type { ExportFormat, ExportOptions } from '@shared/types/index.js';

export function registerExportHandlers(exportService = new ExportService()): void {
  ipcMain.handle(IPC.EXPORT.SELECT_DESTINATION, async (_event, format: ExportFormat, defaultName?: string) => {
    try {
      const filePath = await exportService.promptSaveDialog(format, defaultName);
      return { ok: true, data: filePath };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.EXPORT.JSON, async (_event, options?: ExportOptions) => {
    try {
      if (options?.destinationPath) {
        const result = await exportService.exportToFile({ ...options, format: 'json' });
        return { ok: result.success, data: result, error: result.error };
      }
      const data = exportService.exportJson();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.EXPORT.CSV, async (_event, options?: ExportOptions) => {
    try {
      if (options?.destinationPath) {
        const result = await exportService.exportToFile({ ...options, format: 'csv' });
        return { ok: result.success, data: result, error: result.error };
      }
      const csv = exportService.exportCsv(options);
      return { ok: true, data: csv };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.EXPORT.MARKDOWN, async (_event, options?: ExportOptions) => {
    try {
      if (options?.destinationPath) {
        const result = await exportService.exportToFile({ ...options, format: 'markdown' });
        return { ok: result.success, data: result, error: result.error };
      }
      const md = exportService.exportMarkdown(options);
      return { ok: true, data: md };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.EXPORT.ATTACHMENTS, async (_event, destinationPath?: string) => {
    try {
      let targetPath = destinationPath;
      if (!targetPath) {
        targetPath = (await exportService.promptSaveDialog('attachments_zip')) ?? undefined;
      }
      if (!targetPath) {
        return { ok: false, error: 'Export canceled: No destination path provided.' };
      }

      exportService.exportAttachmentsZip(targetPath);
      return { ok: true, data: { filePath: targetPath } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.EXPORT.PRINT_PDF, async (_event, options?: { listId?: string; projectId?: string; title?: string }) => {
    try {
      const html = exportService.generatePrintHtml(options);
      return { ok: true, data: html };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerExportHandlers;
