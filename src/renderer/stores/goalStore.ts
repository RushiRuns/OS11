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
  GoalProgressLog,
  GoalDeadlineInfo,
  GoalAnalyticsSummary,
  Task,
  Project,
} from '../../shared/types/index.js';
import { invoke } from '../services/ipc.js';

export interface GoalStoreState {
  goalsById: Record<string, Goal>;
  linksByGoalId: Record<string, GoalLink[]>;
  habitLogsByGoalId: Record<string, GoalHabitLog[]>;
  progressLogsByGoalId: Record<string, GoalProgressLog[]>;
  loading: boolean;
  error: string | null;

  // Actions
  loadGoals: () => Promise<void>;
  createGoal: (payload: CreateGoalPayload) => Promise<Goal>;
  updateGoal: (id: string, fields: UpdateGoalPayload) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  duplicateGoal: (id: string) => Promise<Goal>;
  linkTask: (goalId: string, resourceId: string, resourceType?: 'task' | 'project') => Promise<void>;
  unlinkTask: (goalId: string, resourceId: string, resourceType?: 'task' | 'project') => Promise<void>;
  incrementStreak: (goalId: string) => Promise<void>;
  checkInHabit: (goalId: string, dateStr?: string) => Promise<{ goal: Goal; isToggledOff: boolean }>;
  getStreakStatus: (goalId: string) => GoalStreakStatus;
  getDeadlineInfo: (goal: Goal) => GoalDeadlineInfo;
  recordProgressLog: (goalId: string, progressPercent: number, currentValue: number) => Promise<GoalProgressLog>;
  computeProgress: (
    goalId: string,
    tasksById: Record<string, Task>,
    projectsById?: Record<string, Project>
  ) => number;
  computeAnalyticsSummary: (
    tasksById: Record<string, Task>,
    projectsById?: Record<string, Project>
  ) => GoalAnalyticsSummary;
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
  progressLogsByGoalId: {},
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

      let allProgressLogs: GoalProgressLog[] = [];
      try {
        allProgressLogs = await invoke<GoalProgressLog[]>(IPC.GOALS.GET_PROGRESS_LOGS);
      } catch {
        // Best effort fallback
      }

      const progressLogsMap: Record<string, GoalProgressLog[]> = {};
      for (const pl of allProgressLogs) {
        if (!progressLogsMap[pl.goal_id]) {
          progressLogsMap[pl.goal_id] = [];
        }
        progressLogsMap[pl.goal_id].push(pl);
      }

