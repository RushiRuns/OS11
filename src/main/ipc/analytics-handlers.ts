import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { IPC } from '@shared/ipc-channels.js';
import { AnalyticsService } from '../services/analytics/AnalyticsService.js';

export function registerAnalyticsHandlers(service = new AnalyticsService()): void {
  ipcMain.handle(IPC.ANALYTICS.GET_PERSONAL_STATS, async (_event, payload?: { from?: string; to?: string }) => {
    try {
      const data = service.getPersonalStats(payload?.from, payload?.to);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_PRODUCTIVE_DAY, async () => {
    try {
      const data = service.getMostProductiveDay();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_PRODUCTIVE_HOUR, async () => {
    try {
      const data = service.getMostProductiveHour();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_COMPLETIONS_BY_DAY, async (_event, payload?: { from?: string; to?: string }) => {
    try {
      const data = service.getCompletionsByDay(payload?.from, payload?.to);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_TASKS_BY_LIST, async () => {
    try {
      const data = service.getTasksByList();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_TASKS_BY_TAG, async () => {
    try {
      const data = service.getTasksByTag();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_TASKS_BY_PRIORITY, async () => {
    try {
      const data = service.getTasksByPriority();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_POMODORO_STATS, async (_event, payload?: { from?: string; to?: string }) => {
    try {
      const data = service.getPomodoroStats(payload?.from, payload?.to);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.GET_PROJECT_STATS, async (_event, projectId: string) => {
    try {
      const data = service.getProjectStats(projectId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ANALYTICS.EXPORT_PDF, async (event) => {
    try {
      const pdfBuffer = await event.sender.printToPDF({
        printBackground: true,
        pageSize: 'A4',
      });

      const win = BrowserWindow.fromWebContents(event.sender);
      if (dialog && win) {
        const defaultName = `OS11-Analytics-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
          title: 'Export Analytics PDF',
          defaultPath: defaultName,
          filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
        });

        if (!canceled && filePath) {
          fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
          return { ok: true, data: { saved: true, filePath } };
        }
        return { ok: true, data: { saved: false, canceled: true } };
      }

      return { ok: true, data: { base64: Buffer.from(pdfBuffer).toString('base64') } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.ANALYTICS.EXPORT_CSV,
    async (event, payload?: { from?: string; to?: string }) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        let targetPath: string | undefined;

        if (dialog && win) {
          const defaultName = `OS11-Analytics-Report-${new Date().toISOString().slice(0, 10)}.csv`;
          const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'Export Analytics CSV',
            defaultPath: defaultName,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }],
          });

          if (canceled || !filePath) {
            return { ok: true, data: { saved: false, canceled: true } };
          }
          targetPath = filePath;
        }

        const csv = service.exportCsv(payload?.from, payload?.to, targetPath);
        return { ok: true, data: { saved: Boolean(targetPath), filePath: targetPath, csv } };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerAnalyticsHandlers;
