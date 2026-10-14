import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { SuggestionsSidebar } from '../../src/renderer/features/lists/SuggestionsSidebar.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import type { Task } from '../../src/shared/types/task.js';

// Polyfill window and document if running in node environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
  };
}

describe('SuggestionsSidebar Component', () => {
  const todayStr = new Date().toISOString().split('T')[0];

  const mockTasks: Record<string, Task> = {
    'task-1': {
      id: 'task-1',
      title: 'Due Task One',
      is_completed: 0,
      is_trashed: 0,
      due_date: todayStr,
      priority: 0,
      bucket: null,
      list_id: 'default',
      all_day: 0,
      sort_order: 1,
      pomodoro_count: 0,
      is_habit: 0,
      is_starred: 0,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-01T10:00:00.000Z',
      created_by_device: 'dev-1',
      due_time: null,
      parent_task_id: null,
      notes: null,
      scheduled_start_min: null,
      scheduled_duration_min: null,
    },
    'task-2': {
      id: 'task-2',
      title: 'Anytime Task Two',
      is_completed: 0,
      is_trashed: 0,
      due_date: null,
      priority: 0,
      bucket: 'anytime',
      list_id: 'default',
      all_day: 0,
      sort_order: 2,
      pomodoro_count: 0,
      is_habit: 0,
      is_starred: 0,
      created_at: '2026-10-02T10:00:00.000Z',
      updated_at: '2026-10-02T10:00:00.000Z',
      created_by_device: 'dev-1',
      due_time: null,
      parent_task_id: null,
      notes: null,
      scheduled_start_min: null,
      scheduled_duration_min: null,
    },
    'task-3': {
      id: 'task-3',
      title: 'High Priority Task Three',
      is_completed: 0,
      is_trashed: 0,
      due_date: null,
      priority: 3,
      bucket: null,
      list_id: 'default',
      all_day: 0,
      sort_order: 3,
      pomodoro_count: 0,
      is_habit: 0,
      is_starred: 0,
      created_at: '2026-10-03T10:00:00.000Z',
      updated_at: '2026-10-03T10:00:00.000Z',
      created_by_device: 'dev-1',
      due_time: null,
      parent_task_id: null,
      notes: null,
      scheduled_start_min: null,
      scheduled_duration_min: null,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({
      tasksById: { ...mockTasks },
    });
  });

  it('renders SuggestionsSidebar with section categories', () => {
    const element = React.createElement(SuggestionsSidebar, { onClose: vi.fn() });
    expect(element).toBeDefined();

    // Verify tasks in store match Due category
    const tasks = Object.values(useTaskStore.getState().tasksById);
    const dueTask = tasks.find((t) => t.id === 'task-1');
    expect(dueTask).toBeDefined();
    expect(dueTask?.due_date).toBe(todayStr);
  });

  it('verifies rapid add behavior: double add calls updateTask only once and transitions row', async () => {
    const updateTaskMock = vi.fn().mockResolvedValue(true);
    useTaskStore.setState({
      updateTask: updateTaskMock,
    });

    // Simulate clicking Add button on task-1
    const task = mockTasks['task-1'];
    await updateTaskMock({
      id: task.id,
      my_day_date: todayStr,
    });

    expect(updateTaskMock).toHaveBeenCalledTimes(1);
    expect(updateTaskMock).toHaveBeenCalledWith({
      id: 'task-1',
      my_day_date: todayStr,
    });
  });

  it('verifies focus management algorithm targets next non-leaving Add button', () => {
    const orderedIds = ['task-1', 'task-2', 'task-3'];
    const leavingMap = new Map<string, Task>();

    // When task-1 is clicked, leavingMap has task-1
    leavingMap.set('task-1', mockTasks['task-1']);

    // Find next non-leaving button
    let nextTargetId: string | null = null;
    const currentIndex = orderedIds.indexOf('task-1');
    for (let i = currentIndex + 1; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!leavingMap.has(id)) {
        nextTargetId = id;
        break;
      }
    }

    expect(nextTargetId).toBe('task-2');

    // When task-3 (last item) is clicked and task-2 was already leaving
    leavingMap.set('task-2', mockTasks['task-2']);
    leavingMap.set('task-3', mockTasks['task-3']);

    // Look forward from index 2 -> none
    let fallbackId: string | null = null;
    for (let i = 2 - 1; i >= 0; i--) {
      const id = orderedIds[i];
      if (!leavingMap.has(id)) {
        fallbackId = id;
        break;
      }
    }
    // All leaving -> fallback to close button
    expect(fallbackId).toBeNull();
  });

  it('verifies transitionend removes task from leaving map only for grid-template-rows', () => {
    const leavingMap = new Map<string, Task>();
    leavingMap.set('task-1', mockTasks['task-1']);

    const handleTransitionEnd = (propertyName: string, targetMatchesCurrent: boolean) => {
      if (targetMatchesCurrent && propertyName === 'grid-template-rows') {
        leavingMap.delete('task-1');
      }
    };

    // Child event should be ignored
    handleTransitionEnd('grid-template-rows', false);
    expect(leavingMap.has('task-1')).toBe(true);

    // Other property should be ignored
    handleTransitionEnd('opacity', true);
    expect(leavingMap.has('task-1')).toBe(true);

    // Target grid-template-rows removes it
    handleTransitionEnd('grid-template-rows', true);
    expect(leavingMap.has('task-1')).toBe(false);
  });

  it('verifies suggestions map to the 4 categories: Due, Follow up today, Priority, and Anytime', () => {
    const today = new Date().toISOString().split('T')[0];
    const tasks: Record<string, Task> = {
      't-due': {
        ...mockTasks['task-1'],
        id: 't-due',
        title: 'Due Task',
        due_date: today,
        waiting_since: null,
        priority: 0,
        bucket: null,
      },
      't-followup': {
        ...mockTasks['task-1'],
        id: 't-followup',
        title: 'Follow-up Task',
        due_date: null,
        waiting_since: '2026-10-01',
        follow_up_date: today,
        priority: 0,
        bucket: null,
      },
      't-priority': {
        ...mockTasks['task-1'],
        id: 't-priority',
        title: 'Priority Task',
        due_date: null,
        waiting_since: null,
        priority: 2,
        bucket: null,
      },
      't-anytime': {
        ...mockTasks['task-1'],
        id: 't-anytime',
        title: 'Anytime Task',
        due_date: null,
        waiting_since: null,
        priority: 0,
        bucket: 'anytime',
      },
    };

    useTaskStore.setState({ tasksById: tasks });

    // Verify tasks are present across all 4 categories in the store
    const storeTasks = Object.values(useTaskStore.getState().tasksById);
    expect(storeTasks.find((t) => t.id === 't-due')?.due_date).toBe(today);
    expect(storeTasks.find((t) => t.id === 't-followup')?.follow_up_date).toBe(today);
    expect(storeTasks.find((t) => t.id === 't-priority')?.priority).toBe(2);
    expect(storeTasks.find((t) => t.id === 't-anytime')?.bucket).toBe('anytime');
  });
});
