import { ipcMain, shell, app } from 'electron';
import path from 'node:path';
import { IPC } from '@shared/ipc-channels.js';
import { AttachmentRepository } from '../repositories/AttachmentRepository.js';
import { workerManager } from '../services/worker-manager.js';
import type { ProcessAttachmentResult } from '../../worker/file-processor/FileProcessor.js';

export function registerAttachmentHandlers(repo = new AttachmentRepository()): void {
  ipcMain.handle(IPC.ATTACHMENTS.GET_ALL, async (_event, taskId: string) => {
    try {
      const data = repo.getByTaskId(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.ATTACHMENTS.ADD,
    async (_event, { taskId, sourcePath }: { taskId: string; sourcePath: string }) => {
      try {
        const destDir = path.join(app.getPath('userData'), 'attachments', taskId);
        const filename = path.basename(sourcePath);

        // Process file copying via background worker
        const processed = await workerManager.send<ProcessAttachmentResult>('PROCESS_ATTACHMENT', {
          sourcePath,
          destDir,
          filename,
        });

        const record = repo.create({
          task_id: taskId,
          filename: processed.filename,
          original_name: filename,
          mime_type: processed.mimeType,
          size_bytes: processed.sizeBytes,
          local_path: processed.localPath,
        });

        return { ok: true, data: record };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.ATTACHMENTS.DELETE, async (_event, id: string) => {
    try {
      const deleted = repo.delete(id);
      return { ok: true, data: deleted };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.ATTACHMENTS.OPEN, async (_event, filePath: string) => {
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        throw new Error(result);
      }
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerAttachmentHandlers;
