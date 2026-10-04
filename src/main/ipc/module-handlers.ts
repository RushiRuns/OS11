import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { ModuleRepository } from '../repositories/ModuleRepository.js';
import { TaskRepository } from '../repositories/TaskRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';

export function registerModuleHandlers(
  repo = new ModuleRepository(),
  taskRepo = new TaskRepository(),
  projectRepo = new ProjectRepository()
): void {
  ipcMain.handle(IPC.MODULES.GET_ALL, async () => {
    try {
      const data = repo.getAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MODULES.SET_ACTIVE, async (_event, { moduleName, enabled }: { moduleName: string; enabled: boolean }) => {
    try {
      repo.toggle(moduleName, enabled);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MODULES.TOGGLE, async (_event, { moduleName, enabled }: { moduleName: string; enabled: boolean }) => {
    try {
      repo.toggle(moduleName, enabled);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MODULES.APPLY_PRESET, async (_event, { preset }: { preset: 'minimalist' | 'gtd' | 'focus' | 'custom' }) => {
    try {
      const data = repo.applyPreset(preset);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.MODULES.GET_DISABLE_IMPACT, async (_event, moduleName: string) => {
    try {
      let taskCount = 0;
      let projectCount = 0;
      if (moduleName === 'anytime') {
        taskCount = taskRepo.getAnytime().length;
      } else if (moduleName === 'someday') {
        taskCount = taskRepo.getSomeday().length;
        projectCount = projectRepo.getSomedayProjects().length;
      } else if (moduleName === 'waiting_for') {
        taskCount = taskRepo.getWaitingFor().length;
      }
      return { ok: true, data: { taskCount, projectCount } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerModuleHandlers;
