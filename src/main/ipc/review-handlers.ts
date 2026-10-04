import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { TaskRepository } from '../repositories/TaskRepository.js';
import { ProjectRepository } from '../repositories/ProjectRepository.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { TaskSchedulingService } from '../services/task/TaskSchedulingService.js';
import { pickSomedayReviewBatch } from '../domain/review.js';
import { isStalled } from '../domain/project-health.js';
import type { ReviewSomedayBatchPayload } from '@shared/types/index.js';

export function registerReviewHandlers(
  taskRepo = new TaskRepository(),
  projectRepo = new ProjectRepository(),
  settingsRepo = new SettingsRepository(),
  schedulingService = new TaskSchedulingService()
): void {
  ipcMain.handle(IPC.REVIEW.GET_GTD_STEPS, async () => {
    try {
      const inboxTasks = taskRepo.getInbox();
      const waitingTasks = taskRepo.getWaitingFor();

      const intervalDays = settingsRepo.get<number>('gtd_someday_review_interval_days') ?? 14;
      const allSomedayTasks = taskRepo.getSomeday();
      const dueSomedayTasks = pickSomedayReviewBatch(allSomedayTasks, intervalDays).slice(0, 5);

      const allSomedayProjects = projectRepo.getSomedayProjects();
      const dueSomedayProjects = pickSomedayReviewBatch(allSomedayProjects, intervalDays).slice(0, 5);

      const activeProjects = projectRepo.getAll().filter((p) => p.status === 'active' && p.is_someday !== 1);
      const allTasks = taskRepo.getAll();
      const stalledProjects = activeProjects.filter((p) => isStalled(p, allTasks));

      return {
        ok: true,
        data: {
          inboxTasks,
          waitingTasks,
          somedayTasks: dueSomedayTasks,
          somedayProjects: dueSomedayProjects,
          stalledProjects,
        },
      };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.REVIEW.MARK_REVIEWED,
    async (_event, payload: { taskId?: string; projectId?: string; reviewedAt?: string }) => {
      try {
        const now = payload.reviewedAt ?? new Date().toISOString();
        if (payload.taskId) {
          taskRepo.markSomedayReviewedBatch([payload.taskId], now);
        }
        if (payload.projectId) {
          projectRepo.markReviewed(payload.projectId, now);
        }
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.REVIEW.REVIEW_SOMEDAY_BATCH,
    async (_event, payload: ReviewSomedayBatchPayload) => {
      try {
        schedulingService.reviewSomedayBatch(payload);
        return { ok: true, data: true };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}

export default registerReviewHandlers;
