import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { SectionRepository } from '../repositories/SectionRepository.js';
import type { CreateSectionPayload, UpdateSectionPayload } from '@shared/types/index.js';

export function registerSectionHandlers(repo = new SectionRepository()): void {
  ipcMain.handle(IPC.SECTIONS.GET_ALL, async (_event, projectId: string) => {
    try {
      const data = repo.getByProjectId(projectId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECTIONS.CREATE, async (_event, payload: CreateSectionPayload) => {
    try {
      const data = repo.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECTIONS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateSectionPayload }) => {
    try {
      const data = repo.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECTIONS.DELETE, async (_event, id: string) => {
    try {
      repo.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.SECTIONS.REORDER, async (_event, { id, sortOrder }: { id: string; sortOrder: number }) => {
    try {
      const data = repo.update(id, { sort_order: sortOrder });
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerSectionHandlers;
