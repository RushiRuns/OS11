import { describe, it, expect } from 'vitest';
import type { Task } from '../../src/shared/types/task.js';
import type { Project } from '../../src/shared/types/Project.js';
import type { Area } from '../../src/shared/types/Area.js';
import { resolveGroupDropMutation } from '../../src/renderer/hooks/useGroupedTasks.js';

function makeTask(overrides: Partial<Task>): Task {
  return {
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
}

describe('resolveGroupDropMutation (Phase C — Cross-Group Drag & Drop)', () => {
  const today = '2026-10-08';

  // 1. None
  it('returns null when groupBy is "none"', () => {
    const task = makeTask({ priority: 1 });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'none',
      targetGroupKey: 'priority-4',
      todayStr: today,
    });
    expect(result).toBeNull();
  });

  // 2. Priority
  it('updates priority when dropped into another priority group', () => {
    const task = makeTask({ id: 't1', title: 'Task 1', priority: 1 });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'priority',
      targetGroupKey: 'priority-4',
      todayStr: today,
    });

    expect(result).not.toBeNull();
    expect(result?.updates.priority).toBe(4);
    expect(result?.previousValues.priority).toBe(1);
    expect(result?.description).toContain('Urgent');
  });

  it('returns null on same-priority drop', () => {
    const task = makeTask({ id: 't1', priority: 3 });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'priority',
      targetGroupKey: 'priority-3',
      todayStr: today,
    });
    expect(result).toBeNull();
  });

  // 3. Date
  it('updates due_date when dropped into Today or Tomorrow', () => {
    const task = makeTask({ id: 't1', due_date: null });
    const resultToday = resolveGroupDropMutation({
      task,
      groupBy: 'date',
      targetGroupKey: 'date-today',
      todayStr: today,
    });
    expect(resultToday?.updates.due_date).toBe(today);

    const resultTomorrow = resolveGroupDropMutation({
      task,
      groupBy: 'date',
      targetGroupKey: 'date-tomorrow',
      todayStr: today,
    });
    expect(resultTomorrow?.updates.due_date).toBe('2026-10-09');
  });

  it('clears due_date when dropped into No Date', () => {
    const task = makeTask({ id: 't1', due_date: '2026-10-15' });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'date',
      targetGroupKey: 'date-none',
      todayStr: today,
    });
    expect(result?.updates.due_date).toBeNull();
    expect(result?.previousValues.due_date).toBe('2026-10-15');
  });

  // 4. Project
  it('updates project_id and syncs area_id when dropped into a Project', () => {
    const projectsById: Record<string, Project> = {
      p1: {
        id: 'p1',
        name: 'Project 1',
        area_id: 'a1',
        icon: '🚀',
        status: 'active',
        default_view: 'list',
        views: ['list'],
        sort_order: 1,
        created_at: '',
        updated_at: '',
      },
    };

    const task = makeTask({ id: 't1', project_id: null, area_id: null });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'project',
      targetGroupKey: 'project-p1',
      projectsById,
      todayStr: today,
    });

    expect(result?.updates.project_id).toBe('p1');
    expect(result?.updates.area_id).toBe('a1');
    expect(result?.previousValues.project_id).toBeNull();
  });

  it('clears project_id when dropped into No Project', () => {
    const task = makeTask({ id: 't1', project_id: 'p1' });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'project',
      targetGroupKey: 'project-none',
      todayStr: today,
    });

    expect(result?.updates.project_id).toBeNull();
    expect(result?.previousValues.project_id).toBe('p1');
  });

  // 5. Area
  it('updates area_id when dropped into an Area and detaches project if area mismatches', () => {
    const projectsById: Record<string, Project> = {
      p1: {
        id: 'p1',
        name: 'Project 1',
        area_id: 'a_old',
        status: 'active',
        default_view: 'list',
        views: ['list'],
        sort_order: 1,
        created_at: '',
        updated_at: '',
      },
    };
    const areasById: Record<string, Area> = {
      a_new: {
        id: 'a_new',
        workspace_id: 'ws-1',
        name: 'New Area',
        sort_order: 1,
        is_collapsed: 0,
        created_at: '',
        updated_at: '',
      },
    };

    const task = makeTask({ id: 't1', area_id: 'a_old', project_id: 'p1' });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'area',
      targetGroupKey: 'area-a_new',
      projectsById,
      areasById,
      todayStr: today,
    });

    expect(result?.updates.area_id).toBe('a_new');
    expect(result?.updates.project_id).toBeNull(); // project cleared because it belonged to a_old
  });

  // 6. Tag
  it('updates tags when dropped into another tag group', () => {
    const task = makeTask({ id: 't1' });
    const taskTagsByTaskId = {
      t1: ['tag_old'],
    };

    const result = resolveGroupDropMutation({
      task,
      groupBy: 'tag',
      targetGroupKey: 'tag-tag_new',
      taskTagsByTaskId,
      todayStr: today,
    });

    expect(result?.tagChanges?.addTagId).toBe('tag_new');
    expect(result?.tagChanges?.removeTagId).toBe('tag_old');
  });

  // 7. Time
  it('updates scheduled_start_min and due_time when dropped into a Time bucket', () => {
    const task = makeTask({ id: 't1', scheduled_start_min: null, due_time: null });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'time',
      targetGroupKey: 'time-morning',
      todayStr: today,
    });

    expect(result?.updates.scheduled_start_min).toBe(540); // 9:00 AM
    expect(result?.updates.due_time).toBe('09:00');
  });

  it('clears scheduled_start_min and due_time when dropped into Any Time', () => {
    const task = makeTask({ id: 't1', scheduled_start_min: 600, due_time: '10:00' });
    const result = resolveGroupDropMutation({
      task,
      groupBy: 'time',
      targetGroupKey: 'time-any',
      todayStr: today,
    });

    expect(result?.updates.scheduled_start_min).toBeNull();
    expect(result?.updates.due_time).toBeNull();
  });
});
