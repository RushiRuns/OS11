import { create } from 'zustand';
import { IPC } from '../../shared/ipc-channels.js';
import type { Goal, GoalStatus, CreateGoalPayload, UpdateGoalPayload, GoalLink, Task, Project } from '../../shared/types/index.js';
import { invoke } from '../services/ipc.js';

export interface GoalStoreState {
  goalsById: Record<string, Goal>;
  linksByGoalId: Record<string, GoalLink[]>;
  loading: boolean;
  error: string | null;

  // Actions
  loadGoals: () => Promise<void>;
  createGoal: (payload: CreateGoalPayload) => Promise<Goal>;
  updateGoal: (id: string, fields: UpdateGoalPayload) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  linkTask: (goalId: string, resourceId: string, resourceType?: 'task' | 'project') => Promise<void>;
  unlinkTask: (goalId: string, resourceId: string, resourceType?: 'task' | 'project') => Promise<void>;
  incrementStreak: (goalId: string) => Promise<void>;
  computeProgress: (
    goalId: string,
    tasksById: Record<string, Task>,
    projectsById?: Record<string, Project>
  ) => number;
  getSubGoals: (goalId: string) => Goal[];
  getParentGoal: (goalId: string) => Goal | null;
  getGoalForTask: (taskId: string) => Goal | null;
  getGoalForProject: (projectId: string) => Goal | null;
  adjustGoalProgress: (goalId: string, delta: number) => Promise<Goal | undefined>;
  setGoalStatus: (id: string, status: GoalStatus) => Promise<Goal>;
  archiveGoal: (id: string) => Promise<Goal>;
  restoreGoal: (goal: Goal, links?: GoalLink[]) => Promise<void>;
}

