import { describe, it, expect } from 'vitest';
import type { Task, CreateTaskPayload } from '../../src/shared/types/task.js';

describe('New Task Top-Placement Behavior', () => {
  // Helper simulating taskStore.createTask's sort_order computation
  function computeNewTaskSortOrder(
    payload: CreateTaskPayload,
    currentTasks: Task[]
  ): number {
    let matchingTasks: Task[] = [];
    if (payload.parent_task_id) {
      matchingTasks = currentTasks.filter(
        (t) => t.parent_task_id === payload.parent_task_id && t.is_trashed === 0
      );
    } else if (payload.project_id) {
      matchingTasks = currentTasks.filter(
        (t) =>
          t.project_id === payload.project_id &&
          t.is_trashed === 0 &&
          !t.parent_task_id &&
          (payload.section_id ? t.section_id === payload.section_id : true)
      );
    } else if (payload.list_id) {
      matchingTasks = currentTasks.filter(
        (t) => t.list_id === payload.list_id && t.is_trashed === 0 && !t.parent_task_id
      );
    } else {
      matchingTasks = currentTasks.filter((t) => t.is_trashed === 0 && !t.parent_task_id);
    }

    let minSortOrder = Infinity;
    for (const t of matchingTasks) {
      if (typeof t.sort_order === 'number' && t.sort_order < minSortOrder) {
        minSortOrder = t.sort_order;
      }
    }
    return minSortOrder !== Infinity ? minSortOrder - 1000 : 1000;
  }

  it('TC-TOP-01: new task receives sort_order lower than existing tasks in the container and appears at the top', () => {
    const existingTasks: Task[] = [
      {
        id: 't1',
        title: 'Task 1',
        list_id: 'list_inbox',
        sort_order: 1000,
        is_trashed: 0,
        is_completed: 0,
      } as Task,
      {
        id: 't2',
        title: 'Task 2',
        list_id: 'list_inbox',
        sort_order: 2000,
        is_trashed: 0,
        is_completed: 0,
      } as Task,
    ];

    const newSortOrder = computeNewTaskSortOrder({ title: 'New Top Task', list_id: 'list_inbox' }, existingTasks);
    expect(newSortOrder).toBe(0); // 1000 - 1000 = 0

    const sortedList = [
      ...existingTasks,
      { id: 't3', title: 'New Top Task', list_id: 'list_inbox', sort_order: newSortOrder } as Task,
    ].sort((a, b) => a.sort_order - b.sort_order);

    expect(sortedList[0].id).toBe('t3');
    expect(sortedList[0].title).toBe('New Top Task');
  });

  it('TC-TOP-02: first task created in an empty container receives default baseline sort_order', () => {
    const newSortOrder = computeNewTaskSortOrder({ title: 'First Task', list_id: 'project-empty' }, []);
    expect(newSortOrder).toBe(1000);
  });

  it('TC-TOP-03: multiple consecutive task creations preserve newest-on-top stack order', () => {
    let tasks: Task[] = [];

    const addTask = (id: string, title: string) => {
      const sort_order = computeNewTaskSortOrder({ title, list_id: 'list_inbox' }, tasks);
      const newTask = { id, title, list_id: 'list_inbox', sort_order, is_trashed: 0 } as Task;
      tasks = [...tasks, newTask].sort((a, b) => a.sort_order - b.sort_order);
    };

    addTask('t1', 'First');
    addTask('t2', 'Second');
    addTask('t3', 'Third');

    expect(tasks.map((t) => t.id)).toEqual(['t3', 't2', 't1']);
  });

  it('TC-TOP-04: subtask created under a parent task appears at the top of the subtask list', () => {
    const parentId = 'parent-1';
    const existingSubtasks: Task[] = [
      {
        id: 'sub-1',
        title: 'Existing Subtask 1',
        parent_task_id: parentId,
        sort_order: 1000,
        is_trashed: 0,
        is_completed: 0,
      } as Task,
      {
        id: 'sub-2',
        title: 'Existing Subtask 2',
        parent_task_id: parentId,
        sort_order: 2000,
        is_trashed: 0,
        is_completed: 0,
      } as Task,
    ];

    const newSubtaskSortOrder = computeNewTaskSortOrder(
      { title: 'New Subtask', parent_task_id: parentId },
      existingSubtasks
    );
    expect(newSubtaskSortOrder).toBeLessThan(1000);

    const sortedSubtasks = [
      ...existingSubtasks,
      { id: 'sub-3', title: 'New Subtask', parent_task_id: parentId, sort_order: newSubtaskSortOrder } as Task,
    ].sort((a, b) => a.sort_order - b.sort_order);

    expect(sortedSubtasks[0].id).toBe('sub-3');
    expect(sortedSubtasks[0].title).toBe('New Subtask');
  });

  it('TC-TOP-05: newly completed task appears at the top of completed section (completed_at DESC)', () => {
    const completedTasks: Task[] = [
      {
        id: 'c1',
        title: 'Completed earlier',
        is_completed: 1,
        completed_at: '2026-10-12T10:00:00.000Z',
      } as Task,
      {
        id: 'c2',
        title: 'Completed just now',
        is_completed: 1,
        completed_at: '2026-10-12T10:05:00.000Z',
      } as Task,
    ];

    const sorted = [...completedTasks].sort(
      (a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')
    );

    expect(sorted[0].id).toBe('c2');
    expect(sorted[1].id).toBe('c1');
  });
});
