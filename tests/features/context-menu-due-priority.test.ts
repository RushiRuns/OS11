import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { getTaskPlannedGroupKey } from '../../src/renderer/hooks/usePlannedGroups.js';
import type { Task } from '../../src/shared/types/task.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn().mockResolvedValue({ ok: true, data: true }),
  ipc: {
    invoke: vi.fn().mockResolvedValue({ ok: true, data: true }),
    on: vi.fn().mockReturnValue(() => {}),
  },
}));

describe('TaskContextMenu due date and priority wiring regression tests', () => {
  const viewsToVerify = [
    { name: 'AreaView', relPath: 'src/renderer/features/areas/AreaView.tsx' },
    { name: 'AnytimeView', relPath: 'src/renderer/features/gtd/AnytimeView.tsx' },
    { name: 'SomedayView', relPath: 'src/renderer/features/gtd/SomedayView.tsx' },
    { name: 'PlannedTimeline', relPath: 'src/renderer/features/lists/PlannedTimeline.tsx' },
  ];

  describe('Component wiring contract: all views must wire onSetDueDate and onSetPriority to TaskContextMenu', () => {
    viewsToVerify.forEach(({ name, relPath }) => {
      it(`${name} passes onSetDueDate and onSetPriority to TaskContextMenu`, () => {
        const filePath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract the TaskContextMenu component JSX element
        const contextMenuMatch = content.match(/<TaskContextMenu\s[\s\S]*?\/>/);
        expect(contextMenuMatch, `${name} should render <TaskContextMenu ... />`).not.toBeNull();

        const contextMenuJsx = contextMenuMatch![0];
        expect(contextMenuJsx).toContain('onSetDueDate=');
        expect(contextMenuJsx).toContain('onSetPriority=');
      });
    });
  });

  describe('Store & Planned View Integration', () => {
    it('setting due date on a task via onSetDueDate handler makes it appear in Planned view grouping', async () => {
      // Mock task in Anytime bucket without due date
      const taskId = 'task-anytime-test-1';
      const initialTask: Task = {
        id: taskId,
        title: 'Task from anytime view',
        is_completed: 0,
        is_starred: 0,
        is_trashed: 0,
        priority: 0,
        bucket: 'anytime',
        due_date: null,
        due_time: null,
        all_day: 0,
        created_by_device: 'test',
        pomodoro_count: 0,
        created_at: '2026-10-13T10:00:00Z',
        updated_at: '2026-10-13T10:00:00Z',
        sort_order: 1,
      };

      useTaskStore.setState({
        tasksById: { [taskId]: initialTask },
      });

      // Before due date is set: not in planned grouping
      const beforeGroup = getTaskPlannedGroupKey(useTaskStore.getState().tasksById[taskId], '2026-10-13');
      expect(beforeGroup).toBeNull();

      // The onSetDueDate handler passed to TaskContextMenu
      const onSetDueDate = async (id: string, date: string | null, time: string | null, allDay: boolean) => {
        await useTaskStore.getState().updateTask({
          id,
          due_date: date,
          due_time: time,
          all_day: allDay ? 1 : 0,
        });
      };

      // User sets due date to 14 Oct via context menu
      await onSetDueDate(taskId, '2026-10-14', null, true);

      const updatedTask = useTaskStore.getState().tasksById[taskId];
      expect(updatedTask.due_date).toBe('2026-10-14');
      expect(updatedTask.all_day).toBe(1);

      // Now this task is placed in Planned view grouping (tomorrow for 2026-10-13 reference)
      const afterGroup = getTaskPlannedGroupKey(updatedTask, '2026-10-13');
      expect(afterGroup).toBe('tomorrow');
    });

    it('setting priority on a task via onSetPriority handler updates task priority in store', async () => {
      const taskId = 'task-priority-test-1';
      const initialTask: Task = {
        id: taskId,
        title: 'Task priority test',
        is_completed: 0,
        is_starred: 0,
        is_trashed: 0,
        priority: 0,
        all_day: 0,
        created_by_device: 'test',
        pomodoro_count: 0,
        created_at: '2026-10-13T10:00:00Z',
        updated_at: '2026-10-13T10:00:00Z',
        sort_order: 1,
      };

      useTaskStore.setState({
        tasksById: { [taskId]: initialTask },
      });

      const onSetPriority = async (id: string, priority: number) => {
        await useTaskStore.getState().updateTask({ id, priority });
      };

      await onSetPriority(taskId, 3);

      expect(useTaskStore.getState().tasksById[taskId].priority).toBe(3);
    });
  });
});
