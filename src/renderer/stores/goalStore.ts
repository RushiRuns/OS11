import { create } from 'zustand';
import { IPC } from '../../shared/ipc-channels.js';
import type {
  Goal,
  GoalStatus,
  CreateGoalPayload,
  UpdateGoalPayload,
  GoalLink,
  GoalHabitLog,
  GoalStreakStatus,
  GoalStreakDay,
  Task,
  Project,
} from '../../shared/types/index.js';
import { invoke } from '../services/ipc.js';

export interface GoalStoreState {
  goalsById: Record<string, Goal>;
  linksByGoalId: Record<string, GoalLink[]>;
  habitLogsByGoalId: Record<string, GoalHabitLog[]>;
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
  checkInHabit: (goalId: string, dateStr?: string) => Promise<{ goal: Goal; isToggledOff: boolean }>;
  getStreakStatus: (goalId: string) => GoalStreakStatus;
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
  habitLogsByGoalId: {},
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

      let allHabitLogs: GoalHabitLog[] = [];
      try {
        allHabitLogs = await invoke<GoalHabitLog[]>(IPC.GOALS.GET_HABIT_LOGS);
      } catch {
        // Best effort fallback
      }

      const habitLogsMap: Record<string, GoalHabitLog[]> = {};
      for (const log of allHabitLogs) {
        if (!habitLogsMap[log.goal_id]) {
          habitLogsMap[log.goal_id] = [];
        }
        habitLogsMap[log.goal_id].push(log);
      }

      set({
        goalsById: goalsMap,
        linksByGoalId: linksMap,
        habitLogsByGoalId: habitLogsMap,
        loading: false,
      });
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

  checkInHabit: async (goalId: string, dateStr?: string) => {
    try {
      const res = await invoke<{ goal: Goal; isToggledOff: boolean }>(IPC.GOALS.CHECK_IN, {
        goalId,
        targetDate: dateStr,
      });
      const targetDate = dateStr ?? new Date().toISOString().slice(0, 10);

      set((state) => {
        const existingLogs = state.habitLogsByGoalId[goalId] ?? [];
        let nextLogs: GoalHabitLog[];
        if (res.isToggledOff) {
          nextLogs = existingLogs.filter((l) => l.check_in_date !== targetDate);
        } else {
          nextLogs = existingLogs.some((l) => l.check_in_date === targetDate)
            ? existingLogs
            : [...existingLogs, { goal_id: goalId, check_in_date: targetDate, created_at: new Date().toISOString() }];
        }

        return {
          goalsById: { ...state.goalsById, [goalId]: res.goal },
          habitLogsByGoalId: { ...state.habitLogsByGoalId, [goalId]: nextLogs },
        };
      });

      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  incrementStreak: async (goalId: string) => {
    await get().checkInHabit(goalId);
  },

  getStreakStatus: (goalId: string): GoalStreakStatus => {
    const goal = get().goalsById[goalId];
    const logs = get().habitLogsByGoalId[goalId] ?? [];
    const logDates = new Set(logs.map((l) => l.check_in_date));

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const checkedInToday = logDates.has(todayStr);

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const recentDays: GoalStreakDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      recentDays.push({
        date: dStr,
        dayLabel: DAY_LABELS[d.getDay()],
        checked: logDates.has(dStr),
        isToday: i === 0,
      });
    }

    if (!goal || (goal.streak_count === 0 && logs.length === 0)) {
      return {
        health: 'inactive',
        currentStreak: 0,
        longestStreak: goal?.longest_streak ?? 0,
        checkedInToday: false,
        lastProgressAt: goal?.last_progress_at ?? null,
        recentDays,
      };
    }

    if (checkedInToday) {
      return {
        health: 'completed_today',
        currentStreak: goal.streak_count,
        longestStreak: Math.max(goal.longest_streak ?? 0, goal.streak_count),
        checkedInToday: true,
        lastProgressAt: goal.last_progress_at ?? null,
        recentDays,
      };
    }

    const lastDateStr = goal.last_progress_at ? goal.last_progress_at.slice(0, 10) : null;
    const wasYesterday = lastDateStr === yesterdayStr || logDates.has(yesterdayStr);

    if (wasYesterday) {
      return {
        health: 'due_today',
        currentStreak: goal.streak_count,
        longestStreak: Math.max(goal.longest_streak ?? 0, goal.streak_count),
        checkedInToday: false,
        lastProgressAt: goal.last_progress_at ?? null,
        recentDays,
      };
    }

    return {
      health: 'broken',
      currentStreak: 0,
      longestStreak: Math.max(goal.longest_streak ?? 0, goal.streak_count),
      checkedInToday: false,
      lastProgressAt: goal.last_progress_at ?? null,
      recentDays,
    };
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
