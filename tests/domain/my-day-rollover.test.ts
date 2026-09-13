import { describe, it, expect } from 'vitest';
import type { Task } from '../../src/shared/types/task.js';

describe('Domain: My Day & Rollover Logic', () => {
  const today = '2026-09-13';
  const yesterday = '2026-09-12';

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Yesterday incomplete in My Day',
      notes: null,
      list_id: 'list_inbox',
      project_id: null,
      section_id: null,
      parent_task_id: null,
      due_date: null,
      due_time: null,
      all_day: 1,
      recurrence_rule: null,
      recurrence_basis: null,
      priority: 1,
      is_starred: 0,
      is_completed: 0,
      completed_at: null,
      estimated_minutes: null,
      pomodoro_count: 0,
      sort_order: 1,
      my_day_date: yesterday,
      is_trashed: 0,
      trashed_at: null,
      created_by_device: 'local',
      created_at: '2026-09-12T00:00:00.000Z',
      updated_at: '2026-09-12T00:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Yesterday completed in My Day',
      notes: null,
      list_id: 'list_inbox',
      project_id: null,
      section_id: null,
      parent_task_id: null,
      due_date: null,
      due_time: null,
      all_day: 1,
      recurrence_rule: null,
      recurrence_basis: null,
      priority: 1,
      is_starred: 0,
      is_completed: 1,
      completed_at: '2026-09-12T10:00:00.000Z',
      estimated_minutes: null,
      pomodoro_count: 0,
      sort_order: 2,
      my_day_date: yesterday,
      is_trashed: 0,
      trashed_at: null,
      created_by_device: 'local',
      created_at: '2026-09-12T00:00:00.000Z',
      updated_at: '2026-09-12T00:00:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Due today not in My Day',
      notes: null,
      list_id: 'list_inbox',
      project_id: null,
      section_id: null,
      parent_task_id: null,
      due_date: today,
      due_time: null,
      all_day: 1,
      recurrence_rule: null,
      recurrence_basis: null,
      priority: 0,
      is_starred: 0,
      is_completed: 0,
      completed_at: null,
      estimated_minutes: null,
      pomodoro_count: 0,
      sort_order: 3,
      my_day_date: null,
      is_trashed: 0,
      trashed_at: null,
      created_by_device: 'local',
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    },
    {
      id: 'task-4',
      title: 'High priority task not in My Day',
      notes: null,
      list_id: 'list_inbox',
      project_id: null,
      section_id: null,
      parent_task_id: null,
      due_date: '2026-09-20',
      due_time: null,
      all_day: 1,
      recurrence_rule: null,
      recurrence_basis: null,
      priority: 3,
      is_starred: 1,
      is_completed: 0,
      completed_at: null,
      estimated_minutes: null,
      pomodoro_count: 0,
      sort_order: 4,
      my_day_date: null,
      is_trashed: 0,
      trashed_at: null,
      created_by_device: 'local',
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    },
  ];

  it('should identify rollover tasks (uncompleted tasks with my_day_date < today)', () => {
    const rolloverTasks = mockTasks.filter(
      (t) =>
        t.is_trashed === 0 &&
        t.is_completed === 0 &&
        Boolean(t.my_day_date && t.my_day_date < today)
    );

    expect(rolloverTasks).toHaveLength(1);
    expect(rolloverTasks[0].id).toBe('task-1');
  });

  it('should surface recommendations for My Day (due today or high priority)', () => {
    const suggestions = mockTasks.filter((t) => {
      if (t.is_trashed === 1 || t.is_completed === 1) return false;
      if (t.my_day_date === today) return false;

      const isDueTodayOrOverdue = Boolean(t.due_date && t.due_date <= today);
      const isHighPriority = t.priority >= 2;
      return isDueTodayOrOverdue || isHighPriority;
    });

    expect(suggestions.map((s) => s.id)).toEqual(['task-3', 'task-4']);
  });
});