      set({
        goalsById: goalsMap,
        linksByGoalId: linksMap,
        habitLogsByGoalId: habitLogsMap,
        progressLogsByGoalId: progressLogsMap,
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

  duplicateGoal: async (id: string): Promise<Goal> => {
    const goal = get().goalsById[id];
    if (!goal) {
      throw new Error(`Goal not found: ${id}`);
    }

    const newTitle = goal.title.endsWith('(Copy)')
      ? goal.title
      : `${goal.title} (Copy)`;

    const payload: CreateGoalPayload = {
      title: newTitle,
      description: goal.description,
      goal_type: goal.goal_type,
      category: goal.category,
      status: 'active',
      parent_goal_id: goal.parent_goal_id,
      target_date: goal.target_date,
      target_value: goal.target_value,
      current_value: 0,
      streak_count: 0,
      longest_streak: 0,
    };

    return await get().createGoal(payload);
  },

  getDeadlineInfo: (goal: Goal): GoalDeadlineInfo => {
    if (goal.status === 'completed') {
      return {
        state: 'completed',
        label: goal.completed_at ? `🏆 Completed ${goal.completed_at.slice(0, 10)}` : '🏆 Completed',
        diffDays: null,
      };
    }

    if (goal.status === 'archived') {
      return {
        state: 'none',
        label: '📦 Archived',
        diffDays: null,
      };
    }

    if (!goal.target_date) {
      return {
        state: 'none',
        label: 'No target date',
        diffDays: null,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = goal.target_date.split('-').map((v) => parseInt(v, 10));
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        state: 'overdue',
        label: `⚠️ Overdue by ${overdueDays}d`,
        diffDays,
      };
    }

    if (diffDays === 0) {
      return {
        state: 'due_today',
        label: '⏳ Due Today',
        diffDays: 0,
      };
    }

    if (diffDays <= 3) {
      return {
        state: 'due_soon',
        label: `📅 Due in ${diffDays}d`,
        diffDays,
      };
    }

    return {
      state: 'on_track',
      label: `🎯 Target: ${goal.target_date} (${diffDays}d left)`,
      diffDays,
    };
  },

  recordProgressLog: async (goalId: string, progressPercent: number, currentValue: number) => {
    try {
      const res = await invoke<GoalProgressLog>(IPC.GOALS.RECORD_PROGRESS_LOG, {
        goalId,
        progressPercent,
        currentValue,
      });
      set((state) => {
        const existing = state.progressLogsByGoalId[goalId] ?? [];
        return {
          progressLogsByGoalId: {
            ...state.progressLogsByGoalId,
            [goalId]: [...existing, res],
          },
        };
      });
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  adjustGoalProgress: async (goalId: string, delta: number) => {
    const goal = get().goalsById[goalId];
    if (!goal) return undefined;
    const current = goal.current_value ?? 0;
    const maxVal = goal.target_value > 0 ? goal.target_value : Infinity;
    const nextVal = Math.max(0, Math.min(maxVal, Math.round((current + delta) * 100) / 100));
    const updated = await get().updateGoal(goalId, {
      current_value: nextVal,
      last_progress_at: new Date().toISOString(),
    });

    const percent = maxVal > 0 && maxVal !== Infinity ? Math.min(100, Math.round((nextVal / maxVal) * 100)) : 0;
    await get().recordProgressLog(goalId, percent, nextVal).catch(() => {});

    return updated;
  },

  computeAnalyticsSummary: (
    tasksById: Record<string, Task>,
    projectsById: Record<string, Project> = {}
  ): GoalAnalyticsSummary => {
    const allGoals = Object.values(get().goalsById);
    const totalGoals = allGoals.length;
    const activeGoalsList = allGoals.filter((g) => (g.status ?? 'active') === 'active' || g.status === 'paused');
    const activeGoals = activeGoalsList.length;
    const completedGoals = allGoals.filter((g) => g.status === 'completed').length;
    const archivedGoals = allGoals.filter((g) => g.status === 'archived').length;

    const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    let totalActiveProgress = 0;
    for (const g of activeGoalsList) {
      totalActiveProgress += get().computeProgress(g.id, tasksById, projectsById);
    }
    const overallActiveProgress = activeGoalsList.length > 0 ? Math.round(totalActiveProgress / activeGoalsList.length) : 0;

    let overdueCount = 0;
    for (const g of activeGoalsList) {
      const deadline = get().getDeadlineInfo(g);
      if (deadline.state === 'overdue') {
        overdueCount++;
      }
    }

    let totalActiveStreaks = 0;
    let topStreak = 0;
    for (const g of allGoals) {
      if (g.goal_type === 'habit' && g.status !== 'archived') {
        if (g.streak_count > 0) {
          totalActiveStreaks += g.streak_count;
        }
        if (g.longest_streak > topStreak) {
          topStreak = g.longest_streak;
        }
      }
    }

    const categoryMap: Record<string, { total: number; sumProgress: number; completed: number }> = {};
    for (const g of allGoals) {
      const cat = g.category?.trim() || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { total: 0, sumProgress: 0, completed: 0 };
      }
      categoryMap[cat].total += 1;
      const prog = get().computeProgress(g.id, tasksById, projectsById);
      categoryMap[cat].sumProgress += prog;
      if (g.status === 'completed') {
        categoryMap[cat].completed += 1;
      }
    }

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, stats]) => ({
        category,
        count: stats.total,
        avgProgress: stats.total > 0 ? Math.round(stats.sumProgress / stats.total) : 0,
        completedCount: stats.completed,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      archivedGoals,
      completionRate,
      overallActiveProgress,
      overdueCount,
      totalActiveStreaks,
      topStreak,
      categoryBreakdown,
    };
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
