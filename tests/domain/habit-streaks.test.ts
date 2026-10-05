import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoalStore } from '../../src/renderer/stores/goalStore.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';
import type { Goal, GoalHabitLog, Task } from '../../src/shared/types/index.js';

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
import { taskServiceAdapter } from '../../src/renderer/services/task-service-adapter.js';

describe('Domain: Goal Habit Tracking & Streak Logic', () => {
  const sampleHabitGoal: Goal = {
    id: 'habit-goal-1',
    title: 'Daily Meditation',
    description: '15 mins mindfulness',
    goal_type: 'habit',
    status: 'active',
    target_date: null,
    target_value: 30,
    current_value: 0,
    streak_count: 5,
    longest_streak: 10,
    last_progress_at: null,
    completed_at: null,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      goalsById: { [sampleHabitGoal.id]: { ...sampleHabitGoal } },
      linksByGoalId: { [sampleHabitGoal.id]: [] },
      habitLogsByGoalId: { [sampleHabitGoal.id]: [] },
      loading: false,
      error: null,
    });
  });

  describe('getStreakStatus evaluation', () => {
    it('returns "inactive" when a goal has 0 streak and no logs', () => {
      useGoalStore.setState({
        goalsById: {
          'habit-goal-1': {
            ...sampleHabitGoal,
            streak_count: 0,
            longest_streak: 0,
            last_progress_at: null,
          },
        },
        habitLogsByGoalId: { 'habit-goal-1': [] },
      });

      const status = useGoalStore.getState().getStreakStatus('habit-goal-1');
      expect(status.health).toBe('inactive');
      expect(status.currentStreak).toBe(0);
      expect(status.checkedInToday).toBe(false);
      expect(status.recentDays).toHaveLength(7);
      expect(status.recentDays[6].isToday).toBe(true);
    });

    it('returns "completed_today" when today is recorded in habit logs', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const log: GoalHabitLog = {
        goal_id: 'habit-goal-1',
        check_in_date: todayStr,
        created_at: new Date().toISOString(),
      };

      useGoalStore.setState({
        goalsById: {
          'habit-goal-1': {
            ...sampleHabitGoal,
            streak_count: 6,
            longest_streak: 10,
            last_progress_at: `${todayStr}T12:00:00.000Z`,
          },
        },
        habitLogsByGoalId: { 'habit-goal-1': [log] },
      });

      const status = useGoalStore.getState().getStreakStatus('habit-goal-1');
      expect(status.health).toBe('completed_today');
      expect(status.currentStreak).toBe(6);
      expect(status.longestStreak).toBe(10);
      expect(status.checkedInToday).toBe(true);
      expect(status.recentDays[6].checked).toBe(true);
    });

    it('returns "due_today" when last check-in was yesterday and today is pending', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const log: GoalHabitLog = {
        goal_id: 'habit-goal-1',
        check_in_date: yesterdayStr,
        created_at: yesterday.toISOString(),
      };

      useGoalStore.setState({
        goalsById: {
          'habit-goal-1': {
            ...sampleHabitGoal,
            streak_count: 4,
            longest_streak: 10,
            last_progress_at: `${yesterdayStr}T12:00:00.000Z`,
          },
        },
        habitLogsByGoalId: { 'habit-goal-1': [log] },
      });

      const status = useGoalStore.getState().getStreakStatus('habit-goal-1');
      expect(status.health).toBe('due_today');
      expect(status.currentStreak).toBe(4);
      expect(status.checkedInToday).toBe(false);
      expect(status.recentDays[5].checked).toBe(true);
      expect(status.recentDays[6].checked).toBe(false);
    });

    it('returns "broken" when last progress was more than 1 day ago and today is pending', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const dateStr = threeDaysAgo.toISOString().slice(0, 10);

      const log: GoalHabitLog = {
        goal_id: 'habit-goal-1',
        check_in_date: dateStr,
        created_at: threeDaysAgo.toISOString(),
      };

      useGoalStore.setState({
        goalsById: {
          'habit-goal-1': {
            ...sampleHabitGoal,
            streak_count: 2,
            longest_streak: 10,
            last_progress_at: `${dateStr}T12:00:00.000Z`,
          },
        },
        habitLogsByGoalId: { 'habit-goal-1': [log] },
      });

      const status = useGoalStore.getState().getStreakStatus('habit-goal-1');
      expect(status.health).toBe('broken');
      expect(status.currentStreak).toBe(0);
      expect(status.longestStreak).toBe(10);
      expect(status.checkedInToday).toBe(false);
    });
  });

  describe('checkInHabit store mutation & toggle undo', () => {
    it('successfully checks in today, calls IPC, and records log optimistically', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const updatedGoal: Goal = {
        ...sampleHabitGoal,
        streak_count: 6,
        longest_streak: 10,
        last_progress_at: `${todayStr}T12:00:00.000Z`,
      };

      vi.mocked(invoke).mockResolvedValueOnce({
        goal: updatedGoal,
        isToggledOff: false,
      });

      const res = await useGoalStore.getState().checkInHabit('habit-goal-1', todayStr);

      expect(invoke).toHaveBeenCalledWith(IPC.GOALS.CHECK_IN, {
        goalId: 'habit-goal-1',
        targetDate: todayStr,
      });
      expect(res.isToggledOff).toBe(false);
      expect(useGoalStore.getState().goalsById['habit-goal-1'].streak_count).toBe(6);
      expect(useGoalStore.getState().habitLogsByGoalId['habit-goal-1']).toEqual(
        expect.arrayContaining([expect.objectContaining({ check_in_date: todayStr })])
      );
    });

    it('toggles off (undo) when checking in on an already checked date', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const existingLog: GoalHabitLog = {
        goal_id: 'habit-goal-1',
        check_in_date: todayStr,
        created_at: new Date().toISOString(),
      };

      useGoalStore.setState({
        goalsById: {
          'habit-goal-1': {
            ...sampleHabitGoal,
            streak_count: 6,
            longest_streak: 10,
            last_progress_at: `${todayStr}T12:00:00.000Z`,
          },
        },
        habitLogsByGoalId: { 'habit-goal-1': [existingLog] },
      });

      const revertedGoal: Goal = {
        ...sampleHabitGoal,
        streak_count: 5,
        longest_streak: 10,
        last_progress_at: null,
      };

      vi.mocked(invoke).mockResolvedValueOnce({
        goal: revertedGoal,
        isToggledOff: true,
      });

      const res = await useGoalStore.getState().checkInHabit('habit-goal-1', todayStr);

      expect(res.isToggledOff).toBe(true);
      expect(useGoalStore.getState().goalsById['habit-goal-1'].streak_count).toBe(5);
      expect(useGoalStore.getState().habitLogsByGoalId['habit-goal-1']).toHaveLength(0);
    });
  });

  describe('Task completion auto check-in integration', () => {
    it('triggers checkInHabit when a linked task is completed and goal is not yet checked in', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const task: Task = {
        id: 'task-habit-1',
        title: 'Morning Yoga',
        notes: null,
        list_id: null,
        project_id: null,
        area_id: null,
        section_id: null,
        parent_task_id: null,
        due_date: todayStr,
        due_time: null,
        all_day: 1,
        recurrence_rule: null,
        recurrence_basis: null,
        priority: 0,
        is_starred: 0,
        is_completed: 0,
        completed_at: null,
        estimated_minutes: null,
        assignee_device_id: null,
        created_by_device: 'local',
        sort_order: 1,
        my_day_date: null,
        pomodoro_count: 0,
        is_trashed: 0,
        trashed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      useGoalStore.setState({
        goalsById: { [sampleHabitGoal.id]: { ...sampleHabitGoal } },
        linksByGoalId: {
          [sampleHabitGoal.id]: [{ goal_id: sampleHabitGoal.id, resource_id: task.id, resource_type: 'task' }],
        },
        habitLogsByGoalId: { [sampleHabitGoal.id]: [] },
      });

      useTaskStore.setState({
        tasksById: { [task.id]: task },
      });

      const updatedTask: Task = {
        ...task,
        is_completed: 1,
        completed_at: new Date().toISOString(),
      };

      vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce(updatedTask);
      vi.mocked(invoke).mockResolvedValueOnce({
        goal: { ...sampleHabitGoal, streak_count: 6 },
        isToggledOff: false,
      });

      await useTaskStore.getState().toggleComplete(task.id);

      expect(invoke).toHaveBeenCalledWith(IPC.GOALS.CHECK_IN, {
        goalId: 'habit-goal-1',
        targetDate: undefined,
      });
    });

    it('does NOT trigger checkInHabit if the habit goal is already checked in today', async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const task: Task = {
        id: 'task-habit-2',
        title: 'Evening Run',
        notes: null,
        list_id: null,
        project_id: null,
        area_id: null,
        section_id: null,
        parent_task_id: null,
        due_date: todayStr,
        due_time: null,
        all_day: 1,
        recurrence_rule: null,
        recurrence_basis: null,
        priority: 0,
        is_starred: 0,
        is_completed: 0,
        completed_at: null,
        estimated_minutes: null,
        assignee_device_id: null,
        created_by_device: 'local',
        sort_order: 2,
        my_day_date: null,
        pomodoro_count: 0,
        is_trashed: 0,
        trashed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      useGoalStore.setState({
        goalsById: { [sampleHabitGoal.id]: { ...sampleHabitGoal } },
        linksByGoalId: {
          [sampleHabitGoal.id]: [{ goal_id: sampleHabitGoal.id, resource_id: task.id, resource_type: 'task' }],
        },
        habitLogsByGoalId: {
          [sampleHabitGoal.id]: [{ goal_id: sampleHabitGoal.id, check_in_date: todayStr, created_at: new Date().toISOString() }],
        },
      });

      useTaskStore.setState({
        tasksById: { [task.id]: task },
      });

      const updatedTask: Task = {
        ...task,
        is_completed: 1,
        completed_at: new Date().toISOString(),
      };

      vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce(updatedTask);

      await useTaskStore.getState().toggleComplete(task.id);

      expect(invoke).not.toHaveBeenCalledWith(IPC.GOALS.CHECK_IN, expect.anything());
    });
  });
});
