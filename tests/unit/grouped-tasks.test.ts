import { describe, it, expect } from 'vitest';
import type { Task } from '../../src/shared/types/task.js';
import type { Project } from '../../src/shared/types/Project.js';
import type { Area } from '../../src/shared/types/Area.js';
import type { Tag } from '../../src/shared/types/Tag.js';
import type { FlattenedTaskItem } from '../../src/renderer/features/tasks/TaskList.js';
import { groupTasks } from '../../src/renderer/hooks/useGroupedTasks.js';

function makeItem(overrides: Partial<Task>, depth: number = 0): FlattenedTaskItem {
  const task: Task = {
    id: `task_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test task',
    notes: null,
    list_id: 'list_inbox',
    area_id: null,
    project_id: null,
    parent_task_id: null,
    due_date: null,
    due_time: null,
    all_day: 1,
    recurrence_rule: null,
    recurrence_basis: null,
    priority: 0,
    is_starred: 0,
    is_completed: 0,
    completed_at: null,
    estimated_minutes: null,
    assignee_device_id: null,
    created_by_device: 'local',
    sort_order: 100,
    my_day_date: null,
    pomodoro_count: 0,
    is_trashed: 0,
    trashed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };

  return {
    task,
    depth,
    hasSubtasks: false,
    isExpanded: false,
    subtaskCount: { completed: 0, total: 0 },
  };
}

describe('groupTasks (Phase B — Grouped View Rendering)', () => {
  const today = '2026-10-08';

  // 1. None
  it('returns a single "All Tasks" group when groupBy is "none"', () => {
    const items = [makeItem({ title: 'Task 1' }), makeItem({ title: 'Task 2' })];
    const groups = groupTasks({
      items,
      groupBy: 'none',
      todayStr: today,
    });

    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('all');
    expect(groups[0].items.length).toBe(2);
  });

  // 2. Priority
  it('correctly partitions tasks by Priority in descending order (Urgent to No Priority)', () => {
    const items = [
      makeItem({ id: 't-none', priority: 0 }),
      makeItem({ id: 't-urgent', priority: 4 }),
      makeItem({ id: 't-med', priority: 2 }),
      makeItem({ id: 't-high', priority: 3 }),
      makeItem({ id: 't-low', priority: 1 }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'priority',
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual([
      'Urgent',
      'High',
      'Medium',
      'Low',
      'No Priority',
    ]);
    expect(groups[0].items[0].task.id).toBe('t-urgent');
    expect(groups[1].items[0].task.id).toBe('t-high');
    expect(groups[2].items[0].task.id).toBe('t-med');
    expect(groups[3].items[0].task.id).toBe('t-low');
    expect(groups[4].items[0].task.id).toBe('t-none');
  });

  it('omits empty priority groups', () => {
    const items = [
      makeItem({ id: 't-high-1', priority: 3 }),
      makeItem({ id: 't-high-2', priority: 3 }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'priority',
      todayStr: today,
    });

    expect(groups.length).toBe(1);
    expect(groups[0].title).toBe('High');
    expect(groups[0].items.length).toBe(2);
  });

  // 3. Date
  it('correctly partitions tasks by Date into Overdue, Today, Tomorrow, Upcoming, Later, No Date', () => {
    const items = [
      makeItem({ id: 't-overdue', due_date: '2026-10-06' }),
      makeItem({ id: 't-today', due_date: '2026-10-08' }),
      makeItem({ id: 't-tomorrow', due_date: '2026-10-09' }),
      makeItem({ id: 't-upcoming', due_date: '2026-10-12' }),
      makeItem({ id: 't-later', due_date: '2026-10-25' }),
      makeItem({ id: 't-nodate', due_date: null }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'date',
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual([
      'Overdue',
      'Today',
      'Tomorrow',
      'Upcoming',
      'Later',
      'No Date',
    ]);
  });

  it('treats tasks with my_day_date = today and no due_date as Today', () => {
    const items = [
      makeItem({ id: 't-myday', due_date: null, my_day_date: '2026-10-08' }),
      makeItem({ id: 't-nodate', due_date: null, my_day_date: null }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'date',
      todayStr: today,
    });

    expect(groups.length).toBe(2);
    expect(groups[0].title).toBe('Today');
    expect(groups[0].items[0].task.id).toBe('t-myday');
    expect(groups[1].title).toBe('No Date');
    expect(groups[1].items[0].task.id).toBe('t-nodate');
  });

  // 4. Tag
  it('groups tasks by primary tag, puts untagged in "No Tag"', () => {
    const tagsById: Record<string, Tag> = {
      tag1: { id: 'tag1', name: 'Work', color: 'blue', sort_order: 1, created_at: '' },
      tag2: { id: 'tag2', name: 'Personal', color: 'green', sort_order: 2, created_at: '' },
    };
    const taskTagsByTaskId: Record<string, string[]> = {
      't-work': ['tag1'],
      't-multi': ['tag2', 'tag1'], // Primary tag is tag2 (Personal)
    };

    const items = [
      makeItem({ id: 't-work' }),
      makeItem({ id: 't-multi' }),
      makeItem({ id: 't-untagged' }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'tag',
      tagsById,
      taskTagsByTaskId,
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual(['#Personal', '#Work', 'No Tag']);
    expect(groups[0].items[0].task.id).toBe('t-multi');
    expect(groups[1].items[0].task.id).toBe('t-work');
    expect(groups[2].items[0].task.id).toBe('t-untagged');
  });

  // 5. Project
  it('groups tasks by project with icons and "No Project" last', () => {
    const projectsById: Record<string, Project> = {
      p1: {
        id: 'p1',
        name: 'Alpha',
        icon: '🚀',
        status: 'active',
        default_view: 'list',
        views: ['list'],
        sort_order: 1,
        created_at: '',
        updated_at: '',
      },
      p2: {
        id: 'p2',
        name: 'Beta',
        icon: null,
        status: 'active',
        default_view: 'list',
        views: ['list'],
        sort_order: 2,
        created_at: '',
        updated_at: '',
      },
    };

    const items = [
      makeItem({ id: 't-p1', project_id: 'p1' }),
      makeItem({ id: 't-p2', project_id: 'p2' }),
      makeItem({ id: 't-noproject', project_id: null }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'project',
      projectsById,
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual(['🚀 Alpha', '📁 Beta', 'No Project']);
  });

  // 6. Area
  it('groups tasks by area with icons and "No Area" last', () => {
    const areasById: Record<string, Area> = {
      a1: {
        id: 'a1',
        workspace_id: 'ws-1',
        name: 'Work Area',
        icon: '💼',
        sort_order: 1,
        is_collapsed: 0,
        created_at: '',
        updated_at: '',
      },
    };

    const items = [
      makeItem({ id: 't-a1', area_id: 'a1' }),
      makeItem({ id: 't-noarea', area_id: null }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'area',
      areasById,
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual(['💼 Work Area', 'No Area']);
  });

  // 7. Time
  it('partitions tasks by time of day (Morning, Afternoon, Evening, Night, Any Time)', () => {
    const items = [
      makeItem({ id: 't-morning', scheduled_start_min: 540 }), // 9:00 AM
      makeItem({ id: 't-afternoon', due_time: '14:30' }), // 2:30 PM (870 min)
      makeItem({ id: 't-evening', scheduled_start_min: 1100 }), // 6:20 PM
      makeItem({ id: 't-night', due_time: '22:00' }), // 10:00 PM (1320 min)
      makeItem({ id: 't-any', scheduled_start_min: null, due_time: null }),
    ];

    const groups = groupTasks({
      items,
      groupBy: 'time',
      todayStr: today,
    });

    expect(groups.map((g) => g.title)).toEqual([
      'Morning',
      'Afternoon',
      'Evening',
      'Night',
      'Any Time',
    ]);
  });

  // 8. Subtask Depth Sanitization
  it('clamps orphaned subtask depth to 0 if parent is not in the same group', () => {
    const items = [
      makeItem({ id: 'parent', priority: 4 }, 0),
      makeItem({ id: 'child', parent_task_id: 'parent', priority: 1 }, 1), // in Low, parent in Urgent
    ];

    const groups = groupTasks({
      items,
      groupBy: 'priority',
      todayStr: today,
    });

    const urgentGroup = groups.find((g) => g.title === 'Urgent');
    const lowGroup = groups.find((g) => g.title === 'Low');

    expect(urgentGroup?.items[0].task.id).toBe('parent');
    expect(urgentGroup?.items[0].depth).toBe(0);

    expect(lowGroup?.items[0].task.id).toBe('child');
    expect(lowGroup?.items[0].depth).toBe(0); // clamped from 1 to 0 because parent is in Urgent
  });
});
