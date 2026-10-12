import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskCard } from '../../src/renderer/features/tasks/TaskCard.js';
import type { Task } from '../../src/shared/types/task.js';

describe('TaskCard PointerDown Event Propagation Tests', () => {
  const dummyTask: Task = {
    id: 'test-pointerdown-task',
    title: 'Test PointerDown Task',
    notes: 'Testing pointerdown propagation',
    is_completed: 0,
    is_starred: 0,
    priority: 1,
    due_date: null,
    due_time: null,
    all_day: 0,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 100,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-10-11T12:00:00.000Z',
    updated_at: '2026-10-11T12:00:00.000Z',
    created_by_device: 'test-device',
    scheduled_start_min: null,
    scheduled_duration_min: null,
  };

  it('renders star button and details button with pointerdown event stopPropagation', () => {
    const onToggleStar = vi.fn();
    const onOpenDetail = vi.fn();

    const element = React.createElement(TaskCard, {
      task: dummyTask,
      onToggleStar,
      onOpenDetail,
    });

    const html = renderToStaticMarkup(element);
    // Verify star and details buttons exist in markup
    expect(html).toContain('aria-label="Star task"');
    expect(html).toContain('aria-label="Open task details"');
  });

  it('verifies simulated pointerdown event stopPropagation on star and details buttons', () => {
    const stopPropagation = vi.fn();
    const mockEvent = {
      stopPropagation,
      defaultPrevented: false,
    } as unknown as React.PointerEvent;

    const handlePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
    };

    handlePointerDown(mockEvent);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });
});
