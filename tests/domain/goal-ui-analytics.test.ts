import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoalStore } from '../../src/renderer/stores/goalStore.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useProjectStore } from '../../src/renderer/stores/projectStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';
import type {
  Goal,
  CreateGoalPayload,
  GoalProgressLog,
} from '../../src/shared/types/index.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../src/renderer/services/task-service-adapter.js', () => ({
  taskServiceAdapter: {
    toggleComplete: vi.fn(),
    complete: vi.fn(),
  },
}));

vi.mock('../../src/renderer/utils/sound-effects.js', () => ({
  playTaskCompleteSound: vi.fn(),
  playTaskCreateSound: vi.fn(),
}));

import { invoke } from '../../src/renderer/services/ipc.js';

function getOffsetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Domain: Goal UI/UX, Filtering & Analytics', () => {
  const sampleGoal: Goal = {
    id: 'goal-analytics-1',
    title: 'Master TypeScript Architecture',
    description: 'Deep dive into compiler internals and sound typing',
    goal_type: 'milestone',
    status: 'active',
    category: 'Engineering',
    target_date: getOffsetDate(5),
    target_value: 100,
    current_value: 40,
    streak_count: 7,
    longest_streak: 12,
    last_progress_at: null,
    completed_at: null,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      goalsById: { [sampleGoal.id]: { ...sampleGoal } },
      linksByGoalId: { [sampleGoal.id]: [] },
      habitLogsByGoalId: { [sampleGoal.id]: [] },
      progressLogsByGoalId: { [sampleGoal.id]: [] },
      loading: false,
      error: null,
    });
    useTaskStore.setState({ tasksById: {} });
    useProjectStore.setState({ projectsById: {} });
  });

  describe('Deadline Health Calculation (getDeadlineInfo)', () => {
    it('returns "completed" state for completed goals', () => {
      const completedGoal: Goal = {
        ...sampleGoal,
        status: 'completed',
        completed_at: '2026-10-01T12:00:00.000Z',
      };
      const info = useGoalStore.getState().getDeadlineInfo(completedGoal);
      expect(info.state).toBe('completed');
      expect(info.label).toContain('Completed');
      expect(info.diffDays).toBeNull();
    });

    it('returns "none" state for archived goals', () => {
      const archivedGoal: Goal = {
        ...sampleGoal,
        status: 'archived',
      };
      const info = useGoalStore.getState().getDeadlineInfo(archivedGoal);
      expect(info.state).toBe('none');
      expect(info.label).toBe('📦 Archived');
      expect(info.diffDays).toBeNull();
    });

    it('returns "none" state when target_date is not set', () => {
      const noDateGoal: Goal = {
        ...sampleGoal,
        target_date: null,
      };
      const info = useGoalStore.getState().getDeadlineInfo(noDateGoal);
      expect(info.state).toBe('none');
      expect(info.label).toBe('No target date');
      expect(info.diffDays).toBeNull();
    });

    it('returns "overdue" state for past deadlines', () => {
      const overdueGoal: Goal = {
        ...sampleGoal,
        target_date: getOffsetDate(-3),
      };
      const info = useGoalStore.getState().getDeadlineInfo(overdueGoal);
      expect(info.state).toBe('overdue');
      expect(info.diffDays).toBeLessThan(0);
      expect(info.label).toContain('Overdue');
    });

    it('returns "due_today" state when target_date matches current local day', () => {
      const dueTodayGoal: Goal = {
        ...sampleGoal,
        target_date: getOffsetDate(0),
      };
      const info = useGoalStore.getState().getDeadlineInfo(dueTodayGoal);
      expect(info.state).toBe('due_today');
      expect(info.diffDays).toBe(0);
      expect(info.label).toBe('⏳ Due Today');
    });

    it('returns "due_soon" state when target_date is 1 to 3 days away', () => {
      const dueSoonGoal: Goal = {
        ...sampleGoal,
        target_date: getOffsetDate(2),
      };
      const info = useGoalStore.getState().getDeadlineInfo(dueSoonGoal);
      expect(info.state).toBe('due_soon');
      expect(info.diffDays).toBe(2);
      expect(info.label).toContain('Due in 2d');
    });

    it('returns "on_track" state when target_date is more than 3 days away', () => {
      const onTrackGoal: Goal = {
        ...sampleGoal,
        target_date: getOffsetDate(10),
      };
      const info = useGoalStore.getState().getDeadlineInfo(onTrackGoal);
      expect(info.state).toBe('on_track');
      expect(info.diffDays).toBe(10);
      expect(info.label).toContain('10d left');
    });
  });

  describe('Goal Duplication (duplicateGoal)', () => {
    it('creates a clone with (Copy) title and reset progress/streak metrics', async () => {
      const original: Goal = {
        ...sampleGoal,
        title: 'Launch Space Probe',
        current_value: 90,
        streak_count: 14,
        longest_streak: 20,
        completed_at: '2026-09-30T10:00:00.000Z',
      };

      const clonedId = 'goal-analytics-clone';
      vi.mocked(invoke).mockImplementation(async (channel: string, payload: unknown) => {
        if (channel === IPC.GOALS.CREATE) {
          const createPayload = payload as CreateGoalPayload;
          const newGoal: Goal = {
            id: clonedId,
            title: createPayload.title,
            description: createPayload.description ?? null,
            goal_type: createPayload.goal_type,
            status: createPayload.status ?? 'active',
            category: createPayload.category ?? null,
            parent_goal_id: createPayload.parent_goal_id ?? null,
            target_date: createPayload.target_date ?? null,
            target_value: createPayload.target_value ?? 100,
            current_value: createPayload.current_value ?? 0,
            streak_count: createPayload.streak_count ?? 0,
            longest_streak: createPayload.longest_streak ?? 0,
            created_at: '2026-10-05T10:00:00.000Z',
            updated_at: '2026-10-05T10:00:00.000Z',
          };
          return newGoal;
        }
        return null;
      });

      useGoalStore.setState({
        goalsById: { [original.id]: original },
      });

      const duplicate = await useGoalStore.getState().duplicateGoal(original.id);
      expect(duplicate).not.toBeNull();
      expect(duplicate?.title).toBe('Launch Space Probe (Copy)');
      expect(duplicate?.current_value).toBe(0);
      expect(duplicate?.streak_count).toBe(0);
      expect(duplicate?.longest_streak).toBe(0);
      expect(duplicate?.status).toBe('active');
      expect(duplicate?.category).toBe('Engineering');
      expect(duplicate?.target_value).toBe(100);
      expect(useGoalStore.getState().goalsById[clonedId]).toBeDefined();
    });

    it('does not append duplicate (Copy) suffix if already present', async () => {
      const copyGoal: Goal = {
        ...sampleGoal,
        title: 'Launch Space Probe (Copy)',
      };

      vi.mocked(invoke).mockImplementation(async (channel: string, payload: unknown) => {
        if (channel === IPC.GOALS.CREATE) {
          const createPayload = payload as CreateGoalPayload;
          return {
            ...copyGoal,
            id: 'copy-2',
            title: createPayload.title,
          };
        }
        return null;
      });

      useGoalStore.setState({
        goalsById: { [copyGoal.id]: copyGoal },
      });

      const duplicate = await useGoalStore.getState().duplicateGoal(copyGoal.id);
      expect(duplicate?.title).toBe('Launch Space Probe (Copy)');
    });
  });

  describe('Goal Progress Logs (recordProgressLog & adjustGoalProgress)', () => {
    it('records progress log and stores it in progressLogsByGoalId', async () => {
      const mockLog: GoalProgressLog = {
        id: 'log-1',
        goal_id: sampleGoal.id,
        progress_percent: 50,
        current_value: 50,
        recorded_at: '2026-10-05T10:00:00.000Z',
      };

      vi.mocked(invoke).mockImplementation(async (channel: string) => {
        if (channel === IPC.GOALS.RECORD_PROGRESS_LOG) {
          return mockLog;
        }
        return null;
      });

      const result = await useGoalStore.getState().recordProgressLog(sampleGoal.id, 50, 50);
      expect(result).toEqual(mockLog);
      const logs = useGoalStore.getState().progressLogsByGoalId[sampleGoal.id];
      expect(logs).toHaveLength(1);
      expect(logs[0].progress_percent).toBe(50);
    });

    it('adjustGoalProgress adjusts current_value and auto-records log', async () => {
      vi.mocked(invoke).mockImplementation(async (channel: string, payload: unknown) => {
        if (channel === IPC.GOALS.UPDATE) {
          const p = payload as { id: string; fields: Partial<Goal> };
          return {
            ...sampleGoal,
            ...p.fields,
            updated_at: '2026-10-05T10:30:00.000Z',
          };
        }
        if (channel === IPC.GOALS.RECORD_PROGRESS_LOG) {
          const p = payload as { goalId: string; progressPercent: number; currentValue: number };
          return {
            id: 'auto-log-1',
            goal_id: p.goalId,
            progress_percent: p.progressPercent,
            current_value: p.currentValue,
            recorded_at: '2026-10-05T10:30:00.000Z',
          };
        }
        return null;
      });

      // Sample goal target_value: 100, current_value: 40 -> +10 -> 50
      await useGoalStore.getState().adjustGoalProgress(sampleGoal.id, 10);

      const updated = useGoalStore.getState().goalsById[sampleGoal.id];
      expect(updated.current_value).toBe(50);
      const logs = useGoalStore.getState().progressLogsByGoalId[sampleGoal.id];
      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].current_value).toBe(50);
      expect(logs[0].progress_percent).toBe(50);
    });
  });

  describe('Analytics & KPI Summary (computeAnalyticsSummary)', () => {
    it('accurately calculates metrics across active, completed, overdue, and categories', () => {
      const g1: Goal = {
        ...sampleGoal,
        id: 'g1',
        goal_type: 'habit',
        status: 'active',
        category: 'Health',
        current_value: 50,
        target_value: 100,
        streak_count: 5,
        longest_streak: 5,
        target_date: getOffsetDate(-2), // Overdue
      };
      const g2: Goal = {
        ...sampleGoal,
        id: 'g2',
        status: 'completed',
        category: 'Health',
        current_value: 100,
        target_value: 100,
        streak_count: 10,
        completed_at: '2026-10-01T10:00:00.000Z',
      };
      const g3: Goal = {
        ...sampleGoal,
        id: 'g3',
        status: 'active',
        category: 'Career',
        current_value: 20,
        target_value: 100,
        streak_count: 0,
        target_date: getOffsetDate(10), // On track
      };
      const g4: Goal = {
        ...sampleGoal,
        id: 'g4',
        status: 'archived',
        category: 'Career',
        current_value: 10,
        target_value: 100,
        streak_count: 0,
      };

      useGoalStore.setState({
        goalsById: { g1, g2, g3, g4 },
      });

      const summary = useGoalStore.getState().computeAnalyticsSummary({}, {});
      expect(summary.totalGoals).toBe(4);
      expect(summary.activeGoals).toBe(2);
      expect(summary.completedGoals).toBe(1);
      expect(summary.archivedGoals).toBe(1);
      // Completion rate: 1 completed / 4 total = 25%
      expect(summary.completionRate).toBe(25);
      // Active goals: g1 (50%), g3 (20%) -> avg = 35%
      expect(summary.overallActiveProgress).toBe(35);
      // Overdue active goals: g1
      expect(summary.overdueCount).toBe(1);
      // Total active streaks: g1 (5) = 5
      expect(summary.totalActiveStreaks).toBe(5);
      expect(summary.topStreak).toBe(5);

      // Category breakdown
      const healthCat = summary.categoryBreakdown.find((c) => c.category === 'Health');
      expect(healthCat).toBeDefined();
      expect(healthCat?.count).toBe(2);
      expect(healthCat?.completedCount).toBe(1);

      const careerCat = summary.categoryBreakdown.find((c) => c.category === 'Career');
      expect(careerCat).toBeDefined();
      expect(careerCat?.count).toBe(2);
    });
  });

  describe('Search & Multi-criteria Sorting', () => {
    it('filters goals by search query across title, description, and category', () => {
      const goals: Goal[] = [
        {
          ...sampleGoal,
          id: '1',
          title: 'Learn Rust Async',
          description: 'Focus on tokio runtime',
          category: 'Coding',
        },
        {
          ...sampleGoal,
          id: '2',
          title: 'Run Marathon',
          description: 'Weekly long run training',
          category: 'Fitness',
        },
        {
          ...sampleGoal,
          id: '3',
          title: 'Publish Tech Blog',
          description: 'Write about web development',
          category: 'Rustaceans',
        },
      ];

      const queryFilter = (q: string) => {
        const lower = q.toLowerCase().trim();
        return goals.filter((g) => {
          return (
            g.title.toLowerCase().includes(lower) ||
            (g.description ?? '').toLowerCase().includes(lower) ||
            (g.category ?? '').toLowerCase().includes(lower)
          );
        });
      };

      // Search matching title
      expect(queryFilter('Async')).toHaveLength(1);
      expect(queryFilter('Async')[0].id).toBe('1');

      // Search matching description
      expect(queryFilter('tokio')).toHaveLength(1);
      expect(queryFilter('tokio')[0].id).toBe('1');

      // Search matching category
      expect(queryFilter('Rustaceans')).toHaveLength(1);
      expect(queryFilter('Rustaceans')[0].id).toBe('3');

      // Search matching multiple (Rust matches title in 1, and category in 3)
      expect(queryFilter('rust')).toHaveLength(2);
    });

    it('sorts goals by target date soonest and furthest correctly', () => {
      const gEarly: Goal = { ...sampleGoal, id: 'early', target_date: '2026-10-10' };
      const gLate: Goal = { ...sampleGoal, id: 'late', target_date: '2026-11-20' };
      const gNoDate: Goal = { ...sampleGoal, id: 'nodate', target_date: null };

      const list = [gNoDate, gLate, gEarly];

      const sortSoonest = [...list].sort((a, b) => {
        if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return 0;
      });
      expect(sortSoonest.map((g) => g.id)).toEqual(['early', 'late', 'nodate']);

      const sortFurthest = [...list].sort((a, b) => {
        if (a.target_date && b.target_date) return b.target_date.localeCompare(a.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return 0;
      });
      expect(sortFurthest.map((g) => g.id)).toEqual(['late', 'early', 'nodate']);
    });

    it('sorts goals by progress high to low and low to high', () => {
      const computeProgress = (g: Goal) => Math.round((g.current_value / g.target_value) * 100);

      const gLow: Goal = { ...sampleGoal, id: 'low', current_value: 10, target_value: 100 };
      const gMid: Goal = { ...sampleGoal, id: 'mid', current_value: 50, target_value: 100 };
      const gHigh: Goal = { ...sampleGoal, id: 'high', current_value: 90, target_value: 100 };

      const list = [gMid, gLow, gHigh];

      const sortHighToLow = [...list].sort((a, b) => computeProgress(b) - computeProgress(a));
      expect(sortHighToLow.map((g) => g.id)).toEqual(['high', 'mid', 'low']);

      const sortLowToHigh = [...list].sort((a, b) => computeProgress(a) - computeProgress(b));
      expect(sortLowToHigh.map((g) => g.id)).toEqual(['low', 'mid', 'high']);
    });

    it('sorts goals by streak count descending', () => {
      const g0: Goal = { ...sampleGoal, id: 's0', streak_count: 0, longest_streak: 2 };
      const g5: Goal = { ...sampleGoal, id: 's5', streak_count: 5, longest_streak: 5 };
      const g10: Goal = { ...sampleGoal, id: 's10', streak_count: 10, longest_streak: 15 };

      const list = [g0, g10, g5];
      const sorted = [...list].sort((a, b) => (b.streak_count ?? 0) - (a.streak_count ?? 0));
      expect(sorted.map((g) => g.id)).toEqual(['s10', 's5', 's0']);
    });
  });
});
