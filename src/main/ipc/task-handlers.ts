import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { TaskService } from '../services/task/TaskService.js';
import type { CreateTaskPayload, UpdateTaskPayload } from '@shared/types/index.js';

export function registerTaskHandlers(taskService = new TaskService()): void {
  ipcMain.handle(IPC.TASKS.GET_ALL, async () => {
    try {
      const data = taskService.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.GET_BY_ID, async (_event, id: string) => {
    try {
      const data = taskService.getById(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.CREATE, async (_event, payload: CreateTaskPayload) => {
    try {
      const data = taskService.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.UPDATE, async (_event, payload: UpdateTaskPayload) => {
    try {
      const data = taskService.update(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.DELETE, async (_event, id: string) => {
    try {
      const data = taskService.trash(id);
      return { ok: true, data: Boolean(data) };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.RESTORE, async (_event, id: string) => {
    try {
      const data = taskService.restore(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.TOGGLE_COMPLETE, async (_event, id: string) => {
    try {
      const data = taskService.toggleComplete(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.STAR, async (_event, id: string) => {
    try {
      const data = taskService.star(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.UNSTAR, async (_event, id: string) => {
    try {
      const data = taskService.unstar(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.DUPLICATE, async (_event, id: string) => {
    try {
      const data = taskService.duplicate(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.MAKE_SUBTASK, async (_event, { id, parentId }: { id: string; parentId: string }) => {
    try {
      const data = taskService.makeSubtask(id, parentId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.PROMOTE_SUBTASK, async (_event, id: string) => {
    try {
      const data = taskService.promoteToTask(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.GET_SUBTASKS, async (_event, parentId: string) => {
    try {
      const data = taskService.getSubtasks(parentId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.GET_BY_LIST, async (_event, { listId, offset, limit }: { listId: string; offset?: number; limit?: number }) => {
    try {
      const data = taskService.getByListId(listId, offset, limit);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.REORDER, async (_event, { id, sortOrder }: { id: string; sortOrder: number }) => {
    try {
      const data = taskService.reorder(id, sortOrder);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASKS.BATCH_UPDATE, async (_event, updates: UpdateTaskPayload[]) => {
    try {
      const results = updates.map((u) => taskService.update(u));
      return { ok: true, data: results };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerTaskHandlers;
