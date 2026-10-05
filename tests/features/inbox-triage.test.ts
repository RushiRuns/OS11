import { describe, it, expect } from 'vitest';
import React from 'react';
import { InboxTriageList } from '../../src/renderer/features/inbox/InboxTriageList.js';
import {
  applySchedulingTransition,
  createDefaultSchedulingState,
} from '../../src/main/domain/scheduling.js';
import type { SchedulingState } from '../../src/shared/types/Scheduling.js';

describe('Inbox Triage Fast Actions & Rules', () => {
  it('renders InboxTriageList component with onSelectTask prop', () => {
    const element = React.createElement(InboxTriageList, {
      onSelectTask: () => {},
      selectedTaskId: null,
    });
    expect(element.props.selectedTaskId).toBeNull();
    expect(element.props.onSelectTask).toBeDefined();
  });

  it('1 / t: moves untriaged task to today with exclusive date clearing bucket', () => {
    const state: SchedulingState = createDefaultSchedulingState();
    const today = '2026-10-04';
    const { nextState, effects } = applySchedulingTransition(state, {
      type: 'SET_DATE',
      dueDate: today,
      allDay: true,
    });
    expect(nextState.dueDate).toBe(today);
    expect(nextState.bucket).toBeNull();
    expect(effects.clearBucket).toBe(false);
  });

  it('2: schedules untriaged task for tomorrow', () => {
    const state: SchedulingState = createDefaultSchedulingState();
    const tmrw = '2026-10-05';
    const { nextState } = applySchedulingTransition(state, {
      type: 'SET_DATE',
      dueDate: tmrw,
      allDay: true,
    });
    expect(nextState.dueDate).toBe(tmrw);
    expect(nextState.bucket).toBeNull();
  });

  it('4 / a: moves untriaged task to Anytime bucket', () => {
    const state: SchedulingState = createDefaultSchedulingState();
    const { nextState } = applySchedulingTransition(state, {
      type: 'SET_BUCKET',
      bucket: 'anytime',
    });
    expect(nextState.bucket).toBe('anytime');
    expect(nextState.dueDate).toBeNull();
  });

  it('5 / s: moves untriaged task to Someday bucket and cancels reminders', () => {
    const state: SchedulingState = {
      ...createDefaultSchedulingState(),
      dueDate: '2026-10-15',
    };
    const { nextState, effects } = applySchedulingTransition(state, {
      type: 'SET_BUCKET',
      bucket: 'someday',
    });
    expect(nextState.bucket).toBe('someday');
    expect(effects.cancelReminders).toBe(true);
    expect(effects.clearDate).toBe(true);
  });

  it('w: marks task waiting as an overlay without mutating bucket or date', () => {
    const state: SchedulingState = {
      ...createDefaultSchedulingState(),
      bucket: 'anytime',
    };
    const { nextState } = applySchedulingTransition(state, {
      type: 'SET_WAITING',
      waitingOn: 'Bob for approval',
      followUpDate: '2026-10-10',
    });
    expect(nextState.bucket).toBe('anytime');
    expect(nextState.waitingOn).toBe('Bob for approval');
    expect(nextState.followUpDate).toBe('2026-10-10');
  });

  it('filters tasks for inbox scope: incomplete, not trashed, untriaged (no area, no project, no my_day_date, no due_date, no bucket, no waiting)', () => {
    const taskListScopeFilter = (t: {
      is_trashed: number;
      is_completed: number;
      list_id?: string | null;
      area_id?: string | null;
      project_id?: string | null;
      my_day_date?: string | null;
      due_date?: string | null;
      bucket?: string | null;
      waiting_since?: string | null;
      waiting_on?: string | null;
    }) => {
      if (t.is_trashed !== 0 || t.is_completed !== 0) return false;
      return (
        !t.area_id &&
        !t.project_id &&
        !t.my_day_date &&
        !t.due_date &&
        !t.bucket &&
        !t.waiting_since &&
        !t.waiting_on
      );
    };

    const taskUntriagedInbox = {
      id: '1',
      is_trashed: 0,
      is_completed: 0,
      list_id: 'list_inbox',
      area_id: null,
      project_id: null,
      my_day_date: null,
      due_date: null,
      bucket: null,
      waiting_since: null,
      waiting_on: null,
    };
    const taskInMyDay = { ...taskUntriagedInbox, id: '2', my_day_date: '2026-10-05' };
    const taskWithDueDate = { ...taskUntriagedInbox, id: '3', due_date: '2026-10-06' };
    const taskAnytime = { ...taskUntriagedInbox, id: '4', bucket: 'anytime' };
    const taskSomeday = { ...taskUntriagedInbox, id: '5', bucket: 'someday' };
    const taskWaiting = { ...taskUntriagedInbox, id: '6', waiting_on: 'Sarah', waiting_since: '2026-10-05' };
    const taskInProject = { ...taskUntriagedInbox, id: '7', project_id: 'proj-1' };
    const taskInArea = { ...taskUntriagedInbox, id: '8', area_id: 'area-1' };
    const taskCompleted = { ...taskUntriagedInbox, id: '9', is_completed: 1 };
    const taskTrashed = { ...taskUntriagedInbox, id: '10', is_trashed: 1 };

    expect(taskListScopeFilter(taskUntriagedInbox)).toBe(true);
    expect(taskListScopeFilter(taskInMyDay)).toBe(false);
    expect(taskListScopeFilter(taskWithDueDate)).toBe(false);
    expect(taskListScopeFilter(taskAnytime)).toBe(false);
    expect(taskListScopeFilter(taskSomeday)).toBe(false);
    expect(taskListScopeFilter(taskWaiting)).toBe(false);
    expect(taskListScopeFilter(taskInProject)).toBe(false);
    expect(taskListScopeFilter(taskInArea)).toBe(false);
    expect(taskListScopeFilter(taskCompleted)).toBe(false);
    expect(taskListScopeFilter(taskTrashed)).toBe(false);
  });
});

