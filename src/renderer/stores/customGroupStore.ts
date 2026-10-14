import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useUndoRedoStore } from '../hooks/useUndoRedo.js';
import type {
  CustomGroup,
  CustomGroupSection,
  ProjectGroupOverride,
  CreateCustomGroupPayload,
  UpdateCustomGroupPayload,
  CreateCustomGroupSectionPayload,
  UpdateCustomGroupSectionPayload,
  SetProjectGroupOverridePayload,
  MoveTasksResult,
  DeleteImpactResult,
} from '@shared/types/index.js';

export interface CustomGroupState {
  groups: CustomGroup[];
  activeProjectId: string | null;
  activeGroupId: string | null;
  overrides: ProjectGroupOverride[];
  taskValues: Record<string, string>; // taskId -> sectionId for active project & group
  isLoading: boolean;

  // Actions
  loadGroups: () => Promise<void>;
  setActiveProjectAndGroup: (projectId: string | null, groupId: string | null) => Promise<void>;
  createGroup: (payload: CreateCustomGroupPayload) => Promise<CustomGroup>;
  updateGroup: (payload: UpdateCustomGroupPayload) => Promise<CustomGroup>;
  deleteGroup: (groupId: string) => Promise<void>;
  restoreGroup: (groupId: string) => Promise<CustomGroup>;
  markGroupUsed: (groupId: string) => Promise<void>;
  getDeleteImpact: (groupId: string) => Promise<DeleteImpactResult>;

  createSection: (payload: CreateCustomGroupSectionPayload) => Promise<CustomGroupSection>;
  updateSection: (payload: UpdateCustomGroupSectionPayload) => Promise<CustomGroupSection>;
  deleteSection: (sectionId: string) => Promise<void>;
  restoreSection: (sectionId: string) => Promise<CustomGroupSection>;
  reorderSections: (groupId: string, updates: Array<{ id: string; sort_order: number }>) => Promise<void>;

  setProjectOverride: (payload: SetProjectGroupOverridePayload) => Promise<ProjectGroupOverride>;
  clearProjectOverride: (projectId: string, sectionId: string) => Promise<void>;

  moveTasks: (taskIds: string[], sectionId: string | null, sortOrder?: number) => Promise<MoveTasksResult>;
}

