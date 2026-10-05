import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGoalStore } from '../../src/renderer/stores/goalStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';
import type { Goal, Task, Project } from '../../src/shared/types/index.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../src/renderer/services/ipc.js';

describe('Domain: Goal Linking & Entity Relationships', () => {
  const topGoal: Goal = {
    id: 'goal-top',
    title: 'Become Principal Engineer',
    description: 'Career growth & leadership',
    goal_type: 'outcome',
    status: 'active',
    category: 'Career',
    parent_goal_id: null,
    target_date: '2027-12-31',
    target_value: 100,
    current_value: 0,
    streak_count: 0,
    longest_streak: 0,
    last_progress_at: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const subGoal1: Goal = {
    id: 'goal-sub-1',
    title: 'Publish 3 Technical Papers',
    description: 'Technical influence',
    goal_type: 'milestone',
    status: 'active',
    category: 'Career',
    parent_goal_id: 'goal-top',
    target_date: '2026-12-31',
    target_value: 3,
    current_value: 1,
    streak_count: 2,
    longest_streak: 2,
    last_progress_at: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const subGoal2: Goal = {
    id: 'goal-sub-2',
    title: 'Lead Architecture Modernization',
    description: 'Team leadership',
    goal_type: 'outcome',
    status: 'completed',
    category: 'Career',
    parent_goal_id: 'goal-top',
    target_date: '2026-06-30',
    target_value: 100,
    current_value: 100,
    streak_count: 0,
    longest_streak: 5,
    last_progress_at: null,
    completed_at: '2026-06-30T12:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-06-30T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGoalStore.setState({
      goalsById: {
        [topGoal.id]: { ...topGoal },
        [subGoal1.id]: { ...subGoal1 },
        [subGoal2.id]: { ...subGoal2 },
      },
      linksByGoalId: {
        [topGoal.id]: [],
        [subGoal1.id]: [],
        [subGoal2.id]: [],
      },
      loading: false,
      error: null,
    });
  });

  describe('Hierarchy Selectors', () => {
    it('getSubGoals returns all children goals of a parent goal', () => {
      const subGoals = useGoalStore.getState().getSubGoals('goal-top');
      expect(subGoals).toHaveLength(2);
      expect(subGoals.map((g) => g.id)).toContain('goal-sub-1');
      expect(subGoals.map((g) => g.id)).toContain('goal-sub-2');
    });

    it('getParentGoal returns the parent goal for a child goal', () => {
      const parent = useGoalStore.getState().getParentGoal('goal-sub-1');
      expect(parent).not.toBeNull();
      expect(parent?.id).toBe('goal-top');
      expect(parent?.title).toBe('Become Principal Engineer');
    });

    it('getParentGoal returns null for top-level goals', () => {
      const parent = useGoalStore.getState().getParentGoal('goal-top');
      expect(parent).toBeNull();
    });
  });

  describe('Reverse Lookups', () => {
    it('getGoalForTask correctly identifies which goal a task is linked to', () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-top': [{ goal_id: 'goal-top', resource_type: 'task', resource_id: 'task-101' }],
        },
      });

      const goal = useGoalStore.getState().getGoalForTask('task-101');
      expect(goal).not.toBeNull();
      expect(goal?.id).toBe('goal-top');

      const nonExistent = useGoalStore.getState().getGoalForTask('task-999');
      expect(nonExistent).toBeNull();
    });

    it('getGoalForProject correctly identifies which goal a project is linked to', () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-sub-1': [{ goal_id: 'goal-sub-1', resource_type: 'project', resource_id: 'proj-42' }],
        },
      });

      const goal = useGoalStore.getState().getGoalForProject('proj-42');
      expect(goal).not.toBeNull();
      expect(goal?.id).toBe('goal-sub-1');

      const nonExistent = useGoalStore.getState().getGoalForProject('proj-999');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Unified Progress Computation', () => {
    it('computes progress based on linked tasks', () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-sub-1': [
            { goal_id: 'goal-sub-1', resource_type: 'task', resource_id: 't1' },
            { goal_id: 'goal-sub-1', resource_type: 'task', resource_id: 't2' },
          ],
        },
      });

      const mockTasks: Record<string, Task> = {
        t1: { id: 't1', title: 'Task 1', is_completed: 1 } as Task,
        t2: { id: 't2', title: 'Task 2', is_completed: 0 } as Task,
      };

      const progress = useGoalStore.getState().computeProgress('goal-sub-1', mockTasks);
      expect(progress).toBe(50);
    });

    it('computes progress based on linked projects', () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-sub-1': [
            { goal_id: 'goal-sub-1', resource_type: 'project', resource_id: 'p1' },
            { goal_id: 'goal-sub-1', resource_type: 'project', resource_id: 'p2' },
          ],
        },
      });

      const mockProjects: Record<string, Project> = {
        p1: { id: 'p1', name: 'Project 1', status: 'completed' } as Project,
        p2: { id: 'p2', name: 'Project 2', status: 'active' } as Project,
      };

      const progress = useGoalStore.getState().computeProgress('goal-sub-1', {}, mockProjects);
      expect(progress).toBe(50);
    });

    it('blends progress across linked tasks, linked projects, and sub-goals', () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-top': [
            { goal_id: 'goal-top', resource_type: 'task', resource_id: 't-blend' },
            { goal_id: 'goal-top', resource_type: 'project', resource_id: 'p-blend' },
          ],
        },
      });

      const mockTasks: Record<string, Task> = {
        't-blend': { id: 't-blend', title: 'Blend Task', is_completed: 1 } as Task,
      };

      const mockProjects: Record<string, Project> = {
        'p-blend': { id: 'p-blend', name: 'Blend Project', status: 'active' } as Project,
      };

      const progress = useGoalStore.getState().computeProgress('goal-top', mockTasks, mockProjects);
      expect(progress).toBe(58);
    });

    it('falls back to numeric value progress when no links or sub-goals exist', () => {
      const standaloneGoal: Goal = {
        id: 'goal-num',
        title: 'Save $10,000',
        goal_type: 'outcome',
        status: 'active',
        category: null,
        parent_goal_id: null,
        target_value: 10000,
        current_value: 3500,
        streak_count: 0,
        longest_streak: 0,
        last_progress_at: null,
        completed_at: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      };

      useGoalStore.setState({
        goalsById: { [standaloneGoal.id]: standaloneGoal },
        linksByGoalId: { [standaloneGoal.id]: [] },
      });

      const progress = useGoalStore.getState().computeProgress('goal-num', {});
      expect(progress).toBe(35);
    });
  });

  describe('Project Linking Actions', () => {
    it('linkTask supports resourceType "project"', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useGoalStore.getState().linkTask('goal-top', 'proj-123', 'project');

      expect(invoke).toHaveBeenCalledWith(IPC.GOALS.LINK_TASK, {
        goalId: 'goal-top',
        resourceType: 'project',
        resourceId: 'proj-123',
      });

      const links = useGoalStore.getState().linksByGoalId['goal-top'];
      expect(links).toContainEqual({
        goal_id: 'goal-top',
        resource_type: 'project',
        resource_id: 'proj-123',
      });
    });

    it('unlinkTask supports resourceType "project"', async () => {
      useGoalStore.setState({
        linksByGoalId: {
          'goal-top': [
            { goal_id: 'goal-top', resource_type: 'project', resource_id: 'proj-123' },
            { goal_id: 'goal-top', resource_type: 'task', resource_id: 'task-456' },
          ],
        },
      });

      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useGoalStore.getState().unlinkTask('goal-top', 'proj-123', 'project');

      expect(invoke).toHaveBeenCalledWith(IPC.GOALS.LINK_TASK, {
        goalId: 'goal-top',
        resourceType: 'project',
        resourceId: 'proj-123',
        unlink: true,
      });

      const links = useGoalStore.getState().linksByGoalId['goal-top'];
      expect(links).toHaveLength(1);
      expect(links[0].resource_id).toBe('task-456');
    });
  });
});
