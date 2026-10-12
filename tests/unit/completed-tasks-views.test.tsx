import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { selectCompletedTasks } from '../../src/renderer/stores/taskStore.js';
import { CompletionLingerTracker } from '../../src/renderer/hooks/useCompletionLinger.js';
import { TaskCard } from '../../src/renderer/features/tasks/TaskCard.js';
import type { Task } from '../../src/shared/types/task.js';

describe('Completed Tasks & Real-time View Transitions', () => {
  const today = new Date().toISOString().split('T')[0];

  const mockTasksById: Record<string, Task> = {
    'task-my-day': {
      id: 'task-my-day',
      title: 'My Day Task',
      is_completed: 1,
      is_trashed: 0,
      my_day_date: today,
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 1,
    } as Task,
    'task-important': {
      id: 'task-important',
      title: 'Important Task',
      is_completed: 1,
      is_trashed: 0,
      is_starred: 1,
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 2,
    } as Task,
    'task-planned': {
      id: 'task-planned',
      title: 'Planned Task',
      is_completed: 1,
      is_trashed: 0,
      due_date: '2026-10-15',
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 3,
    } as Task,
    'task-anytime': {
      id: 'task-anytime',
      title: 'Anytime Task',
      is_completed: 1,
      is_trashed: 0,
      bucket: 'anytime',
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 4,
    } as Task,
    'task-someday': {
      id: 'task-someday',
      title: 'Someday Task',
      is_completed: 1,
      is_trashed: 0,
      bucket: 'someday',
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 5,
    } as Task,
    'task-waiting': {
      id: 'task-waiting',
      title: 'Waiting Task',
      is_completed: 1,
      is_trashed: 0,
      waiting_since: '2026-10-10',
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 6,
    } as Task,
    'task-project': {
      id: 'task-project',
      title: 'Project Task',
      is_completed: 1,
      is_trashed: 0,
      project_id: 'proj-1',
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 7,
    } as Task,
    'task-area': {
      id: 'task-area',
      title: 'Area Task',
      is_completed: 1,
      is_trashed: 0,
      area_id: 'area-1',
      project_id: null,
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 8,
    } as Task,
    'task-inbox': {
      id: 'task-inbox',
      title: 'Inbox Task',
      is_completed: 1,
      is_trashed: 0,
      area_id: null,
      project_id: null,
      completed_at: '2026-10-12T10:00:00Z',
      sort_order: 9,
    } as Task,
    'task-incomplete': {
      id: 'task-incomplete',
      title: 'Incomplete Task',
      is_completed: 0,
      is_trashed: 0,
      my_day_date: today,
      sort_order: 10,
    } as Task,
  };

  const mockState = { tasksById: mockTasksById };

  describe('selectCompletedTasks across Smart Views & Containers', () => {
    it('returns completed tasks for smart_my_day', () => {
      const result = selectCompletedTasks(mockState, 'smart_my_day');
      expect(result.map((t) => t.id)).toContain('task-my-day');
      expect(result.map((t) => t.id)).not.toContain('task-incomplete');
    });

    it('returns completed tasks for smart_important', () => {
      const result = selectCompletedTasks(mockState, 'smart_important');
      expect(result.map((t) => t.id)).toContain('task-important');
    });

    it('returns completed tasks for smart_planned', () => {
      const result = selectCompletedTasks(mockState, 'smart_planned');
      expect(result.map((t) => t.id)).toContain('task-planned');
    });

    it('returns completed tasks for smart_anytime', () => {
      const result = selectCompletedTasks(mockState, 'smart_anytime');
      expect(result.map((t) => t.id)).toContain('task-anytime');
    });

    it('returns completed tasks for smart_someday', () => {
      const result = selectCompletedTasks(mockState, 'smart_someday');
      expect(result.map((t) => t.id)).toContain('task-someday');
    });

    it('returns completed tasks for smart_waiting_for', () => {
      const result = selectCompletedTasks(mockState, 'smart_waiting_for');
      expect(result.map((t) => t.id)).toContain('task-waiting');
    });

    it('returns completed tasks for list_inbox', () => {
      const result = selectCompletedTasks(mockState, 'list_inbox');
      expect(result.map((t) => t.id)).toContain('task-inbox');
    });

    it('returns completed tasks for project container (project:proj-1)', () => {
      const result = selectCompletedTasks(mockState, 'project:proj-1');
      expect(result.map((t) => t.id)).toContain('task-project');
    });

    it('returns completed tasks for area container (area:area-1)', () => {
      const result = selectCompletedTasks(mockState, 'area:area-1');
      expect(result.map((t) => t.id)).toContain('task-area');
    });

    it('returns all completed tasks for smart_all', () => {
      const result = selectCompletedTasks(mockState, 'smart_all');
      expect(result.length).toBe(9);
    });
  });

  describe('CompletionLingerTracker Motion & Real-time Timeline', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('tracks 0ms linger -> 420ms exiting -> 720ms departure with onChange callbacks', () => {
      let changeCount = 0;
      const tracker = new CompletionLingerTracker({
        prefersReducedMotion: false,
        onChange: () => {
          changeCount++;
        },
      });

      // 0ms: markCompleted
      tracker.markCompleted('t1');
      expect(tracker.isLingering('t1')).toBe(true);
      expect(tracker.isExiting('t1')).toBe(false);
      expect(changeCount).toBe(1);

      // 420ms: exiting transition
      vi.advanceTimersByTime(420);
      expect(tracker.isLingering('t1')).toBe(true);
      expect(tracker.isExiting('t1')).toBe(true);
      expect(changeCount).toBe(2);

      // 720ms: departure
      vi.advanceTimersByTime(300);
      expect(tracker.isLingering('t1')).toBe(false);
      expect(tracker.isExiting('t1')).toBe(false);
      expect(changeCount).toBe(3);

      tracker.destroy();
    });
  });

  describe('TaskCard Checkbox Layout', () => {
    it('renders checkbox button without duplicate wrapper onClick', () => {
      const dummyTask: Task = {
        id: 't-card',
        title: 'Click test task',
        is_completed: 0,
        is_trashed: 0,
        all_day: 0,
        priority: 0,
        is_starred: 0,
        sort_order: 1,
        created_by_device: 'test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const html = renderToStaticMarkup(
        <TaskCard
          task={dummyTask}
          onToggleComplete={() => {}}
        />
      );

      // Checkbox button is present
      expect(html).toContain('role="checkbox"');
      // aria-label is present
      expect(html).toContain('Mark &quot;Click test task&quot; as complete');
    });
  });
});
