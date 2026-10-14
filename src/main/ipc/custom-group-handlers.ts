import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { CustomGroupRepository } from '../repositories/CustomGroupRepository.js';
import {
  createCustomGroup,
  updateCustomGroup,
  softDeleteCustomGroup,
  restoreCustomGroup,
  getDeleteImpact,
  createCustomGroupSection,
  updateCustomGroupSection,
  softDeleteCustomGroupSection,
  restoreCustomGroupSection,
  reorderCustomGroupSections,
  setProjectGroupOverride,
  clearProjectGroupOverride,
  moveTasks,
} from '../domain/custom-groups.js';
import type {
  CreateCustomGroupPayload,
  UpdateCustomGroupPayload,
  CreateCustomGroupSectionPayload,
  UpdateCustomGroupSectionPayload,
  ReorderCustomGroupSectionsPayload,
  SetProjectGroupOverridePayload,
  ClearProjectGroupOverridePayload,
  MoveTasksPayload,
} from '@shared/types/index.js';

export function registerCustomGroupHandlers(repo = new CustomGroupRepository()): void {
  // ==========================================
  // CUSTOM GROUPS
  // ==========================================

  ipcMain.handle(IPC.CUSTOM_GROUPS.GET_ALL, async () => {
    try {
      const data = repo.getAllGroups();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.CREATE, async (_event, payload: CreateCustomGroupPayload) => {
    try {
      const data = createCustomGroup(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.UPDATE, async (_event, payload: UpdateCustomGroupPayload) => {
    try {
      const data = updateCustomGroup(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.DELETE, async (_event, id: string) => {
    try {
      const data = softDeleteCustomGroup(repo, id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.RESTORE, async (_event, id: string) => {
    try {
      const data = restoreCustomGroup(repo, id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.GET_DELETE_IMPACT, async (_event, id: string) => {
    try {
      const data = getDeleteImpact(repo, id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUPS.MARK_USED, async (_event, id: string) => {
    try {
      const now = new Date().toISOString();
      repo.markUsed(id, now);
      return { ok: true, data: { id, last_used_at: now } };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ==========================================
  // CUSTOM GROUP SECTIONS
  // ==========================================

  ipcMain.handle(IPC.CUSTOM_GROUP_SECTIONS.CREATE, async (_event, payload: CreateCustomGroupSectionPayload) => {
    try {
      const data = createCustomGroupSection(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUP_SECTIONS.UPDATE, async (_event, payload: UpdateCustomGroupSectionPayload) => {
    try {
      const data = updateCustomGroupSection(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUP_SECTIONS.DELETE, async (_event, id: string) => {
    try {
      const data = softDeleteCustomGroupSection(repo, id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUP_SECTIONS.RESTORE, async (_event, id: string) => {
    try {
      const data = restoreCustomGroupSection(repo, id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.CUSTOM_GROUP_SECTIONS.REORDER, async (_event, payload: ReorderCustomGroupSectionsPayload) => {
    try {
      reorderCustomGroupSections(repo, payload.group_id, payload.updates);
      return { ok: true, data: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ==========================================
  // PROJECT GROUP OVERRIDES
  // ==========================================

  ipcMain.handle(IPC.PROJECT_GROUP_OVERRIDES.GET_FOR_PROJECT, async (_event, projectId: string) => {
    try {
      const data = repo.getOverridesForProject(projectId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECT_GROUP_OVERRIDES.SET, async (_event, payload: SetProjectGroupOverridePayload) => {
    try {
      const data = setProjectGroupOverride(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.PROJECT_GROUP_OVERRIDES.CLEAR, async (_event, payload: ClearProjectGroupOverridePayload) => {
    try {
      const data = clearProjectGroupOverride(repo, payload.project_id, payload.section_id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ==========================================
  // TASK CUSTOM VALUES
  // ==========================================

  ipcMain.handle(IPC.TASK_CUSTOM_VALUES.GET_FOR_PROJECT, async (_event, { projectId, groupId }: { projectId: string; groupId: string }) => {
    try {
      const data = repo.getValuesForProject(projectId, groupId);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.TASK_CUSTOM_VALUES.MOVE_TASKS, async (_event, payload: MoveTasksPayload) => {
    try {
      const data = moveTasks(repo, payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerCustomGroupHandlers;
