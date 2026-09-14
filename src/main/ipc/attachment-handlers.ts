import { ipcMain, shell, dialog, BrowserWindow } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { AttachmentService } from '../services/attachment/AttachmentService.js';

export function registerAttachmentHandlers(service = new AttachmentService()): void {
  ipcMain.handle(IPC.ATTACHMENTS.GET_ALL, async (_event, taskId: string) => {
    try {
      const data = service.getByTask(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ATTACHMENTS.GET_EVERY_ATTACHMENT, async () => {
    try {
      const data = service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ATTACHMENTS.GET_COUNTS, async () => {
    try {
      const data = service.getAllCounts();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.ATTACHMENTS.ADD,
    async (_event, { taskId, sourcePath }: { taskId: string; sourcePath: string }) => {
      try {
        const record = await service.upload(sourcePath, taskId);
        return { ok: true, data: record };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.ATTACHMENTS.UPLOAD,
    async (_event, { taskId, sourcePath }: { taskId: string; sourcePath: string }) => {
      try {
        const record = await service.upload(sourcePath, taskId);
        return { ok: true, data: record };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.ATTACHMENTS.PICK_AND_UPLOAD,
    async (event, { taskId }: { taskId: string }) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!dialog || !win) {
          return { ok: false, error: 'Dialog not available' };
        }

        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
          title: 'Select Files to Attach',
          properties: ['openFile', 'multiSelections'],
        });

        if (canceled || filePaths.length === 0) {
          return { ok: true, data: [] };
        }

        const uploaded = [];
        for (const filePath of filePaths) {
          const record = await service.upload(filePath, taskId);
          uploaded.push(record);
        }

        return { ok: true, data: uploaded };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.ATTACHMENTS.ADD_LINK,
    async (_event, { taskId, url, title }: { taskId: string; url: string; title?: string }) => {
      try {
        const record = service.addLink(taskId, url, title);
        return { ok: true, data: record };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.ATTACHMENTS.DELETE, async (_event, id: string) => {
    try {
      const deleted = service.delete(id);
      return { ok: true, data: deleted };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ATTACHMENTS.OPEN, async (_event, targetPathOrUrl: string) => {
    try {
      if (targetPathOrUrl.startsWith('http://') || targetPathOrUrl.startsWith('https://')) {
        await shell.openExternal(targetPathOrUrl);
        return { ok: true, data: true };
      }

      const result = await shell.openPath(targetPathOrUrl);
      if (result) {
        throw new Error(result);
      }
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ATTACHMENTS.EXPORT_ALL, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!dialog || !win) {
        return { ok: false, error: 'Dialog not available' };
      }

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Destination Folder to Export Attachments',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (canceled || filePaths.length === 0) {
        return { ok: true, data: { exported: 0, canceled: true } };
      }

      const destDir = filePaths[0];
      const count = await service.exportAll(destDir);
      return { ok: true, data: { exported: count, destDir } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerAttachmentHandlers;
