import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import type { ActivePomodoroSession } from '../../src/shared/types/index.js';

let ipcListener: ((event: unknown, payload: unknown) => void) | null = null;
const mockInvoke = vi.fn().mockResolvedValue({ ok: true, data: true });

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  ipc: {
    on: (channel: string, handler: (event: unknown, payload: unknown) => void) => {
      if (channel === 'pomodoro:state-update') {
        ipcListener = handler;
      }
      return () => {
        ipcListener = null;
      };
    },
    invoke: (...args: unknown[]) => mockInvoke(...args),
  },
}));

let stateIndex = 0;
let states: unknown[] = [];
let effects: (() => void | (() => void))[] = [];

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: unknown) => {
      const idx = stateIndex++;
      if (states[idx] === undefined) {
        states[idx] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setter = (val: unknown) => {
        states[idx] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(states[idx]) : val;
      };
      return [states[idx], setter];
    },
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
  };
});

// Import MiniTimerView after react & ipc mocks are configured
import { MiniTimerView } from '../../src/renderer/features/pomodoro/MiniTimerView.js';

function renderMiniTimer() {
  stateIndex = 0;
  effects = [];
  const element = MiniTimerView();
  effects.forEach((eff) => eff());
  return element;
}

function findButtonByTitle(element: React.ReactElement, title: string): React.ReactElement | null {
  const queue: React.ReactElement[] = [element];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !React.isValidElement(current)) continue;
    const props = current.props as Record<string, unknown>;
    if (props?.title === title) {
      return current;
    }
    if (props?.children) {
      const children = Array.isArray(props.children)
        ? props.children
        : [props.children];
      for (const child of children) {
        if (React.isValidElement(child)) {
          queue.push(child);
        }
      }
    }
  }
  return null;
}

describe('MiniTimerView Reset Behavior (Regression Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcListener = null;
    stateIndex = 0;
    states = [];
    effects = [];
  });

  it('Case 1: resets timer display to 25:00 when reset is clicked in mini window', async () => {
    // 1. Initial render
    let view = renderMiniTimer();
    expect(states[1]).toBe('25:00'); // Initial timeText is 25:00

    // 2. Simulate timer running at 24:15
    const activeSession: ActivePomodoroSession = {
      id: 'session-123',
      taskId: null,
      type: 'work',
      durationSeconds: 1500,
      elapsedSeconds: 45,
      isPaused: false,
    };
    ipcListener?.({}, { activeSession, timeText: '24:15' });
    view = renderMiniTimer();
    expect(states[1]).toBe('24:15');

    // 3. User clicks reset button in mini window
    const resetBtn = findButtonByTitle(view, 'Close / Reset');
    expect(resetBtn).not.toBeNull();
    await resetBtn!.props.onClick();

    // The remote action invokes IPC reset
    expect(mockInvoke).toHaveBeenCalledWith('pomodoro:action', 'reset');

    // 4. Main process syncs reset state (activeSession: null, timeText: null)
    ipcListener?.({}, { activeSession: null, timeText: null });
    view = renderMiniTimer();

    // 5. Mini window must reset to 25:00 and not freeze at 24:15
    expect(states[1]).toBe('25:00');
  });

  it('Case 2: resets timer display to 25:00 when reset is clicked in main view', () => {
    // 1. Initial render
    let view = renderMiniTimer();
    expect(states[1]).toBe('25:00');

    // 2. Simulate timer running at 21:30
    const activeSession: ActivePomodoroSession = {
      id: 'session-456',
      taskId: null,
      type: 'work',
      durationSeconds: 1500,
      elapsedSeconds: 210,
      isPaused: false,
    };
    ipcListener?.({}, { activeSession, timeText: '21:30' });
    view = renderMiniTimer();
    expect(states[1]).toBe('21:30');

    // 3. User clicked reset in main view -> main process sends activeSession: null, timeText: null
    ipcListener?.({}, { activeSession: null, timeText: null });
    view = renderMiniTimer();

    // 4. Mini window must reset to 25:00 and not freeze at 21:30
    expect(view).toBeDefined();
    expect(states[1]).toBe('25:00');
  });
});
