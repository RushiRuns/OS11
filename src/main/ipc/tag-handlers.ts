import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { TagService } from '../services/tag/TagService.js';
import type { CreateTagPayload, UpdateTagPayload } from '@shared/types/index.js';

export function registerTagHandlers(service = new TagService()): void {
  ipcMain.handle(IPC.TAGS.GET_ALL, async () => {
    try {
      const data = service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.CREATE, async (_event, payload: CreateTagPayload) => {
    try {
      const data = service.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateTagPayload }) => {
    try {
      const data = service.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.DELETE, async (_event, id: string) => {
    try {
      service.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.GET_FOR_TASK, async (_event, taskId: string) => {
    try {
      const data = service.getTagsForTask(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.ADD_TO_TASK, async (_event, { taskId, tagId }: { taskId: string; tagId: string }) => {
    try {
      service.addTagToTask(taskId, tagId);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.REMOVE_FROM_TASK, async (_event, { taskId, tagId }: { taskId: string; tagId: string }) => {
    try {
      service.removeTagFromTask(taskId, tagId);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TAGS.GET_TASKS_FOR_TAG, async (_event, tagId: string) => {
    try {
      const data = service.getTasksForTag(tagId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.TAGS.MERGE,
    async (_event, { sourceTagId, targetTagId }: { sourceTagId: string; targetTagId: string }) => {
      try {
        service.mergeTags(sourceTagId, targetTagId);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerTagHandlers;
