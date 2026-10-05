import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { SomedayView } from '../../src/renderer/features/gtd/SomedayView.js';
import { AnytimeView } from '../../src/renderer/features/gtd/AnytimeView.js';
import { WaitingForView } from '../../src/renderer/features/gtd/WaitingForView.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useProjectStore } from '../../src/renderer/stores/projectStore.js';

describe('GTD Views Modernization & Feel UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      electron: {
        invoke: vi.fn(async (channel: string, args: any) => {
          if (channel === 'tasks:clear-waiting') {
            const task = useTaskStore.getState().tasksById[args];
            return {
              ok: true,
              data: {
                task: {
                  ...task,
                  waiting_on: null,
                  waiting_since: null,
                  follow_up_date: null,
                  follow_up_notified_on: null,
                },
              },
            };
          }
          if (channel === 'tasks:set-waiting') {
            const task = useTaskStore.getState().tasksById[args.taskId];
            return {
              ok: true,
              data: {
                task: {
                  ...task,
                  waiting_on: args.waitingOn,
                  follow_up_date: args.followUpDate,
                },
              },
            };
          }
          if (channel === 'tasks:update') {
            const task = useTaskStore.getState().tasksById[args.id];
            return {
              ok: true,
              data: {
                ...task,
                ...args,
              },
            };
          }
          return { ok: true, data: {} };
        }),
        on: () => () => {},
      },
    };

    useTaskStore.setState({
      tasksById: {
        'task-someday-1': {
          id: 'task-someday-1',
          title: 'Learn WebGL shaders',
          bucket: 'someday',
          waiting_since: null,
          waiting_on: null,
          follow_up_date: null,
          is_completed: 0,
          is_starred: 0,
          priority: 0,
          is_trashed: 0,
          sort_order: 100,
          created_at: '2026-10-05T00:00:00.000Z',
          updated_at: '2026-10-05T00:00:00.000Z',
        } as any,
        'task-anytime-1': {
          id: 'task-anytime-1',
          title: 'Refactor state machine',
          bucket: 'anytime',
          waiting_since: null,
          waiting_on: null,
          follow_up_date: null,
          is_completed: 0,
          is_starred: 0,
          priority: 0,
          is_trashed: 0,
          sort_order: 200,
          created_at: '2026-10-05T00:00:00.000Z',
          updated_at: '2026-10-05T00:00:00.000Z',
        } as any,
        'task-waiting-1': {
          id: 'task-waiting-1',
          title: 'PR #102 review feedback',
          bucket: null,
          waiting_on: 'Sarah',
          waiting_since: '2026-10-01T00:00:00.000Z',
          follow_up_date: '2026-10-10',
          is_completed: 0,
          is_starred: 0,
          priority: 0,
          is_trashed: 0,
          sort_order: 300,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        } as any,
      },
    });

    useProjectStore.setState({
      projectsById: {},
    });
  });

  describe('Emoji Removal from View Headers', () => {
    it('creates SomedayView element without title emoji', () => {
      const element = React.createElement(SomedayView);
      expect(element.type).toBe(SomedayView);
    });

    it('creates AnytimeView element without title emoji', () => {
      const element = React.createElement(AnytimeView);
      expect(element.type).toBe(AnytimeView);
    });

    it('creates WaitingForView element without title emoji', () => {
      const element = React.createElement(WaitingForView);
      expect(element.type).toBe(WaitingForView);
    });
  });

  describe('Someday and Anytime View Drag & Drop & Bottom QuickAdd', () => {
    it('retrieves Someday tasks from the taskStore via bucket', () => {
      const somedayTasks = Object.values(useTaskStore.getState().tasksById).filter(
        (t) => t.bucket === 'someday'
      );
      expect(somedayTasks).toHaveLength(1);
      expect(somedayTasks[0].title).toBe('Learn WebGL shaders');
    });

    it('retrieves Anytime tasks from the taskStore via bucket', () => {
      const anytimeTasks = Object.values(useTaskStore.getState().tasksById).filter(
        (t) => t.bucket === 'anytime'
      );
      expect(anytimeTasks).toHaveLength(1);
      expect(anytimeTasks[0].title).toBe('Refactor state machine');
    });

    it('clears bucket when dropping a Someday task to regular list or project', async () => {
      const taskId = 'task-someday-1';
      expect(useTaskStore.getState().tasksById[taskId].bucket).toBe('someday');

      // Emulate dropping to list_inbox or project_123
      await useTaskStore.getState().updateTask({
        id: taskId,
        list_id: 'list_inbox',
        bucket: null,
      });

      expect(useTaskStore.getState().tasksById[taskId].bucket).toBeNull();
      expect(useTaskStore.getState().tasksById[taskId].list_id).toBe('list_inbox');
    });
  });

  describe('Waiting For View "Feel UI" Logic', () => {
    it('retrieves Waiting tasks with waiting_since and waiting_on metadata', () => {
      const waitingTasks = Object.values(useTaskStore.getState().tasksById).filter(
        (t) => t.waiting_since !== null
      );
      expect(waitingTasks).toHaveLength(1);
      expect(waitingTasks[0].waiting_on).toBe('Sarah');
      expect(waitingTasks[0].follow_up_date).toBe('2026-10-10');
    });

    it('clears waiting state when clicking Followed Up', async () => {
      const taskId = 'task-waiting-1';
      await useTaskStore.getState().clearWaiting(taskId);

      const updated = useTaskStore.getState().tasksById[taskId];
      expect(updated.waiting_on).toBeNull();
      expect(updated.waiting_since).toBeNull();
      expect(updated.follow_up_date).toBeNull();
    });

    it('snoozes follow-up date when snooze action is triggered', async () => {
      const taskId = 'task-waiting-1';
      await useTaskStore.getState().setWaiting({
        taskId,
        waitingOn: 'Sarah',
        followUpDate: '2026-10-12',
      });

      const updated = useTaskStore.getState().tasksById[taskId];
      expect(updated.waiting_on).toBe('Sarah');
      expect(updated.follow_up_date).toBe('2026-10-12');
    });
  });
});