export const useGoalStore = create<GoalStoreState>((set, get) => ({
  goalsById: {},
  linksByGoalId: {},
  loading: false,
  error: null,

  loadGoals: async () => {
    set({ loading: true, error: null });
    try {
      const goals = await invoke<Goal[]>(IPC.GOALS.GET_ALL);
      const goalsMap: Record<string, Goal> = {};
      for (const g of goals) {
        goalsMap[g.id] = g;
      }

      let allLinks: GoalLink[] = [];
      try {
        allLinks = await invoke<GoalLink[]>(IPC.GOALS.GET_ALL_LINKS);
      } catch {
        // Best effort fallback
      }

      const linksMap: Record<string, GoalLink[]> = {};
      for (const link of allLinks) {
        if (!linksMap[link.goal_id]) {
          linksMap[link.goal_id] = [];
        }
        linksMap[link.goal_id].push(link);
      }

      set({ goalsById: goalsMap, linksByGoalId: linksMap, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
    }
  },

  createGoal: async (payload: CreateGoalPayload) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<Goal>(IPC.GOALS.CREATE, payload);
      set((state) => ({
        goalsById: { ...state.goalsById, [created.id]: created },
        linksByGoalId: { ...state.linksByGoalId, [created.id]: [] },
        loading: false,
      }));
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateGoal: async (id: string, fields: UpdateGoalPayload) => {
    try {
      const updated = await invoke<Goal>(IPC.GOALS.UPDATE, { id, fields });
      set((state) => ({
        goalsById: { ...state.goalsById, [id]: updated },
      }));
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  deleteGoal: async (id: string) => {
    try {
      await invoke(IPC.GOALS.DELETE, id);
      set((state) => {
        const nextGoals = { ...state.goalsById };
        delete nextGoals[id];
        const nextLinks = { ...state.linksByGoalId };
        delete nextLinks[id];
        return { goalsById: nextGoals, linksByGoalId: nextLinks };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  linkTask: async (goalId: string, resourceId: string, resourceType: 'task' | 'project' = 'task') => {
    try {
      await invoke(IPC.GOALS.LINK_TASK, { goalId, resourceType, resourceId });
      set((state) => {
        const existing = state.linksByGoalId[goalId] ?? [];
        if (existing.some((l) => l.resource_id === resourceId)) return state;
        return {
          linksByGoalId: {
            ...state.linksByGoalId,
            [goalId]: [...existing, { goal_id: goalId, resource_type: resourceType, resource_id: resourceId }],
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  unlinkTask: async (goalId: string, resourceId: string, resourceType: 'task' | 'project' = 'task') => {
    try {
      await invoke(IPC.GOALS.LINK_TASK, { goalId, resourceType, resourceId, unlink: true });
      set((state) => {
        const existing = state.linksByGoalId[goalId] ?? [];
        return {
          linksByGoalId: {
            ...state.linksByGoalId,
            [goalId]: existing.filter((l) => !(l.resource_id === resourceId && l.resource_type === resourceType)),
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  incrementStreak: async (goalId: string) => {
    const goal = get().goalsById[goalId];
    if (!goal) return;
    const nextStreak = (goal.streak_count ?? 0) + 1;
    await get().updateGoal(goalId, {
      streak_count: nextStreak,
      last_progress_at: new Date().toISOString(),
    });
  },

  computeProgress: (
    goalId: string,
    tasksById: Record<string, Task>,
    projectsById: Record<string, Project> = {}
  ) => {
    const goal = get().goalsById[goalId];
    if (!goal) return 0;

    const links = get().linksByGoalId[goalId] ?? [];
    const taskLinks = links.filter((l) => l.resource_type === 'task');
    const projectLinks = links.filter((l) => l.resource_type === 'project');
    const subGoals = Object.values(get().goalsById).filter((g) => g.parent_goal_id === goalId);

    let totalItems = 0;
    let completedItems = 0;

    // 1. Task links
    for (const link of taskLinks) {
      totalItems++;
      const t = tasksById[link.resource_id];
      if (t && t.is_completed === 1) {
        completedItems++;
      }
    }

    // 2. Project links
    for (const link of projectLinks) {
      totalItems++;
      const p = projectsById[link.resource_id];
      if (p && (p.status === 'completed' || (p as unknown as { is_completed?: number }).is_completed === 1)) {
        completedItems++;
      } else if (p) {
        const projectTasks = Object.values(tasksById).filter(
          (t) => t.project_id === p.id && t.is_trashed === 0
        );
        if (projectTasks.length > 0) {
          const completedProjectTasks = projectTasks.filter((t) => t.is_completed === 1).length;
          completedItems += completedProjectTasks / projectTasks.length;
        }
      }
    }

    // 3. Sub-goals
    for (const sub of subGoals) {
      totalItems++;
      if (sub.status === 'completed') {
        completedItems++;
      } else if (sub.target_value > 0) {
        completedItems += Math.min(1, Math.max(0, sub.current_value / sub.target_value));
      }
    }

    if (totalItems > 0) {
      return Math.min(100, Math.round((completedItems / totalItems) * 100));
    }

    // Fallback to numeric value ratio
    if (goal.target_value > 0) {
      return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
    }

    return 0;
  },

  getSubGoals: (goalId: string) => {
    return Object.values(get().goalsById).filter((g) => g.parent_goal_id === goalId);
  },

  getParentGoal: (goalId: string) => {
    const goal = get().goalsById[goalId];
    if (!goal || !goal.parent_goal_id) return null;
    return get().goalsById[goal.parent_goal_id] ?? null;
  },

  getGoalForTask: (taskId: string) => {
    for (const [goalId, links] of Object.entries(get().linksByGoalId)) {
      if (links.some((l) => l.resource_type === 'task' && l.resource_id === taskId)) {
        return get().goalsById[goalId] ?? null;
      }
    }
    return null;
  },

  getGoalForProject: (projectId: string) => {
    for (const [goalId, links] of Object.entries(get().linksByGoalId)) {
      if (links.some((l) => l.resource_type === 'project' && l.resource_id === projectId)) {
        return get().goalsById[goalId] ?? null;
      }
    }
    return null;
  },

  adjustGoalProgress: async (goalId: string, delta: number) => {
    const goal = get().goalsById[goalId];
    if (!goal) return undefined;
    const current = goal.current_value ?? 0;
    const maxVal = goal.target_value > 0 ? goal.target_value : Infinity;
    const nextVal = Math.max(0, Math.min(maxVal, Math.round((current + delta) * 100) / 100));
    return await get().updateGoal(goalId, {
      current_value: nextVal,
      last_progress_at: new Date().toISOString(),
    });
  },

  setGoalStatus: async (id: string, status: GoalStatus) => {
    const goal = get().goalsById[id];
    if (!goal) {
      throw new Error(`Goal not found: ${id}`);
    }

    const completedAt =
      status === 'completed'
        ? goal.completed_at || new Date().toISOString()
        : null;

    return await get().updateGoal(id, {
      status,
      completed_at: completedAt,
    });
  },

  archiveGoal: async (id: string) => {
    return await get().setGoalStatus(id, 'archived');
  },

  restoreGoal: async (goal: Goal, links: GoalLink[] = []) => {
    const created = await invoke<Goal>(IPC.GOALS.CREATE, goal);
    for (const link of links) {
      try {
        await invoke(IPC.GOALS.LINK_TASK, {
          goalId: goal.id,
          resourceType: link.resource_type,
          resourceId: link.resource_id,
        });
      } catch {
        // Best effort link restore
      }
    }
    set((state) => ({
      goalsById: { ...state.goalsById, [created.id]: created },
      linksByGoalId: { ...state.linksByGoalId, [created.id]: links },
    }));
  },
}));

export default useGoalStore;
