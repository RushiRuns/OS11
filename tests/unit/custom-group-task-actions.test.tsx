import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Task, CustomGroup } from '@shared/types/index.js';

// Hoist mocks
const { mockIpc, mockPushAction } = vi.hoisted(() => ({
  mockIpc: {
    invoke: vi.fn(),
  },
  mockPushAction: vi.fn(),
}));

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: mockIpc,
}));

vi.mock('../../src/renderer/hooks/useUndoRedo.js', () => ({
  useUndoRedo: () => ({
    pushAction: mockPushAction,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
  useUndoRedoStore: {
    getState: () => ({
      pushAction: mockPushAction,
    }),
  },
}));

import { TaskContextMenu } from '../../src/renderer/features/tasks/TaskContextMenu.js';
import { BulkActionBar } from '../../src/renderer/features/tasks/BulkActionBar.js';
import { useCustomGroupStore } from '../../src/renderer/stores/customGroupStore.js';
import { useViewGroupStore } from '../../src/renderer/stores/viewGroupStore.js';
import { useSelectionStore } from '../../src/renderer/stores/selectionStore.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';

describe('Task Context Menu and Bulk Action Bar Custom Group Integration', () => {
  const dummyGroup: CustomGroup = {
    id: 'g-coding',
    name: 'Coding',
    sort_order: 1,
    last_used_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    sections: [
      {
        id: 'sec-bugs',
        group_id: 'g-coding',
        name: 'Bugs to be fixed',
        sort_order: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      },
      {
        id: 'sec-features',
        group_id: 'g-coding',
        name: 'Features to be implemented',
        sort_order: 2,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      },
    ],
  };

  const topLevelTask: Task = {
    id: 't-1',
    title: 'Top level task',
    project_id: 'proj-1',
    parent_task_id: null,
    is_completed: 0,
    is_starred: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    created_by_device: 'test',
    scheduled_start_min: null,
    scheduled_duration_min: null,
    all_day: 0,
    priority: 0,
    sort_order: 1000,
    pomodoro_count: 0,
  };

  const subtask: Task = {
    ...topLevelTask,
    id: 'sub-1',
    title: 'Subtask of t-1',
    parent_task_id: 't-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCustomGroupStore.setState({
      groups: [dummyGroup],
      activeProjectId: 'proj-1',
      activeGroupId: 'g-coding',
      overrides: [],
      taskValues: { 't-1': 'sec-bugs' },
      isLoading: false,
    });
    useViewGroupStore.setState({
      activeCustomGroupMap: { 'project:proj-1': 'g-coding' },
      hideEmptyMap: {},
      groupByMap: { 'project:proj-1': 'custom' },
    });
    useTaskStore.setState({
      tasksById: {
        't-1': topLevelTask,
        'sub-1': subtask,
      },
    });
    useSelectionStore.setState({
      selectedIds: new Set<string>(),
      isMultiSelectActive: false,
    });
  });

  describe('TaskContextMenu', () => {
    it('renders "Move to section..." item for a top-level task when project has active custom group', () => {
      const html = renderToStaticMarkup(
        <TaskContextMenu
          task={topLevelTask}
          position={{ x: 100, y: 100 }}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain('Move to section...');
    });

    it('does NOT render "Move to section..." item for subtasks (subtasks travel with parent)', () => {
      const html = renderToStaticMarkup(
        <TaskContextMenu
          task={subtask}
          position={{ x: 100, y: 100 }}
          onClose={vi.fn()}
        />
      );

      expect(html).not.toContain('Move to section...');
    });

    it('does NOT render "Move to section..." item when project has no active custom group', () => {
      useViewGroupStore.setState({
        activeCustomGroupMap: {},
      });

      const html = renderToStaticMarkup(
        <TaskContextMenu
          task={topLevelTask}
          position={{ x: 100, y: 100 }}
          onClose={vi.fn()}
        />
      );

      expect(html).not.toContain('Move to section...');
    });
  });

  describe('BulkActionBar', () => {
    it('renders "Section" bulk action button when all selected tasks belong to a project with active custom group', () => {
      useSelectionStore.setState({
        selectedIds: new Set(['t-1']),
        isMultiSelectActive: true,
      });

      const html = renderToStaticMarkup(<BulkActionBar />);

      expect(html).toContain('Section');
    });

    it('does NOT render "Section" bulk action button when selected tasks belong to project without active custom group', () => {
      useViewGroupStore.setState({
        activeCustomGroupMap: {},
      });
      useSelectionStore.setState({
        selectedIds: new Set(['t-1']),
        isMultiSelectActive: true,
      });

      const html = renderToStaticMarkup(<BulkActionBar />);

      expect(html).not.toContain('Section');
    });
  });
});
