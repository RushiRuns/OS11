import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import type { Task } from '../../src/shared/types/task.js';

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

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
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
    useLayoutEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
  };
});

const mockUpdateTask = vi.fn();
vi.mock('../../src/renderer/stores/taskStore.js', () => ({
  useTaskStore: (selector: (state: any) => any) => {
    const fakeState = {
      updateTask: mockUpdateTask,
      setBucket: vi.fn(),
      setWaiting: vi.fn(),
      clearWaiting: vi.fn(),
      unscheduleTask: vi.fn(),
      updateTimeBlock: vi.fn(),
      tasksById: {},
    };
    return selector ? selector(fakeState) : fakeState;
  },
}));

vi.mock('../../src/renderer/stores/areaStore.js', () => ({
  useAreaStore: (selector: (state: any) => any) => {
    const fakeState = { orderedAreaIds: [], areasById: {} };
    return selector ? selector(fakeState) : fakeState;
  },
}));

vi.mock('../../src/renderer/stores/projectStore.js', () => ({
  useProjectStore: (selector: (state: any) => any) => {
    const fakeState = { projectsById: {} };
    return selector ? selector(fakeState) : fakeState;
  },
}));

vi.mock('../../src/renderer/stores/moduleStore.js', () => ({
  useModuleStore: () => () => false,
}));

vi.mock('../../src/renderer/stores/pomodoroStore.js', () => ({
  usePomodoroStore: { getState: () => ({ startSession: vi.fn() }) },
}));

vi.mock('../../src/renderer/stores/app-store.js', () => ({
  useAppStore: { getState: () => ({ activeListId: 'smart_my_day' }) },
}));

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn(),
}));

import { TaskContextMenu } from '../../src/renderer/features/tasks/TaskContextMenu.js';

function findButtonByLabel(element: React.ReactElement, labelText: string): React.ReactElement | null {
  const queue: any[] = [element];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !React.isValidElement(current)) continue;
    const props = current.props as Record<string, any>;
    if (current.type === 'button') {
      const textMatches = JSON.stringify(props).includes(labelText);
      if (textMatches) return current;
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

describe('TaskContextMenu "Add to My Day" regression tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateIndex = 0;
    states = [];
    effects = [];
  });

  const baseTask: Task = {
    id: 'task-test-1',
    title: 'Test Task in Area/Anytime/Someday/Planned',
    notes: '',
    is_completed: 0,
    is_starred: 0,
    priority: 0,
    due_date: null,
    due_time: null,
    all_day: 0,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 1,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-10-13T12:00:00.000Z',
    updated_at: '2026-10-13T12:00:00.000Z',
    created_by_device: 'test',
    scheduled_start_min: null,
    scheduled_duration_min: null,
    my_day_date: null,
  };

  it('Case 1: updates task with today date when onToggleMyDay is omitted (Area, Planned, Anytime, Someday views)', async () => {
    stateIndex = 0;
    effects = [];
    const onClose = vi.fn();

    // In AreaView, PlannedTimeline, AnytimeView, SomedayView: onToggleMyDay is omitted
    const element = TaskContextMenu({
      task: { ...baseTask, my_day_date: null },
      position: { x: 100, y: 100 },
      onClose,
    });

    expect(element).not.toBeNull();
    const myDayBtn = findButtonByLabel(element!, 'Add to My Day');
    expect(myDayBtn).not.toBeNull();

    // Click "Add to My Day"
    await myDayBtn!.props.onClick();

    const today = new Date().toISOString().split('T')[0];
    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: 'task-test-1',
      my_day_date: today,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Case 2: removes task from My Day when task is already in My Day and onToggleMyDay is omitted', async () => {
    stateIndex = 0;
    effects = [];
    const onClose = vi.fn();
    const today = new Date().toISOString().split('T')[0];

    const element = TaskContextMenu({
      task: { ...baseTask, my_day_date: today },
      position: { x: 100, y: 100 },
      onClose,
    });

    expect(element).not.toBeNull();
    const removeBtn = findButtonByLabel(element!, 'Remove from My Day');
    expect(removeBtn).not.toBeNull();

    // Click "Remove from My Day"
    await removeBtn!.props.onClick();

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: 'task-test-1',
      my_day_date: null,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('Case 3: respects caller-provided onToggleMyDay when passed', async () => {
    stateIndex = 0;
    effects = [];
    const onClose = vi.fn();
    const customToggleMyDay = vi.fn();

    const element = TaskContextMenu({
      task: { ...baseTask, my_day_date: null },
      position: { x: 100, y: 100 },
      onClose,
      onToggleMyDay: customToggleMyDay,
    });

    expect(element).not.toBeNull();
    const myDayBtn = findButtonByLabel(element!, 'Add to My Day');
    expect(myDayBtn).not.toBeNull();

    await myDayBtn!.props.onClick();

    expect(customToggleMyDay).toHaveBeenCalledWith('task-test-1');
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
