import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskRowDragOverlay } from '../../src/renderer/features/tasks/TaskRowDragOverlay.js';
import type { Task } from '../../src/shared/types/task.js';

describe('TaskRowDragOverlay Component', () => {
  const mockTask: Task = {
    id: 'task-test-1',
    title: 'Design Time Blocking Grid',
    notes: 'Important notes',
    is_completed: 0,
    is_starred: 1,
    priority: 3,
    due_date: '2026-10-03',
    due_time: '14:00',
    all_day: 0,
    list_id: 'smart_my_day',
    parent_task_id: null,
    sort_order: 100,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-10-03T10:00:00.000Z',
    updated_at: '2026-10-03T10:00:00.000Z',
    created_by_device: 'test-device',
    scheduled_start_min: 600,
    scheduled_duration_min: 45,
  };

  it('renders task title and scheduled duration chip with redesigned overlay styling', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskRowDragOverlay, {
        task: mockTask,
        subtaskCount: { completed: 1, total: 3 },
      })
    );

    expect(html).toContain('Design Time Blocking Grid');
    expect(html).toContain('1/3');
    expect(html).toContain('45m');
    expect(html).toContain('var(--surface-overlay');
    expect(html).toContain('var(--shadow-md');
    expect(html).toContain('var(--border-default');
    expect(html).toContain('scale(1.02)');
  });

  it('renders cleanly without subtask count when no subtasks exist', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskRowDragOverlay, {
        task: { ...mockTask, scheduled_start_min: null, scheduled_duration_min: null },
      })
    );

    expect(html).toContain('Design Time Blocking Grid');
    expect(html).not.toContain('/3');
    expect(html).toContain('var(--surface-overlay');
  });
});
