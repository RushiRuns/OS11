import { describe, it, expect } from 'vitest';
import {
  applySchedulingTransition,
  createDefaultSchedulingState,
  isActionable,
  isWaiting,
  isSomeday,
  isAnytime,
  isUntriaged,
  isFollowUpDue,
  isFollowUpOverdue,
} from '../../src/main/domain/scheduling.js';
import type { SchedulingState } from '../../src/shared/types/Scheduling.js';

describe('Domain: Scheduling State Machine & Transitions', () => {
  it('creates clean default scheduling state', () => {
    const s = createDefaultSchedulingState();
    expect(s.bucket).toBeNull();
    expect(s.dueDate).toBeNull();
    expect(s.dueTime).toBeNull();
    expect(s.waitingOn).toBeNull();
    expect(s.waitingSince).toBeNull();
  });

  describe('R2: Date and Bucket Mutual Exclusivity', () => {
    it('clears existing bucket when setting a date', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'anytime',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_DATE',
        dueDate: '2026-10-15',
        dueTime: '10:00:00',
      });
      expect(nextState.dueDate).toBe('2026-10-15');
      expect(nextState.dueTime).toBe('10:00:00');
      expect(nextState.bucket).toBeNull();
      expect(effects.clearBucket).toBe(true);
    });

    it('clears existing date and cancels reminders when setting Anytime bucket', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        dueDate: '2026-10-15',
        dueTime: '14:30:00',
        recurrenceRule: 'RRULE:FREQ=DAILY',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_BUCKET',
        bucket: 'anytime',
      });
      expect(nextState.bucket).toBe('anytime');
      expect(nextState.dueDate).toBeNull();
      expect(nextState.dueTime).toBeNull();
      expect(nextState.recurrenceRule).toBeNull();
      expect(effects.clearDate).toBe(true);
      expect(effects.cancelReminders).toBe(true);
    });

    it('clears existing date and cancels reminders when setting Someday bucket', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        dueDate: '2026-10-15',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_BUCKET',
        bucket: 'someday',
      });
      expect(nextState.bucket).toBe('someday');
      expect(nextState.dueDate).toBeNull();
      expect(effects.clearDate).toBe(true);
      expect(effects.cancelReminders).toBe(true);
    });
  });

  describe('R3: Waiting and Someday Mutual Exclusivity', () => {
    it('clears waiting fields when setting Someday bucket', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        waitingOn: 'Alice',
        waitingSince: '2026-10-01T12:00:00.000Z',
        followUpDate: '2026-10-08',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_BUCKET',
        bucket: 'someday',
      });
      expect(nextState.bucket).toBe('someday');
      expect(nextState.waitingOn).toBeNull();
      expect(nextState.waitingSince).toBeNull();
      expect(nextState.followUpDate).toBeNull();
      expect(effects.clearWaiting).toBe(true);
      expect(effects.cancelReminders).toBe(true);
    });

    it('clears Someday bucket when setting Waiting', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'someday',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_WAITING',
        waitingOn: 'Bob for review',
        followUpDate: '2026-10-10',
      }, { today: '2026-10-04' });
      expect(nextState.bucket).toBeNull();
      expect(nextState.waitingOn).toBe('Bob for review');
      expect(nextState.waitingSince).toBe('2026-10-04T00:00:00.000Z');
      expect(nextState.followUpDate).toBe('2026-10-10');
      expect(effects.clearBucket).toBe(true);
    });

    it('preserves Anytime bucket when setting Waiting (AnytimeWaiting is valid overlay)', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'anytime',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_WAITING',
        waitingOn: 'Contractor',
      });
      expect(nextState.bucket).toBe('anytime');
      expect(nextState.waitingOn).toBe('Contractor');
      expect(effects.clearBucket).toBe(false);
    });

    it('preserves Scheduled date when setting Waiting (ScheduledWaiting is valid overlay)', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        dueDate: '2026-10-20',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'SET_WAITING',
        waitingOn: 'Client response',
      });
      expect(nextState.dueDate).toBe('2026-10-20');
      expect(nextState.waitingOn).toBe('Client response');
      expect(effects.clearDate).toBe(false);
    });
  });

  describe('Someday & Review Transitions', () => {
    it('promotes Someday task to Anytime on ADD_TO_MY_DAY', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'someday',
      };
      const { nextState } = applySchedulingTransition(state, {
        type: 'ADD_TO_MY_DAY',
      });
      expect(nextState.bucket).toBe('anytime');
    });

    it('marks reviewedAt on MARK_SOMEDAY_REVIEWED', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'someday',
      };
      const { nextState } = applySchedulingTransition(state, {
        type: 'MARK_SOMEDAY_REVIEWED',
        reviewedAt: '2026-10-04T12:00:00.000Z',
      });
      expect(nextState.reviewedAt).toBe('2026-10-04T12:00:00.000Z');
    });
  });

  describe('Clear Commands', () => {
    it('clears date on CLEAR_DATE and flags reminders cancellation', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        dueDate: '2026-10-10',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'CLEAR_DATE',
      });
      expect(nextState.dueDate).toBeNull();
      expect(effects.clearDate).toBe(true);
      expect(effects.cancelReminders).toBe(true);
    });

    it('clears bucket on CLEAR_BUCKET', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        bucket: 'anytime',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'CLEAR_BUCKET',
      });
      expect(nextState.bucket).toBeNull();
      expect(effects.clearBucket).toBe(true);
    });

    it('clears waiting on CLEAR_WAITING', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        waitingOn: 'Someone',
        waitingSince: '2026-10-01',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'CLEAR_WAITING',
      });
      expect(nextState.waitingOn).toBeNull();
      expect(nextState.waitingSince).toBeNull();
      expect(effects.clearWaiting).toBe(true);
    });

    it('clears waiting on COMPLETE_TASK if autoClearWaiting is true', () => {
      const state: SchedulingState = {
        ...createDefaultSchedulingState(),
        waitingOn: 'Someone',
        waitingSince: '2026-10-01',
      };
      const { nextState, effects } = applySchedulingTransition(state, {
        type: 'COMPLETE_TASK',
        autoClearWaiting: true,
      });
      expect(nextState.waitingOn).toBeNull();
      expect(effects.clearWaiting).toBe(true);
    });
  });

  describe('Pure Predicates', () => {
    it('isActionable: true for undated or anytime tasks not waiting; false for someday or waiting', () => {
      expect(isActionable({ bucket: null, waitingSince: null })).toBe(true);
      expect(isActionable({ bucket: 'anytime', waitingSince: null })).toBe(true);
      expect(isActionable({ bucket: 'someday', waitingSince: null })).toBe(false);
      expect(isActionable({ bucket: 'anytime', waitingSince: '2026-10-01' })).toBe(false);
      expect(isActionable({ bucket: null, waitingSince: '2026-10-01' })).toBe(false);
    });

    it('isWaiting: true when both waitingSince and waitingOn are present', () => {
      expect(isWaiting({ waitingSince: '2026-10-01', waitingOn: 'Alice' })).toBe(true);
      expect(isWaiting({ waitingSince: '2026-10-01', waitingOn: null })).toBe(false);
      expect(isWaiting({ waitingSince: null, waitingOn: 'Alice' })).toBe(false);
      expect(isWaiting({})).toBe(false);
    });

    it('isSomeday and isAnytime check bucket', () => {
      expect(isSomeday({ bucket: 'someday' })).toBe(true);
      expect(isSomeday({ bucket: 'anytime' })).toBe(false);
      expect(isAnytime({ bucket: 'anytime' })).toBe(true);
      expect(isAnytime({ bucket: 'someday' })).toBe(false);
    });

    it('isUntriaged: checks that task has no container, no parent, no date, no bucket, not waiting', () => {
      expect(isUntriaged({
        area_id: null,
        project_id: null,
        parent_task_id: null,
        due_date: null,
        bucket: null,
        waiting_since: null,
      })).toBe(true);

      expect(isUntriaged({
        area_id: 'area_1',
        project_id: null,
        parent_task_id: null,
        due_date: null,
        bucket: null,
        waiting_since: null,
      })).toBe(false);

      expect(isUntriaged({
        area_id: null,
        project_id: null,
        parent_task_id: null,
        due_date: '2026-10-10',
        bucket: null,
        waiting_since: null,
      })).toBe(false);

      expect(isUntriaged({
        area_id: null,
        project_id: null,
        parent_task_id: null,
        due_date: null,
        bucket: 'anytime',
        waiting_since: null,
      })).toBe(false);
    });

    it('isFollowUpDue and isFollowUpOverdue', () => {
      const today = '2026-10-04';
      expect(isFollowUpDue('2026-10-04', today)).toBe(true); // due today
      expect(isFollowUpDue('2026-10-03', today)).toBe(true); // overdue
      expect(isFollowUpDue('2026-10-05', today)).toBe(false); // future

      expect(isFollowUpOverdue('2026-10-04', today)).toBe(false); // due today is not overdue
      expect(isFollowUpOverdue('2026-10-03', today)).toBe(true); // overdue
      expect(isFollowUpOverdue('2026-10-05', today)).toBe(false); // future
    });
  });
});
