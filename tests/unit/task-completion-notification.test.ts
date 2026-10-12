import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useUndoRedoStore } from '../../src/renderer/hooks/useUndoRedo.js';
import type { Task } from '../../src/shared/types/task.js';

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

import { taskServiceAdapter } from '../../src/renderer/services/task-service-adapter.js';

describe('Task Completion Notification Behavior', () => {
  const incompleteTask: Task = {
    id: 'task-test-1',
    title: 'Finalize quarterly report',
    notes: null,
    list_id: 'list_inbox',
    project_id: null,
    section_id: null,
    parent_task_id: null,
    due_date: null,
    due_time: null,
    all_day: 0,
    recurrence_rule: null,
    recurrence_basis: null,
    priority: 1,
    is_starred: 0,
    is_completed: 0,
    completed_at: null,
    estimated_minutes: null,
    assignee_device_id: null,
    created_by_device: 'local',
    sort_order: 100,
    my_day_date: null,
    pomodoro_count: 0,
    is_trashed: 0,
    trashed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const completedTask: Task = {
    ...incompleteTask,
    id: 'task-test-2',
    title: 'Completed test task',
    is_completed: 1,
    completed_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useUndoRedoStore.setState({
      undoStack: [],
      redoStack: [],
      lastToastAction: null,
    });
    useTaskStore.setState({
      tasksById: {
        'task-test-1': { ...incompleteTask },
        'task-test-2': { ...completedTask },
      },
      loading: false,
      error: null,
    });
  });

  it('triggers a completion notification with Undo support when completing an incomplete task via toggleComplete', async () => {
    const updated: Task = {
      ...incompleteTask,
      is_completed: 1,
      completed_at: new Date().toISOString(),
    };
    vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce(updated);

    await useTaskStore.getState().toggleComplete('task-test-1');

    const undoState = useUndoRedoStore.getState();
    expect(undoState.lastToastAction).not.toBeNull();
    expect(undoState.lastToastAction?.description).toBe('Completed: Finalize quarterly report');
    expect(undoState.undoStack.length).toBe(1);

    // Clicking Undo should execute undoFn and revert the task via toggleComplete
    vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce({
      ...updated,
      is_completed: 0,
      completed_at: null,
    });
    await undoState.lastToastAction?.undoFn();
    expect(taskServiceAdapter.toggleComplete).toHaveBeenCalledWith('task-test-1');
  });

  it('does NOT trigger a notification when uncompleting a task (is_completed 1 -> 0)', async () => {
    const updated: Task = {
      ...completedTask,
      is_completed: 0,
      completed_at: null,
    };
    vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce(updated);

    await useTaskStore.getState().toggleComplete('task-test-2');

    const undoState = useUndoRedoStore.getState();
    expect(undoState.lastToastAction).toBeNull();
    expect(undoState.undoStack.length).toBe(0);
  });

  it('truncates long task titles cleanly in completion notification', async () => {
    const longTitleTask: Task = {
      ...incompleteTask,
      id: 'task-long',
      title: 'Very long task title that exceeds standard display length boundary significantly',
    };
    useTaskStore.setState({
      tasksById: {
        'task-long': longTitleTask,
      },
    });

    const updated: Task = {
      ...longTitleTask,
      is_completed: 1,
      completed_at: new Date().toISOString(),
    };
    vi.mocked(taskServiceAdapter.toggleComplete).mockResolvedValueOnce(updated);

    await useTaskStore.getState().toggleComplete('task-long');

    const undoState = useUndoRedoStore.getState();
    expect(undoState.lastToastAction).not.toBeNull();
    expect(undoState.lastToastAction?.description).toBe('Completed: Very long task title that exceeds...');
  });
});
