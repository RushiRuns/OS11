import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { DependencyService } from '../services/project/DependencyService.js';

export function registerDependencyHandlers(service = new DependencyService()): void {
  ipcMain.handle(IPC.DEPENDENCIES.GET_ALL, async (_event, projectId?: string) => {
    try {
      const data = projectId ? service.getByProjectId(projectId) : service.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.DEPENDENCIES.GET_FOR_TASK, async (_event, taskId: string) => {
    try {
      const data = service.getByTaskId(taskId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.DEPENDENCIES.ADD,
    async (_event, { taskId, dependsOnId }: { taskId: string; dependsOnId: string }) => {
      try {
        service.add(taskId, dependsOnId);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.DEPENDENCIES.REMOVE,
    async (_event, { taskId, dependsOnId }: { taskId: string; dependsOnId: string }) => {
      try {
        service.remove(taskId, dependsOnId);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerDependencyHandlers;
