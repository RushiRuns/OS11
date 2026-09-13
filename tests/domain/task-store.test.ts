import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import type { Task } from '../../src/shared/types/task.js';

describe('Phase 5: Normalized Zustand Task Store & Selectors', () => {
  const sampleTask1: Task = {
    id: 'task-1',
    title: 'Design system tokens',
    notes: 'Use CSS variables',
    list_id: 'list_inbox',
    project_id: null,
    section_id: null,
    parent_task_id: null,
    due_date: '2026-09-15',
    due_time: null,
    all_day: 1,
    recurrence_rule: null,
    recurrence_basis: null,
    priority: 3,
    is_starred: 1,
    is_completed: 0,
    completed_at: null,
    estimated_minutes: 30,
    assignee_device_id: null,
    created_by_device: 'local',
    sort_order: 100,
    my_day_date: new Date().toISOString().split('T')[0],
    pomodoro_count: 2,
    is_trashed: 0,
    trashed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleTask2: Task = {
    id: 'task-2',
    title: 'Subtask item',
    notes: null,
    list_id: 'list_inbox',
    project_id: null,
    section_id: null,
    parent_task_id: 'task-1',
    due_date: null,
    due_time: null,
    all_day: 0,
    recurrence_rule: null,
    recurrence_basis: null,
    priority: 1,
    is_starred: 0,
    is_completed: 1,
    completed_at: new Date().toISOString(),
    estimated_minutes: 15,
    assignee_device_id: null,
    created_by_device: 'local',
    sort_order: 200,
    my_day_date: null,
    pomodoro_count: 0,
    is_trashed: 0,
    trashed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    useTaskStore.setState({
      tasksById: {
        'task-1': sampleTask1,
        'task-2': sampleTask2,
      },
      loading: false,
      error: null,
      selectedTaskId: null,
    });
  });

  it('stores tasks indexed by ID in a normalized map (PERFORMANCE.md §12)', () => {
    const state = useTaskStore.getState();
    expect(state.tasksById['task-1']).toBeDefined();
    expect(state.tasksById['task-1'].title).toBe('Design system tokens');
    expect(state.tasksById['task-2'].parent_task_id).toBe('task-1');
  });

  it('appends tasks to existing dictionary without duplicate keys', () => {
    const task3: Task = {
      ...sampleTask1,
      id: 'task-3',
      title: 'Review PR',
    };

    useTaskStore.getState().appendTasks([task3]);

    const state = useTaskStore.getState();
    expect(Object.keys(state.tasksById).length).toBe(3);
    expect(state.tasksById['task-3'].title).toBe('Review PR');
  });

  it('rolls back update when rollbackUpdate is invoked', () => {
    const store = useTaskStore.getState();
    const original = store.tasksById['task-1'];

    // Mutate
    useTaskStore.setState({
      tasksById: {
        ...store.tasksById,
        'task-1': { ...original, title: 'Optimistic change' },
      },
    });

    expect(useTaskStore.getState().tasksById['task-1'].title).toBe('Optimistic change');

    // Rollback
    useTaskStore.getState().rollbackUpdate('task-1', original);
    expect(useTaskStore.getState().tasksById['task-1'].title).toBe('Design system tokens');
  });

  it('removes item completely if rolled back from an optimistic create', () => {
    useTaskStore.setState({
      tasksById: {
        ...useTaskStore.getState().tasksById,
        'temp-123': { ...sampleTask1, id: 'temp-123' },
      },
    });

    expect(useTaskStore.getState().tasksById['temp-123']).toBeDefined();

    useTaskStore.getState().rollbackUpdate('temp-123', null);
    expect(useTaskStore.getState().tasksById['temp-123']).toBeUndefined();
  });
});
