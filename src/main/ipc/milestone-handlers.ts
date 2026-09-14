import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { MilestoneService } from '../services/project/MilestoneService.js';
import type { CreateMilestonePayload, UpdateMilestonePayload } from '@shared/types/index.js';

export function registerMilestoneHandlers(service = new MilestoneService()): void {
  ipcMain.handle(IPC.MILESTONES.GET_ALL, async (_event, projectId: string) => {
    try {
      const data = service.getByProjectId(projectId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MILESTONES.CREATE, async (_event, payload: CreateMilestonePayload) => {
    try {
      const data = service.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MILESTONES.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateMilestonePayload }) => {
    try {
      const data = service.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MILESTONES.DELETE, async (_event, id: string) => {
    try {
      service.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerMilestoneHandlers;
