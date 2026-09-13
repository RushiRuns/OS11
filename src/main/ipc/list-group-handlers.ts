import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ListGroupRepository } from '../repositories/ListGroupRepository.js';
import type { CreateListGroupPayload, UpdateListGroupPayload } from '@shared/types/index.js';

export function registerListGroupHandlers(repo = new ListGroupRepository()): void {
  ipcMain.handle(IPC.LIST_GROUPS.GET_ALL, async () => {
    try {
      const data = repo.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LIST_GROUPS.CREATE, async (_event, payload: CreateListGroupPayload) => {
    try {
      const data = repo.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LIST_GROUPS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateListGroupPayload }) => {
    try {
      const data = repo.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LIST_GROUPS.DELETE, async (_event, id: string) => {
    try {
      repo.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.LIST_GROUPS.REORDER, async (_event, updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      repo.reorder(updates);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerListGroupHandlers;
