import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isExternalDropTarget } from '../../src/renderer/features/tasks/TaskList.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import type { Task } from '../../src/shared/types/task.js';

describe('Regression Test: Task Drag & Drop to Areas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).window = {
      electron: {
        invoke: vi.fn(async () => ({ ok: true, data: [] })),
        on: () => () => {},
      },
    };
    useTaskStore.setState({
      tasksById: {},
    });
  });

  describe('isExternalDropTarget', () => {
    it('recognizes area droppable targets as external drop targets', () => {
      // Regression check: previously area droppables were omitted from external drop targets,
      // causing dnd-kit drop handlers to treat them as internal reordering targets within the list.
      expect(isExternalDropTarget('area:area_work')).toBe(true);
      expect(isExternalDropTarget('area:area_personal')).toBe(true);
    });

    it('continues to recognize lists, projects, tags, and scheduler targets', () => {
      expect(isExternalDropTarget('list:list_inbox')).toBe(true);
      expect(isExternalDropTarget('list:smart_my_day')).toBe(true);
      expect(isExternalDropTarget('project:proj_client')).toBe(true);
      expect(isExternalDropTarget('tag:tag_urgent')).toBe(true);
      expect(isExternalDropTarget('scheduler-grid')).toBe(true);
      expect(isExternalDropTarget('my-day-list-drop-zone')).toBe(true);
    });

    it('does not treat internal task rows as external targets', () => {
      expect(isExternalDropTarget('task-123')).toBe(false);
      expect(isExternalDropTarget('task-abc-xyz')).toBe(false);
    });
  });

  describe('Dropping task onto Area clears list_id and assigns area_id', () => {
    it('clears list_id when an inbox task is dropped onto an area', async () => {
      const inboxTask: Task = {
        id: 'task-inbox-1',
        title: 'Draft proposal',
        list_id: 'list_inbox',
        area_id: null,
        project_id: null,
        all_day: 1,
        priority: 0,
        is_starred: 0,
        is_completed: 0,
        pomodoro_count: 0,
        is_trashed: 0,
        created_by_device: 'local',
        sort_order: 1000,
        created_at: '2026-10-05T00:00:00.000Z',
        updated_at: '2026-10-05T00:00:00.000Z',
      };

      useTaskStore.setState({
        tasksById: { [inboxTask.id]: inboxTask },
      });

      // Target area ID from drop target: area:area_work
      const overIdStr = 'area:area_work';
      const targetAreaId = overIdStr.slice(5);

      // Execute update matching the drop handler
      await useTaskStore.getState().updateTask({
        id: inboxTask.id,
        area_id: targetAreaId,
        project_id: null,
        list_id: null,
      });

      const updated = useTaskStore.getState().tasksById[inboxTask.id];
      expect(updated.area_id).toBe('area_work');
      expect(updated.project_id).toBeNull();
      expect(updated.list_id).toBeNull();
    });
  });
});
