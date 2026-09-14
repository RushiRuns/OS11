import { create } from 'zustand';
import { IPC } from '../../shared/ipc-channels.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload, GoalLink, Task } from '../../shared/types/index.js';
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
  unlinkTask: (goalId: string, resourceId: string) => Promise<void>;
  incrementStreak: (goalId: string) => Promise<void>;
  computeProgress: (goalId: string, tasksById: Record<string, Task>) => number;
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

  unlinkTask: async (goalId: string, resourceId: string) => {
    try {
      await invoke(IPC.GOALS.LINK_TASK, { goalId, resourceType: 'task', resourceId, unlink: true });
      set((state) => {
        const existing = state.linksByGoalId[goalId] ?? [];
        return {
          linksByGoalId: {
            ...state.linksByGoalId,
            [goalId]: existing.filter((l) => l.resource_id !== resourceId),
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

  computeProgress: (goalId: string, tasksById: Record<string, Task>) => {
    const goal = get().goalsById[goalId];
    if (!goal) return 0;

    const links = get().linksByGoalId[goalId] ?? [];
    const taskLinks = links.filter((l) => l.resource_type === 'task');

    if (taskLinks.length > 0) {
      let completedCount = 0;
      for (const link of taskLinks) {
        const t = tasksById[link.resource_id];
        if (t && t.is_completed === 1) {
          completedCount++;
        }
      }
      return Math.round((completedCount / taskLinks.length) * 100);
    }

    // Fallback to numeric value ratio
    if (goal.target_value > 0) {
      return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
    }

    return 0;
  },
}));

export default useGoalStore;
