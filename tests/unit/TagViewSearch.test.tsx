import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagView } from '../../src/renderer/features/tags/TagView.js';
import { useTagStore } from '../../src/renderer/stores/tagStore.js';
import { ipc } from '../../src/renderer/services/ipc.js';
import type { Task } from '../../src/shared/types/task.js';

vi.mock('../../src/renderer/stores/tagStore.js', () => ({
  useTagStore: vi.fn(),
}));

vi.mock('../../src/renderer/stores/taskStore.js', () => ({
  useTaskStore: () => ({
    toggleComplete: vi.fn(),
    toggleStar: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    duplicateTask: vi.fn(),
  }),
}));

vi.mock('../../src/renderer/hooks/useCompletionLinger.js', () => ({
  useCompletionLinger: () => ({
    isLingering: () => false,
    isExiting: () => false,
    lingerVersion: 0,
  }),
}));

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: {
    invoke: vi.fn(),
  },
}));

describe('TagView Search Integration (Phase 3 Pilot)', () => {
  const sampleTag = {
    id: 'tag-work',
    name: 'Work',
    color: '#ff4444',
  };

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Fix website bug',
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
    {
      id: 'task-2',
      title: 'Review pull request',
      is_completed: 1,
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
      sort_order: 2000,
      pomodoro_count: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useTagStore as any).mockReturnValue({
      tagsById: { 'tag-work': sampleTag },
      loadTags: vi.fn(),
    });
    (ipc.invoke as any).mockResolvedValue(sampleTasks);
  });

  it('renders search trigger in TagView header', () => {
    const html = renderToStaticMarkup(<TagView tagId="tag-work" />);
    // Check header contains #Work
    expect(html).toContain('#Work');
    // Check ViewSearch trigger button is rendered
    expect(html).toContain('aria-label="Search #Work');
  });
});
