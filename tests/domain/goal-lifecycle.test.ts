import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoalStore } from '../../src/renderer/stores/goalStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';
import type { Goal } from '../../src/shared/types/index.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../src/renderer/services/ipc.js';

describe('Domain: Goal Status Lifecycle & Archival', () => {
  const activeGoal: Goal = {
    id: 'goal-status-1',
    title: 'Run a Half Marathon',
    description: 'Fitness milestone',
    goal_type: 'milestone',
    status: 'active',
    target_date: '2026-11-20',
    target_value: 21,
    current_value: 15,
    streak_count: 7,
    longest_streak: 7,
    last_progress_at: '2026-10-01T08:00:00.000Z',
    completed_at: null,
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      goalsById: { [activeGoal.id]: { ...activeGoal } },
      linksByGoalId: { [activeGoal.id]: [] },
      loading: false,
      error: null,
    });
  });

  it('setGoalStatus transitions status to "completed" and sets completed_at timestamp', async () => {
    const completedGoal: Goal = {
      ...activeGoal,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    vi.mocked(invoke).mockResolvedValueOnce(completedGoal);

    await useGoalStore.getState().setGoalStatus('goal-status-1', 'completed');

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-status-1',
      fields: expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
      }),
    });
  });

  it('setGoalStatus transitions from "completed" back to "active" and clears completed_at', async () => {
    useGoalStore.setState({
      goalsById: {
        'goal-status-1': {
          ...activeGoal,
          status: 'completed',
          completed_at: '2026-10-02T10:00:00.000Z',
        },
      },
    });

    const reopenedGoal: Goal = {
      ...activeGoal,
      status: 'active',
      completed_at: null,
    };

    vi.mocked(invoke).mockResolvedValueOnce(reopenedGoal);

    await useGoalStore.getState().setGoalStatus('goal-status-1', 'active');

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-status-1',
      fields: expect.objectContaining({
        status: 'active',
        completed_at: null,
      }),
    });
  });

  it('setGoalStatus can transition status to "paused"', async () => {
    const pausedGoal: Goal = {
      ...activeGoal,
      status: 'paused',
    };

    vi.mocked(invoke).mockResolvedValueOnce(pausedGoal);

    await useGoalStore.getState().setGoalStatus('goal-status-1', 'paused');

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-status-1',
      fields: expect.objectContaining({
        status: 'paused',
        completed_at: null,
      }),
    });
  });

  it('archiveGoal delegates to setGoalStatus with "archived"', async () => {
    const archivedGoal: Goal = {
      ...activeGoal,
      status: 'archived',
    };

    vi.mocked(invoke).mockResolvedValueOnce(archivedGoal);

    await useGoalStore.getState().archiveGoal('goal-status-1');

    expect(invoke).toHaveBeenCalledWith(IPC.GOALS.UPDATE, {
      id: 'goal-status-1',
      fields: expect.objectContaining({
        status: 'archived',
      }),
    });
  });
});
