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

function findElementByProp(
  element: React.ReactElement,
  propName: string,
  propVal: string
): React.ReactElement | null {
  const queue: React.ReactElement[] = [element];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !React.isValidElement(current)) continue;
    const props = current.props as Record<string, unknown>;
    if (props?.[propName] === propVal) {
      return current;
    }
    if (props?.children) {
      const children = Array.isArray(props.children) ? props.children : [props.children];
      for (const child of children) {
        if (React.isValidElement(child)) {
          queue.push(child);
        }
      }
    }
  }
  return null;
}

function findTextInElement(element: React.ReactElement, text: string): boolean {
  const queue: React.ReactElement[] = [element];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !React.isValidElement(current)) continue;
    const props = current.props as Record<string, unknown>;
    if (props?.children) {
      if (typeof props.children === 'string' && props.children.includes(text)) {
        return true;
      }
      const children = Array.isArray(props.children) ? props.children : [props.children];
      for (const child of children) {
        if (typeof child === 'string' && child.includes(text)) {
          return true;
        }
        if (React.isValidElement(child)) {
          queue.push(child);
        }
      }
    }
  }
  return false;
}

describe('MiniTimerView: Task Title & Complete Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcListener = null;
    stateIndex = 0;
    states = [];
    effects = [];
  });

  it('renders task title without wrapping when a task is linked to the session', () => {
    renderMiniTimer();

    const activeSession: ActivePomodoroSession = {
      id: 'session-1',
      taskId: 'task-101',
      type: 'work',
      durationSeconds: 1500,
      elapsedSeconds: 30,
      isPaused: false,
    };

    ipcListener?.(
      {},
      {
        activeSession,
        timeText: '24:30',
        taskTitle: 'A very long task title that must not wrap across multiple lines in mini window',
        sourceView: 'smart_my_day',
      }
    );

    const view = renderMiniTimer();
    const titleNode = findElementByProp(
      view,
      'title',
      'A very long task title that must not wrap across multiple lines in mini window'
    );
    expect(titleNode).not.toBeNull();
  });

  it('displays placeholder "No task linked" when no task is linked to the session', () => {
    const view = renderMiniTimer();
    expect(findTextInElement(view, 'No task linked')).toBe(true);
  });

  it('invokes "complete" action over IPC when Complete button is clicked', async () => {
    const activeSession: ActivePomodoroSession = {
      id: 'session-2',
      taskId: 'task-102',
      type: 'work',
      durationSeconds: 1500,
      elapsedSeconds: 10,
      isPaused: false,
    };

    renderMiniTimer();

    ipcListener?.(
      {},
      {
        activeSession,
        timeText: '24:50',
        taskTitle: 'Deploy production release',
        sourceView: 'smart_my_day',
      }
    );

    const view = renderMiniTimer();
    const completeBtn = findElementByProp(view, 'title', 'Complete Task');
    expect(completeBtn).not.toBeNull();

    await completeBtn!.props.onClick();

    expect(mockInvoke).toHaveBeenCalledWith('pomodoro:action', 'complete');
  });

  it('clears task title when timer session resets', () => {
    renderMiniTimer();

    // 1. Session with task
    const activeSession: ActivePomodoroSession = {
      id: 'session-3',
      taskId: 'task-103',
      type: 'work',
      durationSeconds: 1500,
      elapsedSeconds: 10,
      isPaused: false,
    };
    ipcListener?.(
      {},
      {
        activeSession,
        timeText: '24:50',
        taskTitle: 'Temporary Task Title',
        sourceView: 'smart_my_day',
      }
    );
    let view = renderMiniTimer();
    expect(findElementByProp(view, 'title', 'Temporary Task Title')).not.toBeNull();

    // 2. Reset
    ipcListener?.(
      {},
      {
        activeSession: null,
        timeText: null,
        taskTitle: null,
      }
    );
    view = renderMiniTimer();
    expect(findElementByProp(view, 'title', 'Temporary Task Title')).toBeNull();
    expect(findTextInElement(view, 'No task linked')).toBe(true);
  });
});
