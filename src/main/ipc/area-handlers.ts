import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { AreaService } from '../services/area/AreaService.js';
import type { CreateAreaPayload, UpdateAreaPayload } from '@shared/types/index.js';

export function registerAreaHandlers(areaService = new AreaService()): void {
  ipcMain.handle(IPC.AREAS.GET_ALL, async () => {
    try {
      const data = areaService.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.AREAS.GET_BY_ID, async (_event, id: string) => {
    try {
      const data = areaService.getById(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.AREAS.CREATE, async (_event, payload: CreateAreaPayload) => {
    try {
      const data = areaService.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.AREAS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateAreaPayload }) => {
    try {
      const data = areaService.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.AREAS.DELETE, async (_event, id: string) => {
    try {
      areaService.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.AREAS.REORDER, async (_event, updates: Array<{ id: string; sortOrder: number }>) => {
    try {
      areaService.reorder(updates);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerAreaHandlers;
