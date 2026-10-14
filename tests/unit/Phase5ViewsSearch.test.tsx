import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlannedView } from '../../src/renderer/features/lists/PlannedView.js';
import { AnytimeView } from '../../src/renderer/features/gtd/AnytimeView.js';
import { SomedayView } from '../../src/renderer/features/gtd/SomedayView.js';
import { WaitingForView } from '../../src/renderer/features/gtd/WaitingForView.js';
import type { Task } from '../../src/shared/types/task.js';

vi.mock('../../src/renderer/stores/taskStore.js', () => ({
  useTaskStore: () => ({
    loadTasks: vi.fn(),
    tasksById: {},
    loading: false,
    toggleComplete: vi.fn(),
    toggleStar: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    duplicateTask: vi.fn(),
    restoreTask: vi.fn(),
    clearWaiting: vi.fn(),
    setWaiting: vi.fn(),
  }),
  usePlanned: () => [
    {
      id: 'task-p1',
      title: 'Planned Task One',
      is_completed: 0,
      is_starred: 0,
      is_habit: 0,
      is_trashed: 0,
      due_date: '2026-10-15',
      parent_task_id: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      created_by_device: 'test',
      scheduled_start_min: null,
      scheduled_duration_min: null,
      all_day: 0,
      priority: 0,
      sort_order: 1000,
      pomodoro_count: 0,
    },
  ],
  useAnytimeTasks: () => [
    {
      id: 'task-a1',
      title: 'Anytime Task One',
      is_completed: 0,
      is_starred: 0,
      is_habit: 0,
      is_trashed: 0,
      parent_task_id: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      created_by_device: 'test',
      scheduled_start_min: null,
      scheduled_duration_min: null,
      all_day: 0,
      priority: 0,
      sort_order: 1000,
      pomodoro_count: 0,
    },
  ],
  useSomedayTasks: () => [
    {
      id: 'task-s1',
      title: 'Someday Task One',
      is_completed: 0,
      is_starred: 0,
      is_habit: 0,
      is_trashed: 0,
      parent_task_id: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      created_by_device: 'test',
      scheduled_start_min: null,
      scheduled_duration_min: null,
      all_day: 0,
      priority: 0,
      sort_order: 1000,
      pomodoro_count: 0,
    },
  ],
  useWaitingForTasks: () => [
    {
      id: 'task-w1',
      title: 'Waiting For Review',
      is_completed: 0,
      is_starred: 0,
      is_habit: 0,
      is_trashed: 0,
      waiting_on: 'Alice',
      follow_up_date: '2026-10-20',
      parent_task_id: null,
      created_at: '2026-10-14T00:00:00Z',
      updated_at: '2026-10-14T00:00:00Z',
      created_by_device: 'test',
      scheduled_start_min: null,
      scheduled_duration_min: null,
      all_day: 0,
      priority: 0,
      sort_order: 1000,
      pomodoro_count: 0,
    },
  ],
  useCompletedTasks: () => [],
}));

vi.mock('../../src/renderer/stores/projectStore.js', () => ({
  useProjectStore: (selector?: any) => {
    const state = { projectsById: {}, updateProject: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../src/renderer/stores/areaStore.js', () => ({
  useAreaStore: (selector?: any) => {
    const state = { areasById: {} };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../src/renderer/stores/viewGroupStore.js', () => ({
  useViewGroupStore: Object.assign(
    (selector?: any) => {
      const state = { groupByMap: {}, collapsedGroupsMap: {} };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        setGroupBy: vi.fn(),
        toggleGroupCollapsed: vi.fn(),
      }),
    }
  ),
}));

vi.mock('../../src/renderer/hooks/useToday.js', () => ({
  useToday: () => '2026-10-14',
}));

vi.mock('../../src/renderer/hooks/usePlannedGroups.js', () => ({
  usePlannedGroups: () => [
    {
      kind: 'dated',
      dateISO: '2026-10-15',
      label: 'Tomorrow',
      taskIds: ['task-p1'],
    },
  ],
}));

vi.mock('../../src/renderer/hooks/useCalendarDots.js', () => ({
  useCalendarDots: () => ({}),
}));

vi.mock('../../src/renderer/hooks/useUndoRedo.js', () => ({
  useUndoRedo: () => ({
    pushAction: vi.fn(),
    lastToastAction: null,
    undo: vi.fn(),
    clearToast: vi.fn(),
  }),
}));

vi.mock('../../src/renderer/hooks/useCompletionLinger.js', () => ({
  useCompletionLinger: (_tasks?: Task[]) => ({
    isLingering: () => false,
    isExiting: () => false,
    lingerVersion: 0,
    withLingering: (t: Task[]) => t,
    markCompleted: vi.fn(),
  }),
}));

describe('Phase 5 Views Search Integration', () => {
  it('renders ViewSearch trigger in PlannedView header', () => {
    const html = renderToStaticMarkup(<PlannedView />);
    expect(html).toContain('Planned');
    expect(html).toContain('aria-label="Search Planned');
  });

  it('renders ViewSearch trigger in AnytimeView header', () => {
    const html = renderToStaticMarkup(<AnytimeView />);
    expect(html).toContain('Anytime');
    expect(html).toContain('aria-label="Search Anytime');
  });

  it('renders ViewSearch trigger in SomedayView header', () => {
    const html = renderToStaticMarkup(<SomedayView />);
    expect(html).toContain('Someday / Maybe');
    expect(html).toContain('aria-label="Search Someday / Maybe');
  });

  it('renders ViewSearch trigger in WaitingForView header', () => {
    const html = renderToStaticMarkup(<WaitingForView />);
    expect(html).toContain('Waiting For');
    expect(html).toContain('aria-label="Search Waiting For');
  });
});
