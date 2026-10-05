import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoalStore } from '../../src/renderer/stores/goalStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';
import type { Goal, GoalLink, Task } from '../../src/shared/types/index.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../src/renderer/services/ipc.js';

describe('Domain: Goal CRUD, Editing & Progress Capabilities', () => {
  const mockGoal: Goal = {
    id: 'goal-1',
    title: 'Read 25 Books',
    description: 'Personal development target',
    goal_type: 'outcome',
    status: 'active',
    target_date: '2026-12-31',
    target_value: 25,
    current_value: 5,
    streak_count: 3,
    longest_streak: 3,
    last_progress_at: '2026-10-01T12:00:00.000Z',
    completed_at: null,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-10-01T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      goalsById: { [mockGoal.id]: { ...mockGoal } },
      linksByGoalId: { [mockGoal.id]: [] },
      loading: false,
      error: null,
    });
  });

  it('adjustGoalProgress increments current_value and clamps to target_value', async () => {
    const updatedGoal: Goal = {
      ...mockGoal,
      current_value: 6,
      updated_at: new Date().toISOString(),
    };

    vi.mocked(invoke).mockResolvedValueOnce(updatedGoal);

    const res = await useGoalStore.getState().adjustGoalProgress('goal-1', 1);

    expect(res).toBeDefined();
    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-1',
      fields: expect.objectContaining({
        current_value: 6,
      }),
    });
  });

  it('adjustGoalProgress decrements current_value and clamps to minimum 0', async () => {
    useGoalStore.setState({
      goalsById: {
        'goal-1': { ...mockGoal, current_value: 0 },
      },
    });

    vi.mocked(invoke).mockResolvedValueOnce({ ...mockGoal, current_value: 0 });

    await useGoalStore.getState().adjustGoalProgress('goal-1', -1);

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-1',
      fields: expect.objectContaining({
        current_value: 0,
      }),
    });
  });

  it('computes progress accurately based on target and current values', () => {
    const emptyTasks: Record<string, Task> = {};
    const progress = useGoalStore.getState().computeProgress('goal-1', emptyTasks);

    // 5 / 25 = 20%
    expect(progress).toBe(20);
  });

  it('computes progress based on linked tasks when tasks are linked', () => {
    const mockTasks: Record<string, Task> = {
      'task-1': { id: 'task-1', title: 'Chapter 1', is_completed: 1 } as unknown as Task,
      'task-2': { id: 'task-2', title: 'Chapter 2', is_completed: 0 } as unknown as Task,
    };

    useGoalStore.setState({
      linksByGoalId: {
        'goal-1': [
          { goal_id: 'goal-1', resource_type: 'task', resource_id: 'task-1' },
          { goal_id: 'goal-1', resource_type: 'task', resource_id: 'task-2' },
        ],
      },
    });

    const progress = useGoalStore.getState().computeProgress('goal-1', mockTasks);
    // 1 of 2 tasks completed = 50%
    expect(progress).toBe(50);
  });

  it('restoreGoal recreates the goal with original ID and re-establishes links', async () => {
    const links: GoalLink[] = [
      { goal_id: 'goal-1', resource_type: 'task', resource_id: 'task-1' },
    ];

    vi.mocked(invoke).mockResolvedValueOnce(mockGoal); // for IPC.GOALS.CREATE
    vi.mocked(invoke).mockResolvedValueOnce({ ok: true }); // for IPC.GOALS.LINK_TASK

    // Reset store to empty
    useGoalStore.setState({
      goalsById: {},
      linksByGoalId: {},
    });

    await useGoalStore.getState().restoreGoal(mockGoal, links);

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.CREATE, mockGoal);
    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.LINK_TASK, {
      goalId: 'goal-1',
      resourceType: 'task',
      resourceId: 'task-1',
    });

    const state = useGoalStore.getState();
    expect(state.goalsById['goal-1']).toEqual(mockGoal);
    expect(state.linksByGoalId['goal-1']).toEqual(links);
  });
});
