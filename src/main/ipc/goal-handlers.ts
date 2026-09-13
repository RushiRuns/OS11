import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { GoalRepository } from '../repositories/GoalRepository.js';
import type { CreateGoalPayload, UpdateGoalPayload } from '@shared/types/index.js';

export function registerGoalHandlers(repo = new GoalRepository()): void {
  ipcMain.handle(IPC.GOALS.GET_ALL, async () => {
    try {
      const data = repo.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.GOALS.GET_BY_ID, async (_event, id: string) => {
    try {
      const goal = repo.getById(id);
      const links = repo.getLinks(id);
      return { ok: true, data: { ...goal, links } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.GOALS.CREATE, async (_event, payload: CreateGoalPayload) => {
    try {
      const data = repo.create(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.GOALS.UPDATE, async (_event, { id, fields }: { id: string; fields: UpdateGoalPayload }) => {
    try {
      const data = repo.update(id, fields);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.GOALS.DELETE, async (_event, id: string) => {
    try {
      repo.delete(id);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.GOALS.LINK_TASK,
    async (_event, { goalId, resourceType, resourceId, unlink }: { goalId: string; resourceType: 'task' | 'project'; resourceId: string; unlink?: boolean }) => {
      try {
        if (unlink) {
          repo.removeLink(goalId, resourceId);
        } else {
          repo.addLink(goalId, resourceType, resourceId);
        }
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerGoalHandlers;
