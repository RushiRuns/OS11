import { describe, it, expect } from 'vitest';
import {
  localDateKey,
  addDays,
  addMonthsClamped,
  daysInPeriod,
  weeksInPeriod,
  quarterRange,
  currentQuarter,
  buildWorkIndex,
  workRollup,
  habitStats,
  keyResultProgress,
  objectiveProgress,
  objectiveHealth,
  paceState,
  dueInfo,
  nextCheckInDate,
  objectiveListState,
  computeOkrMetrics,
  validateObjectivePayload,
  validateKeyResultPayload,
} from '../../src/main/domain/okr.js';
import type { Objective, KeyResult, KRCheckIn, KRHabitLog, Task, Project } from '../../src/shared/types/index.js';

describe('Domain: OKR Pure Domain Functions', () => {
  describe('Dates and Quarters', () => {
    it('formats localDateKey properly', () => {
      const d = new Date(2026, 9, 15); // Month is 0-indexed: 9 = October
      expect(localDateKey(d)).toBe('2026-10-15');
    });

    it('adds days across month boundaries', () => {
      expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    });

    it('clamps addMonths to month end (Jan 31 -> Feb 28 or 29)', () => {
      // Non leap year
      expect(addMonthsClamped('2025-01-31', 1)).toBe('2025-02-28');
      // Leap year
      expect(addMonthsClamped('2024-01-31', 1)).toBe('2024-02-29');
    });

    it('calculates days and weeks in period correctly', () => {
      expect(daysInPeriod('2026-10-01', '2026-10-07')).toBe(7);
      expect(weeksInPeriod('2026-10-01', '2026-10-07')).toBe(1);

      // Q4 2026: Oct 1 to Dec 31 = 31 + 30 + 31 = 92 days
      expect(daysInPeriod('2026-10-01', '2026-12-31')).toBe(92);
      expect(weeksInPeriod('2026-10-01', '2026-12-31')).toBe(14);
    });

    it('computes quarterRange for standard calendar and handles leap years', () => {
      // Standard Q1 in non-leap year (2025: 31 + 28 + 31 = 90 days)
      const q1_2025 = quarterRange(2025, 1);
      expect(q1_2025).toEqual({ start: '2025-01-01', end: '2025-03-31' });
      expect(daysInPeriod(q1_2025.start, q1_2025.end)).toBe(90);

      // Standard Q1 in leap year (2024: 31 + 29 + 31 = 91 days)
      const q1_2024 = quarterRange(2024, 1);
      expect(q1_2024).toEqual({ start: '2024-01-01', end: '2024-03-31' });
      expect(daysInPeriod(q1_2024.start, q1_2024.end)).toBe(91);

      // Q4 2026
      expect(quarterRange(2026, 4)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    });

    it('computes currentQuarter correctly', () => {
      const qInfo = currentQuarter('2026-10-15');
      expect(qInfo.quarter).toBe(4);
      expect(qInfo.year).toBe(2026);
      expect(qInfo.label).toBe('Q4 2026');
      expect(qInfo.start).toBe('2026-10-01');
      expect(qInfo.end).toBe('2026-12-31');
    });
  });

  describe('Key Result & Objective Progress', () => {
    it('calculates ascending metric progress and clamps to [0, 100]', () => {
      const kr: KeyResult = {
        id: 'kr-1',
        objective_id: 'obj-1',
        title: 'NPS',
        kind: 'metric',
        start_value: 0,
        target_value: 5,
        current_value: 2.1,
        sort_order: 1000,
        created_at: '',
        updated_at: '',
      };

      // 0 to 5 -> 2.1 = 42%
      expect(keyResultProgress(kr)).toBe(42);

      // Below start clamps to 0
      expect(keyResultProgress({ ...kr, current_value: -1 })).toBe(0);

      // Above target clamps to 100
      expect(keyResultProgress({ ...kr, current_value: 10 })).toBe(100);
    });

    it('calculates descending metric progress (e.g. latency 120 to 30 -> 60 = 67%)', () => {
      const kr: KeyResult = {
        id: 'kr-2',
        objective_id: 'obj-1',
        title: 'Latency',
        kind: 'metric',
        start_value: 120,
        target_value: 30,
        current_value: 60,
        sort_order: 1000,
        created_at: '',
        updated_at: '',
      };

      // (120 - 60) / (120 - 30) = 60 / 90 = 66.666... -> 67%
      expect(keyResultProgress(kr)).toBe(67);

      // Slower than start clamps to 0
      expect(keyResultProgress({ ...kr, current_value: 150 })).toBe(0);

      // Faster than target clamps to 100
      expect(keyResultProgress({ ...kr, current_value: 20 })).toBe(100);
    });

    it('computes objectiveProgress as plain unweighted average of key results', () => {
      const krs: KeyResult[] = [
        { id: 'kr-1' } as KeyResult,
        { id: 'kr-2' } as KeyResult,
      ];
      const progressMap = new Map([
        ['kr-1', 40],
        ['kr-2', 70],
      ]);
      expect(objectiveProgress(krs, progressMap)).toBe(55);
      expect(objectiveProgress([], progressMap)).toBe(0);
    });
  });

  describe('Work Rollup', () => {
    it('deduplicates directly linked task and project linked task, ignores subtasks and trashed tasks', () => {
      const tasks: Task[] = [
        // Direct link to kr-work
        { id: 't-1', title: 'Task 1', key_result_id: 'kr-work', is_completed: 1, is_trashed: 0, parent_task_id: null } as Task,
        // Belongs to project p-1 AND directly linked to kr-work (should be counted ONCE)
        { id: 't-2', title: 'Task 2', project_id: 'p-1', key_result_id: 'kr-work', is_completed: 1, is_trashed: 0, parent_task_id: null } as Task,
        // Belongs to project p-1 (linked via project)
        { id: 't-3', title: 'Task 3', project_id: 'p-1', key_result_id: null, is_completed: 0, is_trashed: 0, parent_task_id: null } as Task,
        // Subtask (should be IGNORED)
        { id: 't-sub', title: 'Subtask', project_id: 'p-1', key_result_id: 'kr-work', is_completed: 1, is_trashed: 0, parent_task_id: 't-1' } as Task,
        // Trashed task (should be IGNORED)
        { id: 't-trash', title: 'Trash', project_id: 'p-1', key_result_id: 'kr-work', is_completed: 1, is_trashed: 1, parent_task_id: null } as Task,
      ];

      const projects: Project[] = [
        { id: 'p-1', name: 'Project 1', key_result_id: 'kr-work', status: 'active' } as unknown as Project,
      ];

      const index = buildWorkIndex(tasks, projects);
      const rollup = workRollup('kr-work', index);

      // Only t-1, t-2, t-3 count (total = 3, done = 2 -> progress = 67%)
      expect(rollup.total).toBe(3);
      expect(rollup.done).toBe(2);
      expect(rollup.progress).toBe(67);
      expect(rollup.tasks.map((t) => t.id).sort()).toEqual(['t-1', 't-2', 't-3']);
    });
  });

  describe('Habit Statistics', () => {
    it('calculates week streak, current week met, and handles rest days', () => {
      const kr: KeyResult = {
        id: 'kr-habit',
        objective_id: 'obj-1',
        title: 'Exercise 3x/week',
        kind: 'habit',
        start_value: 0,
        target_value: 3,
        current_value: 0,
        sort_order: 1000,
        created_at: '',
        updated_at: '',
      };

      // Period: 2026-10-01 (Thursday) to 2026-10-31 (Saturday)
      // Week 1 (Oct 5..11): 3 logs (met)
      // Week 2 (Oct 12..18): 3 logs (met)
      // Today: 2026-10-15 (Thursday)
      const logs: KRHabitLog[] = [
        { key_result_id: 'kr-habit', log_date: '2026-10-05', created_at: '' },
        { key_result_id: 'kr-habit', log_date: '2026-10-07', created_at: '' },
        { key_result_id: 'kr-habit', log_date: '2026-10-09', created_at: '' },
        { key_result_id: 'kr-habit', log_date: '2026-10-12', created_at: '' },
        { key_result_id: 'kr-habit', log_date: '2026-10-14', created_at: '' },
        { key_result_id: 'kr-habit', log_date: '2026-10-15', created_at: '' },
      ];

      const stats = habitStats(kr, logs, '2026-10-01', '2026-10-31', '2026-10-15');

      // Both previous week and current week met target -> streak is 2 weeks
      expect(stats.weekStreak).toBe(2);
      expect(stats.weekCount).toBe(3);
      expect(stats.periodCount).toBe(6);
    });
  });

  describe('Health, Pace, Due & List State', () => {
    it('determines objectiveHealth by worst status among key results', () => {
      const krs: KeyResult[] = [
        { id: '1', status: 'on_track' } as KeyResult,
        { id: '2', status: 'at_risk' } as KeyResult,
      ];
      expect(objectiveHealth(krs)).toBe('at_risk');

      krs.push({ id: '3', status: 'off_track' } as KeyResult);
      expect(objectiveHealth(krs)).toBe('off_track');

      expect(objectiveHealth([{ id: '4', status: null } as KeyResult])).toBeNull();
    });

    it('evaluates paceState with grace period and tolerance', () => {
      const obj: Objective = {
        id: 'obj-pace',
        title: 'Pace test',
        period_kind: 'quarter',
        period_start: '2026-10-01',
        period_end: '2026-12-31',
        cadence: 'weekly',
        status: 'active',
        created_at: '',
        updated_at: '',
      };

      // Within first 20% of period (PACE_GRACE = 0.20): not behind pace even at 0%
      const earlyPace = paceState(obj, 0, '2026-10-05');
      expect(earlyPace.isBehindPace).toBe(false);

      // Mid-period (e.g. 50% elapsed): expected ~50%.
      // If progress is 30% -> (50 - 15 = 35% threshold), 30 < 35 -> behind pace
      const midPaceBehind = paceState(obj, 30, '2026-11-15');
      expect(midPaceBehind.isBehindPace).toBe(true);

      // If progress is 40% -> 40 >= 35 -> on pace
      const midPaceOnTrack = paceState(obj, 40, '2026-11-15');
      expect(midPaceOnTrack.isBehindPace).toBe(false);
    });

    it('computes nextCheckInDate for all cadences', () => {
      expect(nextCheckInDate('2026-10-01', '2026-10-01', 'daily')).toBe('2026-10-02');
      expect(nextCheckInDate('2026-10-01', '2026-10-01', 'weekly')).toBe('2026-10-08');
      expect(nextCheckInDate('2026-10-01', '2026-10-01', 'biweekly')).toBe('2026-10-15');
      expect(nextCheckInDate('2026-10-01', '2026-10-01', 'monthly')).toBe('2026-11-01');
    });

    it('determines due and overdue state accurately', () => {
      const obj: Objective = {
        id: 'obj-due',
        title: 'Due test',
        period_kind: 'quarter',
        period_start: '2026-10-01',
        period_end: '2026-12-31',
        cadence: 'weekly',
        status: 'active',
        created_at: '',
        updated_at: '',
      };
      const krs = [{ id: 'kr-1' } as KeyResult];
      const checkIns: KRCheckIn[] = [
        { key_result_id: 'kr-1', checked_in_on: '2026-10-01' } as KRCheckIn,
      ];

      // Next due is 2026-10-08
      const beforeDue = dueInfo(obj, krs, checkIns, '2026-10-07');
      expect(beforeDue.isDue).toBe(false);
      expect(beforeDue.isOverdue).toBe(false);

      const onDueDate = dueInfo(obj, krs, checkIns, '2026-10-08');
      expect(onDueDate.isDue).toBe(true);
      expect(onDueDate.isOverdue).toBe(false);

      const overdueDate = dueInfo(obj, krs, checkIns, '2026-10-10');
      expect(overdueDate.isDue).toBe(true);
      expect(overdueDate.isOverdue).toBe(true);
      expect(overdueDate.daysOverdue).toBe(2);
    });

    it('respects objectiveListState precedence table', () => {
      const obj: Objective = {
        id: 'obj-1',
        status: 'active',
        period_start: '2026-10-01',
        period_end: '2026-12-31',
      } as Objective;

      const notDue = { isDue: false, isOverdue: false, dueDate: '', daysOverdue: 0 };
      const isDue = { isDue: true, isOverdue: false, dueDate: '', daysOverdue: 0 };
      const isOverdue = { isDue: true, isOverdue: true, dueDate: '', daysOverdue: 2 };

      // 1. Paused
      expect(objectiveListState({ ...obj, status: 'paused' }, 'off_track', true, isOverdue, '2026-10-15')).toBe('paused');

      // 2. Ended
      expect(objectiveListState(obj, 'off_track', true, isOverdue, '2027-01-01')).toBe('ended');

      // 3. Overdue
      expect(objectiveListState(obj, 'off_track', true, isOverdue, '2026-10-15')).toBe('overdue');

      // 4. Due
      expect(objectiveListState(obj, 'off_track', true, isDue, '2026-10-15')).toBe('due');

      // 5. Off track
      expect(objectiveListState(obj, 'off_track', true, notDue, '2026-10-15')).toBe('off_track');

      // 6. At risk
      expect(objectiveListState(obj, 'at_risk', true, notDue, '2026-10-15')).toBe('at_risk');

      // 7. Behind pace
      expect(objectiveListState(obj, 'on_track', true, notDue, '2026-10-15')).toBe('behind_pace');

      // 8. Normal
      expect(objectiveListState(obj, 'on_track', false, notDue, '2026-10-15')).toBeNull();
    });
  });

  describe('Validation Functions', () => {
    it('validates objective and key result payloads', () => {
      expect(() => validateObjectivePayload({ title: '' })).toThrow();
      expect(() => validateObjectivePayload({ title: 'Valid', period_start: '2026-10-10', period_end: '2026-10-01' })).toThrow();

      expect(() => validateKeyResultPayload({ title: '', kind: 'metric' })).toThrow();
      expect(() => validateKeyResultPayload({ title: 'Metric', kind: 'metric', start_value: 5, target_value: 5 })).toThrow();
      expect(() => validateKeyResultPayload({ title: 'Habit', kind: 'habit', target_value: 8 })).toThrow();
    });
  });

  describe('computeOkrMetrics', () => {
    it('computes complete metrics bundle for objectives, key results, tasks, and projects', () => {
      const obj: Objective = {
        id: 'obj-bundle',
        title: 'Bundle Objective',
        period_kind: 'quarter',
        period_start: '2026-10-01',
        period_end: '2026-12-31',
        cadence: 'weekly',
        status: 'active',
        created_at: '',
        updated_at: '',
      };

      const krMetric: KeyResult = {
        id: 'kr-m',
        objective_id: 'obj-bundle',
        title: 'Metric KR',
        kind: 'metric',
        start_value: 0,
        target_value: 100,
        current_value: 50,
        status: 'on_track',
        sort_order: 1000,
        created_at: '',
        updated_at: '',
      };

      const bundle = computeOkrMetrics({
        objectives: [obj],
        keyResults: [krMetric],
        checkIns: [],
        habitLogs: [],
        tasks: [],
        projects: [],
        todayStr: '2026-10-15',
      });

      expect(bundle.krProgressMap.get('kr-m')).toBe(50);
      expect(bundle.objectiveProgressMap.get('obj-bundle')).toBe(50);
      expect(bundle.objectiveHealthMap.get('obj-bundle')).toBe('on_track');
    });
  });
});
