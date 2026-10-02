import { describe, it, expect } from 'vitest';
import type { Task } from '../../src/shared/types/task.js';
import {
  buildPlannedGroups,
  sortTasksWithinDay,
} from '../../src/renderer/hooks/usePlannedGroups.js';
import { computeCalendarDots } from '../../src/renderer/hooks/useCalendarDots.js';
import { buildMonthGridCells } from '../../src/renderer/hooks/useMonthGrid.js';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2, 9)}`,
    title: 'Test task',
    notes: null,
    list_id: 'list_inbox',
    area_id: null,
    project_id: null,
    parent_task_id: null,
    due_date: '2026-10-05',
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

describe('Planned View Grouping Logic (buildPlannedGroups)', () => {
  // Let today be Wednesday, Oct 7, 2026
  // Tomorrow = Thursday, Oct 8
  // This Week = Friday Oct 9, Saturday Oct 10, Sunday Oct 11
  // Next Week = Monday Oct 12 through Sunday Oct 18
  // Later = Monday Oct 19 onwards
  const today = '2026-10-07';

  it('correctly partitions tasks into Overdue, Today, Tomorrow, This Week, Next Week, and Later', () => {
    const tasks: Task[] = [
      makeTask({ id: 't-overdue-1', due_date: '2026-10-01', title: 'Overdue older' }),
      makeTask({ id: 't-overdue-2', due_date: '2026-10-05', title: 'Overdue recent' }),
      makeTask({ id: 't-today', due_date: '2026-10-07', title: 'Due Today' }),
      makeTask({ id: 't-tomorrow', due_date: '2026-10-08', title: 'Due Tomorrow' }),
      makeTask({ id: 't-this-week-fri', due_date: '2026-10-09', title: 'Due Friday' }),
      makeTask({ id: 't-this-week-sat', due_date: '2026-10-10', title: 'Due Saturday' }),
      makeTask({ id: 't-next-week-1', due_date: '2026-10-13', title: 'Next Tuesday' }),
      makeTask({ id: 't-next-week-2', due_date: '2026-10-16', title: 'Next Friday' }),
      makeTask({ id: 't-later-oct', due_date: '2026-10-25', title: 'Late October' }),
      makeTask({ id: 't-later-nov', due_date: '2026-11-12', title: 'Mid November' }),
    ];

    const groups = buildPlannedGroups(tasks, today);

    // 1. Overdue groups: split by day, oldest first
    const overdueGroups = groups.filter(g => g.kind === 'overdue');
    expect(overdueGroups.length).toBe(2);
    expect(overdueGroups[0].dateISO).toBe('2026-10-01');
    expect(overdueGroups[0].taskIds).toEqual(['t-overdue-1']);
    expect(overdueGroups[0].targetDropDateISO).toBeUndefined(); // Overdue is not a drop target
    expect(overdueGroups[1].dateISO).toBe('2026-10-05');
    expect(overdueGroups[1].taskIds).toEqual(['t-overdue-2']);

    // 2. Today group
    const todayGroup = groups.find(g => g.kind === 'today');
    expect(todayGroup).toBeDefined();
    expect(todayGroup?.dateISO).toBe('2026-10-07');
    expect(todayGroup?.taskIds).toEqual(['t-today']);
    expect(todayGroup?.targetDropDateISO).toBe('2026-10-07');

    // 3. Tomorrow group
    const tomorrowGroup = groups.find(g => g.kind === 'tomorrow');
    expect(tomorrowGroup).toBeDefined();
    expect(tomorrowGroup?.dateISO).toBe('2026-10-08');
    expect(tomorrowGroup?.taskIds).toEqual(['t-tomorrow']);
    expect(tomorrowGroup?.targetDropDateISO).toBe('2026-10-08');

    // 4. This Week: split by day
    const thisWeekGroups = groups.filter(g => g.kind === 'this-week');
    expect(thisWeekGroups.length).toBe(2);
    expect(thisWeekGroups[0].dateISO).toBe('2026-10-09');
    expect(thisWeekGroups[0].taskIds).toEqual(['t-this-week-fri']);
    expect(thisWeekGroups[0].targetDropDateISO).toBe('2026-10-09');
    expect(thisWeekGroups[1].dateISO).toBe('2026-10-10');
    expect(thisWeekGroups[1].taskIds).toEqual(['t-this-week-sat']);

    // 5. Next Week: single aggregate group
    const nextWeekGroups = groups.filter(g => g.kind === 'next-week');
    expect(nextWeekGroups.length).toBe(1);
    expect(nextWeekGroups[0].dateISO).toBeUndefined();
    expect(nextWeekGroups[0].taskIds).toEqual(['t-next-week-1', 't-next-week-2']);
    expect(nextWeekGroups[0].targetDropDateISO).toBe('2026-10-12'); // Following Monday

    // 6. Later: split by month
    const laterGroups = groups.filter(g => g.kind === 'later');
    expect(laterGroups.length).toBe(2);
    expect(laterGroups[0].label).toBe('October');
    expect(laterGroups[0].taskIds).toEqual(['t-later-oct']);
    expect(laterGroups[0].targetDropDateISO).toBe('2026-10-01');
    expect(laterGroups[1].label).toBe('November');
    expect(laterGroups[1].taskIds).toEqual(['t-later-nov']);
    expect(laterGroups[1].targetDropDateISO).toBe('2026-11-01');
  });

  it('excludes completed and trashed tasks entirely', () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', due_date: today, is_completed: 1 }),
      makeTask({ id: 't2', due_date: today, is_trashed: 1 }),
      makeTask({ id: 't3', due_date: today, is_completed: 0, is_trashed: 0 }),
    ];

    const groups = buildPlannedGroups(tasks, today);
    expect(groups.length).toBe(1);
    expect(groups[0].taskIds).toEqual(['t3']);
  });

  it('skips empty groups so no zero-task headers are emitted', () => {
    // Only 1 task due in November
    const tasks: Task[] = [makeTask({ id: 't-nov', due_date: '2026-11-20' })];

    const groups = buildPlannedGroups(tasks, today);
    expect(groups.length).toBe(1);
    expect(groups[0].kind).toBe('later');
    expect(groups[0].taskIds).toEqual(['t-nov']);
  });

  it('respects precedence: when today is Sunday, Monday is Tomorrow, not Next Week', () => {
    // Sunday, Oct 4, 2026
    const sundayToday = '2026-10-04';
    const mondayTomorrow = '2026-10-05';
    const tuesdayNextWeek = '2026-10-06';

    const tasks: Task[] = [
      makeTask({ id: 't-mon', due_date: mondayTomorrow, title: 'Monday task' }),
      makeTask({ id: 't-tue', due_date: tuesdayNextWeek, title: 'Tuesday task' }),
    ];

    const groups = buildPlannedGroups(tasks, sundayToday);
    const tomorrowGroup = groups.find(g => g.kind === 'tomorrow');
    const nextWeekGroup = groups.find(g => g.kind === 'next-week');

    expect(tomorrowGroup).toBeDefined();
    expect(tomorrowGroup?.dateISO).toBe('2026-10-05');
    expect(tomorrowGroup?.taskIds).toEqual(['t-mon']);

    expect(nextWeekGroup).toBeDefined();
    expect(nextWeekGroup?.taskIds).toEqual(['t-tue']);
  });

  it('sorts tasks within a day: all-day first, then timed ascending, ties by sort_order', () => {
    const tAllDay = makeTask({ id: 't-all-day', all_day: 1, due_time: null, sort_order: 50 });
    const tTimedLate = makeTask({
      id: 't-timed-late',
      all_day: 0,
      due_time: '16:00:00',
      sort_order: 10,
    });
    const tTimedEarly = makeTask({
      id: 't-timed-early',
      all_day: 0,
      due_time: '09:00:00',
      sort_order: 80,
    });
    const tTimedTie1 = makeTask({ id: 't-tie-1', all_day: 0, due_time: '09:00:00', sort_order: 5 });
    const tTimedTie2 = makeTask({
      id: 't-tie-2',
      all_day: 0,
      due_time: '09:00:00',
      sort_order: 20,
    });

    const sorted = [tTimedLate, tAllDay, tTimedTie2, tTimedEarly, tTimedTie1].sort(
      sortTasksWithinDay
    );
    expect(sorted.map(t => t.id)).toEqual([
      't-all-day',
      't-tie-1',
      't-tie-2',
      't-timed-early',
      't-timed-late',
    ]);
  });
});

describe('useCalendarDots / computeCalendarDots', () => {
  it('correctly counts incomplete dated tasks across the 42 visible cells', () => {
    const month = new Date('2026-10-01T12:00:00');
    const tasks: Task[] = [
      makeTask({ id: 't1', due_date: '2026-10-05', is_completed: 0 }),
      makeTask({ id: 't2', due_date: '2026-10-05', is_completed: 0 }),
      makeTask({ id: 't3', due_date: '2026-10-05', is_completed: 1 }), // completed ignored
      makeTask({ id: 't4', due_date: '2026-10-15', is_completed: 0 }),
      makeTask({ id: 't5', due_date: '2026-09-30', is_completed: 0 }), // previous month edge day in 42-grid
      makeTask({ id: 't6', due_date: '2027-01-01', is_completed: 0 }), // outside grid
    ];

    const dots = computeCalendarDots(tasks, month);
    expect(dots['2026-10-05']).toBe(2);
    expect(dots['2026-10-15']).toBe(1);
    expect(dots['2026-09-30']).toBe(1);
    expect(dots['2026-10-01']).toBe(0);
    expect(dots['2027-01-01']).toBeUndefined();
  });
});

describe('useMonthGrid / buildMonthGridCells', () => {
  it('builds exactly 42 cells starting on Monday and ending on Sunday', () => {
    const month = new Date('2026-10-01T12:00:00');
    const cells = buildMonthGridCells(month, '2026-10-10', '2026-10-07');

    expect(cells.length).toBe(42);

    // In October 2026, Oct 1 is Thursday.
    // Monday of that week is Sep 28.
    expect(cells[0].dateStr).toBe('2026-09-28');
    expect(cells[0].isCurrentMonth).toBe(false);

    // Oct 1 should be index 3 (Mon=0, Tue=1, Wed=2, Thu=3)
    expect(cells[3].dateStr).toBe('2026-10-01');
    expect(cells[3].isCurrentMonth).toBe(true);

    // Selected cell test
    const selectedCell = cells.find(c => c.dateStr === '2026-10-10');
    expect(selectedCell?.isSelected).toBe(true);

    // Today cell test
    const todayCell = cells.find(c => c.dateStr === '2026-10-07');
    expect(todayCell?.isToday).toBe(true);
  });
});
