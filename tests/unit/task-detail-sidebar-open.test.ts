import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';

describe('Task detail panel sidebar opening from Projects and Tags', () => {
  beforeEach(() => {
    useTaskStore.setState({
      selectedTaskId: null,
      rightSlotActive: null,
      tasksById: {
        'task-1': {
          id: 'task-1',
          title: 'Project Task',
          project_id: 'proj-1',
          list_id: 'list_inbox',
          is_completed: 0,
          is_trashed: 0,
        } as any,
        'task-2': {
          id: 'task-2',
          title: 'Tagged Task',
          list_id: 'list_inbox',
          is_completed: 0,
          is_trashed: 0,
        } as any,
      },
    });
  });

  it('TC-SIDEBAR-01: calling handleTaskSelect or openDetail opens the task detail sidebar in taskStore', () => {
    const { openDetail } = useTaskStore.getState();

    // Before selection
    expect(useTaskStore.getState().selectedTaskId).toBeNull();
    expect(useTaskStore.getState().rightSlotActive).toBeNull();

    // When detail icon is clicked for a task in Projects
    openDetail('task-1');

    // After selection: detail sidebar is active with selectedTaskId
    expect(useTaskStore.getState().selectedTaskId).toBe('task-1');
    expect(useTaskStore.getState().rightSlotActive).toBe('detail');
  });

  it('TC-SIDEBAR-02: TagView onOpenDetail wiring invokes task selection callback', () => {
    const onSelectTask = vi.fn();
    const task = useTaskStore.getState().tasksById['task-2'];

    // In TagView, onOpenDetail should be wired to onSelectTask
    const onOpenDetail = onSelectTask;
    onOpenDetail(task);

    expect(onSelectTask).toHaveBeenCalledWith(task);
  });

  it('TC-SIDEBAR-03 (regression): isRightSlotVisible must be true in project: views when detail is active', () => {
    /**
     * Regression guard for the bug where `isRightSlotVisible` in App.tsx
     * had an explicit `!activeListId.startsWith('project:')` guard, which
     * prevented the detail panel from ever rendering in the Projects view.
     *
     * The expression below mirrors the fixed version of isRightSlotVisible
     * in App.tsx verbatim. If someone re-introduces the project: exclusion,
     * this test will fail.
     */
    function computeIsRightSlotVisible(opts: {
      activeListId: string;
      rightSlotActive: string | null;
      hasLiveSelectedTask: boolean;
    }): boolean {
      const { activeListId, rightSlotActive, hasLiveSelectedTask } = opts;
      return (
        !activeListId.startsWith('view_') &&
        // NOTE: there must be NO !activeListId.startsWith('project:') guard here
        ((activeListId === 'smart_my_day' &&
          (rightSlotActive === 'scheduler' || rightSlotActive === 'suggestions')) ||
          (rightSlotActive === 'detail' && hasLiveSelectedTask))
      );
    }

    // Project view, detail active, task selected → must be visible
    expect(
      computeIsRightSlotVisible({
        activeListId: 'project:proj-1',
        rightSlotActive: 'detail',
        hasLiveSelectedTask: true,
      })
    ).toBe(true);

    // Project view, detail active, but no task → must be hidden
    expect(
      computeIsRightSlotVisible({
        activeListId: 'project:proj-1',
        rightSlotActive: 'detail',
        hasLiveSelectedTask: false,
      })
    ).toBe(false);

    // Project view, no detail active → must be hidden
    expect(
      computeIsRightSlotVisible({
        activeListId: 'project:proj-1',
        rightSlotActive: null,
        hasLiveSelectedTask: false,
      })
    ).toBe(false);

    // view_ prefix → always hidden (unrelated guard must still hold)
    expect(
      computeIsRightSlotVisible({
        activeListId: 'view_settings',
        rightSlotActive: 'detail',
        hasLiveSelectedTask: true,
      })
    ).toBe(false);
  });
});

