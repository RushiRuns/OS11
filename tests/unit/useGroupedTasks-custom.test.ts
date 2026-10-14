import { describe, it, expect } from 'vitest';
import { groupTasks, resolveGroupDropMutation } from '../../src/renderer/hooks/useGroupedTasks.js';
import type { FlattenedTaskItem } from '../../src/renderer/features/tasks/TaskList.js';
import type { Task, CustomGroupSection, ProjectGroupOverride } from '@shared/types/index.js';

describe('useGroupedTasks: Custom Grouping Pure Logic', () => {
  const sections: CustomGroupSection[] = [
    {
      id: 'sec-bugs',
      group_id: 'grp-coding',
      name: 'Bugs to be fixed',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    },
    {
      id: 'sec-features',
      group_id: 'grp-coding',
      name: 'Features to be implemented',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    },
    {
      id: 'sec-icebox',
      group_id: 'grp-coding',
      name: 'Icebox',
      sort_order: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: null,
    },
    {
      id: 'sec-deleted',
      group_id: 'grp-coding',
      name: 'Old Deprecated Section',
      sort_order: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      deleted_at: '2026-02-01T00:00:00Z', // soft-deleted
    },
  ];

  const makeItem = (id: string, depth = 0, parentId: string | null = null): FlattenedTaskItem => ({
    task: {
      id,
      title: `Task ${id}`,
      project_id: 'proj-1',
      parent_task_id: parentId,
      all_day: 1,
      priority: 0,
      is_starred: 0,
      is_completed: 0,
      created_by_device: 'local',
      sort_order: 100,
      pomodoro_count: 0,
      is_trashed: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    } as Task,
    depth,
    hasSubtasks: false,
    isExpanded: false,
    subtaskCount: { total: 0, completed: 0 },
  });

  // 1. Basic placement and Unsorted fallback
  it('places tasks into active sections and falls back to Unsorted for unassigned tasks', () => {
    const items: FlattenedTaskItem[] = [
      makeItem('t1'),
      makeItem('t2'),
      makeItem('t3'),
    ];

    const taskCustomValues = {
      t1: 'sec-bugs',
      t2: 'sec-features',
      // t3 has no value -> Unsorted
    };

    const groups = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      taskCustomValues,
    });

    expect(groups.length).toBe(4); // 3 visible sections + Unsorted
    expect(groups[0].title).toBe('Bugs to be fixed');
    expect(groups[0].items.map((i) => i.task.id)).toEqual(['t1']);

    expect(groups[1].title).toBe('Features to be implemented');
    expect(groups[1].items.map((i) => i.task.id)).toEqual(['t2']);

    expect(groups[2].title).toBe('Icebox');
    expect(groups[2].items).toEqual([]); // empty section visible by default

    expect(groups[3].title).toBe('Unsorted');
    expect(groups[3].items.map((i) => i.task.id)).toEqual(['t3']);
  });

  // 2. Fallback to Unsorted for deleted or hidden sections
  it('falls back to Unsorted if value points to a deleted section or a hidden section in project overrides', () => {
    const overrides: ProjectGroupOverride[] = [
      {
        project_id: 'proj-1',
        section_id: 'sec-icebox',
        is_hidden: 1, // hidden in this project
        name_override: null,
        sort_override: null,
        created_at: '',
        updated_at: '',
      },
    ];

    const items: FlattenedTaskItem[] = [
      makeItem('t-del'), // points to soft-deleted sec-deleted
      makeItem('t-hidden'), // points to hidden sec-icebox
    ];

    const taskCustomValues = {
      't-del': 'sec-deleted',
      't-hidden': 'sec-icebox',
    };

    const groups = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      customOverrides: overrides,
      taskCustomValues,
    });

    // sec-deleted and sec-icebox must not appear
    expect(groups.some((g) => g.title === 'Icebox')).toBe(false);
    expect(groups.some((g) => g.title === 'Old Deprecated Section')).toBe(false);

    // Both tasks must fall back to Unsorted
    const unsortedGroup = groups.find((g) => g.key === 'custom-section:__unsorted__');
    expect(unsortedGroup).toBeDefined();
    expect(unsortedGroup?.items.map((i) => i.task.id)).toEqual(['t-del', 't-hidden']);
  });

  // 3. Project overrides: rename and sort overrides
  it('applies project rename and sort overrides correctly', () => {
    const overrides: ProjectGroupOverride[] = [
      {
        project_id: 'proj-1',
        section_id: 'sec-features',
        is_hidden: 0,
        name_override: 'Project Features',
        sort_override: -5, // put features before bugs
        created_at: '',
        updated_at: '',
      },
    ];

    const groups = groupTasks({
      items: [],
      groupBy: 'custom',
      customSections: sections,
      customOverrides: overrides,
    });

    expect(groups[0].title).toBe('Project Features');
    expect(groups[1].title).toBe('Bugs to be fixed');
  });

  // 4. Subtasks travel with their parent
  it('keeps subtasks strictly attached to their parent section', () => {
    const parent = makeItem('parent');
    const subtask1 = makeItem('sub1', 1, 'parent');
    const subtask2 = makeItem('sub2', 1, 'parent');

    const items = [parent, subtask1, subtask2];

    const taskCustomValues = {
      parent: 'sec-bugs',
      sub1: 'sec-features', // Even if subtask has dummy value, it must travel with parent
    };

    const groups = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      taskCustomValues,
    });

    const bugsGroup = groups.find((g) => g.key === 'custom-section:sec-bugs')!;
    expect(bugsGroup.items.map((i) => i.task.id)).toEqual(['parent', 'sub1', 'sub2']);

    const featuresGroup = groups.find((g) => g.key === 'custom-section:sec-features')!;
    expect(featuresGroup.items).toEqual([]);
  });

  // 5. Hide empty toggle & Unsorted visibility
  it('hides empty sections when hideEmpty is true, and hides Unsorted when empty unless dragging', () => {
    const items = [makeItem('t1')];
    const taskCustomValues = { t1: 'sec-bugs' };

    // With hideEmpty = true and not dragging
    const groups1 = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      taskCustomValues,
      hideEmpty: true,
      isDragging: false,
    });

    // Only sec-bugs has tasks, Unsorted has 0 tasks
    expect(groups1.map((g) => g.title)).toEqual(['Bugs to be fixed']);

    // With isDragging = true, Unsorted shows as drop target
    const groups2 = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      taskCustomValues,
      hideEmpty: true,
      isDragging: true,
    });

    expect(groups2.map((g) => g.title)).toEqual(['Bugs to be fixed', 'Unsorted']);
  });

  // 6. resolveGroupDropMutation
  it('resolves group drop mutations across sections and to unsorted correctly', () => {
    const task = makeItem('t1').task;
    const taskCustomValues = { t1: 'sec-bugs' };

    // Drop on sec-features
    const res1 = resolveGroupDropMutation({
      task,
      groupBy: 'custom',
      targetGroupKey: 'custom-section:sec-features',
      customSections: sections,
      taskCustomValues,
      todayStr: '2026-01-01',
    });

    expect(res1?.customSectionChange).toEqual({
      targetSectionId: 'sec-features',
      previousSectionId: 'sec-bugs',
    });
    expect(res1?.description).toBe('Moved "Task t1" to Features to be implemented');

    // Drop on Unsorted
    const res2 = resolveGroupDropMutation({
      task,
      groupBy: 'custom',
      targetGroupKey: 'custom-section:__unsorted__',
      customSections: sections,
      taskCustomValues,
      todayStr: '2026-01-01',
    });

    expect(res2?.customSectionChange).toEqual({
      targetSectionId: null,
      previousSectionId: 'sec-bugs',
    });
    expect(res2?.description).toBe('Moved "Task t1" to Unsorted');

    // Drop on same section should be no-op
    const res3 = resolveGroupDropMutation({
      task,
      groupBy: 'custom',
      targetGroupKey: 'custom-section:sec-bugs',
      customSections: sections,
      taskCustomValues,
      todayStr: '2026-01-01',
    });

    expect(res3).toBeNull();
  });

  // 7. Performance on 2,000 tasks
  it('partitions 2,000 tasks in under 16ms', () => {
    const items: FlattenedTaskItem[] = [];
    const values: Record<string, string> = {};

    for (let i = 0; i < 2000; i++) {
      const id = `task-${i}`;
      items.push(makeItem(id));
      if (i % 3 === 0) values[id] = 'sec-bugs';
      else if (i % 3 === 1) values[id] = 'sec-features';
      // remaining in unsorted
    }

    const start = performance.now();
    const groups = groupTasks({
      items,
      groupBy: 'custom',
      customSections: sections,
      taskCustomValues: values,
    });
    const duration = performance.now() - start;

    expect(groups.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(16); // Must stay within 16ms performance target
  });
});