export const useCustomGroupStore = create<CustomGroupState>((set, get) => ({
  groups: [],
  activeProjectId: null,
  activeGroupId: null,
  overrides: [],
  taskValues: {},
  isLoading: false,

  loadGroups: async () => {
    try {
      set({ isLoading: true });
      const groups = await ipc.invoke<CustomGroup[]>(IPC.CUSTOM_GROUPS.GET_ALL);
      set({ groups: groups ?? [], isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      console.error('[customGroupStore] Failed to load groups:', err);
    }
  },

  setActiveProjectAndGroup: async (projectId: string | null, groupId: string | null) => {
    const prev = get();
    if (prev.activeProjectId === projectId && prev.activeGroupId === groupId) {
      return;
    }

    set({ activeProjectId: projectId, activeGroupId: groupId });

    if (!projectId || !groupId) {
      set({ overrides: [], taskValues: {} });
      return;
    }

    try {
      const [overrides, values] = await Promise.all([
        ipc.invoke<ProjectGroupOverride[]>(IPC.PROJECT_GROUP_OVERRIDES.GET_FOR_PROJECT, projectId),
        ipc.invoke<Array<{ task_id: string; section_id: string }>>(
          IPC.TASK_CUSTOM_VALUES.GET_FOR_PROJECT,
          { projectId, groupId }
        ),
      ]);

      const valueMap: Record<string, string> = {};
      for (const val of values ?? []) {
        valueMap[val.task_id] = val.section_id;
      }

      set({
        overrides: overrides ?? [],
        taskValues: valueMap,
      });
    } catch (err) {
      console.error('[customGroupStore] Failed to load project group data:', err);
    }
  },

  createGroup: async (payload: CreateCustomGroupPayload) => {
    const created = await ipc.invoke<CustomGroup>(IPC.CUSTOM_GROUPS.CREATE, payload);
    set((state) => ({
      groups: [created, ...state.groups],
    }));
    return created;
  },

  updateGroup: async (payload: UpdateCustomGroupPayload) => {
    const updated = await ipc.invoke<CustomGroup>(IPC.CUSTOM_GROUPS.UPDATE, payload);
    set((state) => ({
      groups: state.groups.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
    }));
    return updated;
  },

  deleteGroup: async (groupId: string) => {
    const existing = get().groups.find((g) => g.id === groupId);
    if (!existing) return;

    await ipc.invoke(IPC.CUSTOM_GROUPS.DELETE, groupId);
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== groupId),
    }));

    useUndoRedoStore.getState().pushAction({
      description: `Deleted custom group "${existing.name}"`,
      undoFn: async () => {
        await get().restoreGroup(groupId);
      },
      showToast: true,
    });
  },

  restoreGroup: async (groupId: string) => {
    const restored = await ipc.invoke<CustomGroup>(IPC.CUSTOM_GROUPS.RESTORE, groupId);
    set((state) => ({
      groups: [...state.groups.filter((g) => g.id !== groupId), restored],
    }));
    return restored;
  },

  markGroupUsed: async (groupId: string) => {
    await ipc.invoke(IPC.CUSTOM_GROUPS.MARK_USED, groupId);
    const now = new Date().toISOString();
    set((state) => {
      const target = state.groups.find((g) => g.id === groupId);
      if (!target) return state;
      const updated = { ...target, last_used_at: now };
      const others = state.groups.filter((g) => g.id !== groupId);
      return {
        groups: [updated, ...others],
      };
    });
  },

  getDeleteImpact: async (groupId: string) => {
    return ipc.invoke<DeleteImpactResult>(IPC.CUSTOM_GROUPS.GET_DELETE_IMPACT, groupId);
  },

  createSection: async (payload: CreateCustomGroupSectionPayload) => {
    const section = await ipc.invoke<CustomGroupSection>(IPC.CUSTOM_GROUP_SECTIONS.CREATE, payload);
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== payload.group_id) return g;
        return {
          ...g,
          sections: [...(g.sections ?? []), section],
        };
      }),
    }));
    return section;
  },

  updateSection: async (payload: UpdateCustomGroupSectionPayload) => {
    const updated = await ipc.invoke<CustomGroupSection>(IPC.CUSTOM_GROUP_SECTIONS.UPDATE, payload);
    set((state) => ({
      groups: state.groups.map((g) => {
        if (!g.sections?.some((s) => s.id === updated.id)) return g;
        return {
          ...g,
          sections: g.sections.map((s) => (s.id === updated.id ? updated : s)),
        };
      }),
    }));
    return updated;
  },

  deleteSection: async (sectionId: string) => {
    let deletedSec: CustomGroupSection | undefined;
    for (const g of get().groups) {
      const match = g.sections?.find((s) => s.id === sectionId);
      if (match) {
        deletedSec = match;
        break;
      }
    }

    await ipc.invoke(IPC.CUSTOM_GROUP_SECTIONS.DELETE, sectionId);

    // Optimistically update local group state and task values (tasks move to Unsorted)
    set((state) => {
      const nextValues = { ...state.taskValues };
      for (const [taskId, sId] of Object.entries(nextValues)) {
        if (sId === sectionId) {
          delete nextValues[taskId];
        }
      }
      return {
        groups: state.groups.map((g) => ({
          ...g,
          sections: g.sections?.filter((s) => s.id !== sectionId) ?? [],
        })),
        taskValues: nextValues,
      };
    });

    if (deletedSec) {
      useUndoRedoStore.getState().pushAction({
        description: `Deleted section "${deletedSec.name}"`,
        undoFn: async () => {
          await get().restoreSection(sectionId);
        },
        showToast: true,
      });
    }
  },

  restoreSection: async (sectionId: string) => {
    const restored = await ipc.invoke<CustomGroupSection>(IPC.CUSTOM_GROUP_SECTIONS.RESTORE, sectionId);
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== restored.group_id) return g;
        const filtered = g.sections?.filter((s) => s.id !== sectionId) ?? [];
        return {
          ...g,
          sections: [...filtered, restored].sort((a, b) => a.sort_order - b.sort_order),
        };
      }),
    }));

    // Reload active project task values if restored section belongs to active group
    const { activeProjectId, activeGroupId } = get();
    if (activeProjectId && activeGroupId === restored.group_id) {
      const values = await ipc.invoke<Array<{ task_id: string; section_id: string }>>(
        IPC.TASK_CUSTOM_VALUES.GET_FOR_PROJECT,
        { projectId: activeProjectId, groupId: activeGroupId }
      );
      const valMap: Record<string, string> = {};
      for (const v of values ?? []) {
        valMap[v.task_id] = v.section_id;
      }
      set({ taskValues: valMap });
    }

    return restored;
  },

  reorderSections: async (groupId: string, updates: Array<{ id: string; sort_order: number }>) => {
    const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]));
    set((state) => ({
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          sections: (g.sections ?? [])
            .map((s) => ({
              ...s,
              sort_order: orderMap.get(s.id) ?? s.sort_order,
            }))
            .sort((a, b) => a.sort_order - b.sort_order),
        };
      }),
    }));

    await ipc.invoke(IPC.CUSTOM_GROUP_SECTIONS.REORDER, { group_id: groupId, updates });
  },

  setProjectOverride: async (payload: SetProjectGroupOverridePayload) => {
    const override = await ipc.invoke<ProjectGroupOverride>(IPC.PROJECT_GROUP_OVERRIDES.SET, payload);
    set((state) => {
      const nextOverrides = state.overrides.filter((o) => o.section_id !== payload.section_id);
      return {
        overrides: [...nextOverrides, override],
      };
    });
    return override;
  },

  clearProjectOverride: async (projectId: string, sectionId: string) => {
    await ipc.invoke(IPC.PROJECT_GROUP_OVERRIDES.CLEAR, { project_id: projectId, section_id: sectionId });
    set((state) => ({
      overrides: state.overrides.filter((o) => !(o.project_id === projectId && o.section_id === sectionId)),
    }));
  },

  moveTasks: async (taskIds: string[], sectionId: string | null, sortOrder?: number) => {
    const { activeGroupId } = get();
    if (!activeGroupId) {
      throw new Error('No active custom group selected.');
    }

    // Save previous values for rollback
    const previousTaskValues = { ...get().taskValues };

    // 1. Optimistic update
    set((state) => {
      const next = { ...state.taskValues };
      for (const tid of taskIds) {
        if (sectionId === null) {
          delete next[tid];
        } else {
          next[tid] = sectionId;
        }
      }
      return { taskValues: next };
    });

    try {
      const result = await ipc.invoke<MoveTasksResult>(IPC.TASK_CUSTOM_VALUES.MOVE_TASKS, {
        taskIds,
        groupId: activeGroupId,
        sectionId,
        sortOrder,
      });

      // 2. Register one atomic undo entry
      useUndoRedoStore.getState().pushAction({
        description: `Moved ${taskIds.length === 1 ? 'task' : `${taskIds.length} tasks`} to ${
          sectionId ? 'section' : 'Unsorted'
        }`,
        undoFn: async () => {
          const locs = result?.previousLocations ?? [];
          // Rollback each task to its previous location
          for (const loc of locs) {
            await ipc.invoke(IPC.TASK_CUSTOM_VALUES.MOVE_TASKS, {
              taskIds: [loc.taskId],
              groupId: activeGroupId,
              sectionId: loc.previousSectionId,
              sortOrder: loc.previousSortOrder,
            });
          }
          // Refresh store
          set((state) => {
            const rolledBack = { ...state.taskValues };
            for (const loc of locs) {
              if (loc.previousSectionId === null) {
                delete rolledBack[loc.taskId];
              } else {
                rolledBack[loc.taskId] = loc.previousSectionId;
              }
            }
            return { taskValues: rolledBack };
          });
        },
        showToast: true,
      });

      return result;
    } catch (err) {
      // Rollback optimistic update
      set({ taskValues: previousTaskValues });
      console.error('[customGroupStore] moveTasks failed, rolled back:', err);
      throw err;
    }
  },
}));

export default useCustomGroupStore;
