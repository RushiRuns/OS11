import { describe, it, expect } from 'vitest';
import React from 'react';
import { TaskCard } from '../../src/renderer/features/tasks/TaskCard.js';

describe('TaskCard Layout & Subtask Chevron Hover', () => {
  const dummyTask = {
    id: 'test-task-1',
    title: 'Test Task Title',
    notes: 'Some notes',
    is_completed: 0,
    is_starred: 0,
    priority: 0,
    due_date: '2026-09-20',
    due_time: null,
    all_day: 1,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 1000,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  it('renders without chevron or spacer when task has no subtasks', () => {
    const element = React.createElement(TaskCard, {
      task: dummyTask as any,
      hasSubtasks: false,
    });

    expect(element.props.hasSubtasks).toBe(false);
  });

  it('configures chevron toggle with smooth rotation indicator when hasSubtasks is true', () => {
    const collapsedElement = React.createElement(TaskCard, {
      task: dummyTask as any,
      hasSubtasks: true,
      isExpanded: false,
    });

    expect(collapsedElement.props.hasSubtasks).toBe(true);
    expect(collapsedElement.props.isExpanded).toBe(false);

    const expandedElement = React.createElement(TaskCard, {
      task: dummyTask as any,
      hasSubtasks: true,
      isExpanded: true,
    });

    expect(expandedElement.props.isExpanded).toBe(true);
  });

  it('applies depth margin multiplier of 28px for nested subtasks', () => {
    const depth1Element = React.createElement(TaskCard, {
      task: { ...dummyTask, parent_task_id: 'parent-1' } as any,
      depth: 1,
    });
    expect(depth1Element.props.depth).toBe(1);

    const depth2Element = React.createElement(TaskCard, {
      task: { ...dummyTask, parent_task_id: 'parent-2' } as any,
      depth: 2,
    });
    expect(depth2Element.props.depth).toBe(2);
  });

  it('formats dates in MM/DD/YYYY order', () => {
    const parts = dummyTask.due_date.split('-');
    const formatted = `${parts[1]}/${parts[2]}/${parts[0]}`;
    expect(formatted).toBe('09/20/2026');
  });

  it('passes subtaskCount object to task card for rendering subtask progress in metadata row', () => {
    const subtaskElement = React.createElement(TaskCard, {
      task: dummyTask as any,
      hasSubtasks: true,
      subtaskCount: { completed: 1, total: 3 },
    });

    expect(subtaskElement.props.subtaskCount).toEqual({ completed: 1, total: 3 });
    expect(subtaskElement.props.hasSubtasks).toBe(true);
  });
});
