import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ProjectService } from '../services/project/ProjectService.js';
import type { CreateProjectPayload, UpdateProjectPayload } from '@shared/types/index.js';

export function registerProjectHandlers(service = new ProjectService()): void {
  ipcMain.handle(IPC.PROJECTS.GET_ALL, async () => {
    try {
      const data = service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECTS.GET_BY_ID, async (_event, id: string) => {
    try {
      const data = service.getById(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECTS.CREATE, async (_event, payload: CreateProjectPayload) => {
    try {
      const data = service.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECTS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateProjectPayload }) => {
    try {
      const data = service.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECTS.DELETE, async (_event, id: string) => {
    try {
      service.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECTS.REORDER, async (_event, { id, sortOrder }: { id: string; sortOrder: number }) => {
    try {
      const data = service.update(id, { sort_order: sortOrder });
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerProjectHandlers;
