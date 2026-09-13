import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ListService } from '../services/list/ListService.js';
import type { CreateListPayload, UpdateListPayload } from '@shared/types/index.js';

export function registerListHandlers(listService = new ListService()): void {
  ipcMain.handle(IPC.LISTS.GET_ALL, async () => {
    try {
      const data = listService.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LISTS.GET_BY_ID, async (_event, id: string) => {
    try {
      const data = listService.getById(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LISTS.CREATE, async (_event, payload: CreateListPayload) => {
    try {
      const data = listService.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LISTS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateListPayload }) => {
    try {
      const data = listService.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LISTS.DELETE, async (_event, id: string) => {
    try {
      const data = listService.delete(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LISTS.REORDER, async (_event, updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      listService.reorder(updates);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerListHandlers;
