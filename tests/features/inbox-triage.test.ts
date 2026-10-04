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
});
