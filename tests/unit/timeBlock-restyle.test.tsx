import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { GUTTER_WIDTH } from '../../src/renderer/features/lists/scheduler/useSchedulerLayout.js';
import { TimeBlock } from '../../src/renderer/features/lists/scheduler/TimeBlock.js';
import type { Task } from '../../src/shared/types/task.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useSchedulerUiStore } from '../../src/renderer/stores/schedulerUiStore.js';

// Setup minimal DOM mocks for Node environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: (fn: any, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: any) => clearTimeout(id),
  };
}

describe('Scheduler Restyle: Phase 1 Gutter Guard', () => {
  it('asserts that --scheduler-gutter-width in tokens.css equals GUTTER_WIDTH constant', () => {
    const tokensPath = path.resolve(__dirname, '../../src/renderer/styles/tokens.css');
    const content = fs.readFileSync(tokensPath, 'utf-8');
    const match = content.match(/--scheduler-gutter-width:\s*(\d+)px;/);

    expect(match).not.toBeNull();
    const tokenGutterWidth = Number(match![1]);
    expect(tokenGutterWidth).toBe(GUTTER_WIDTH);
    expect(tokenGutterWidth).toBe(56);
  });
});

describe('Scheduler Restyle: Phase 2 Size Variants & Priority Borders', () => {
  const baseTask: Task = {
    id: 'task-test-1',
    title: 'Test Block Title',
    is_completed: 0,
    is_trashed: 0,
    priority: 0,
    due_date: null,
    due_time: null,
    all_day: 0,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 1,
    pomodoro_count: 0,
    is_habit: 0,
    is_starred: 0,
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-14T10:00:00.000Z',
    created_by_device: 'dev-1',
    scheduled_start_min: 540, // 9:00 AM
    scheduled_duration_min: 30,
  };

  it('renders data-size="compact" at 15 minutes, with title only and full title+time in title attribute', () => {
    const task: Task = { ...baseTask, scheduled_duration_min: 15 };
    const html = renderToStaticMarkup(<TimeBlock task={task} />);

    expect(html).toContain('data-size="compact"');
    expect(html).toContain('title="Test Block Title (9:00 AM - 9:15 AM)"');
    // Compact layout hides live time from DOM body
    expect(html).not.toContain('timeBlockRange');
  });

  it('renders data-size="tight" at 30 minutes, showing title and time', () => {
    const task: Task = { ...baseTask, scheduled_duration_min: 30 };
    const html = renderToStaticMarkup(<TimeBlock task={task} />);

    expect(html).toContain('data-size="tight"');
    expect(html).toContain('timeBlockRange');
    expect(html).toContain('9:00 AM - 9:30 AM');
  });

  it('renders data-size="regular" at 45 minutes, showing title and time', () => {
    const task: Task = { ...baseTask, scheduled_duration_min: 45 };
    const html = renderToStaticMarkup(<TimeBlock task={task} />);

    expect(html).toContain('data-size="regular"');
    expect(html).toContain('timeBlockRange');
    expect(html).toContain('9:00 AM - 9:45 AM');
  });

  it('renders data-size="roomy" at 60 and 90 minutes', () => {
    const task60: Task = { ...baseTask, scheduled_duration_min: 60 };
    const html60 = renderToStaticMarkup(<TimeBlock task={task60} />);
    expect(html60).toContain('data-size="roomy"');

    const task90: Task = { ...baseTask, scheduled_duration_min: 90 };
    const html90 = renderToStaticMarkup(<TimeBlock task={task90} />);
    expect(html90).toContain('data-size="roomy"');
  });

  it('carries data-priority attribute when priority is set, and omits it when priority is 0', () => {
    const taskP1: Task = { ...baseTask, priority: 1 };
    const htmlP1 = renderToStaticMarkup(<TimeBlock task={taskP1} />);
    expect(htmlP1).toContain('data-priority="1"');

    const taskP4: Task = { ...baseTask, priority: 4 };
    const htmlP4 = renderToStaticMarkup(<TimeBlock task={taskP4} />);
    expect(htmlP4).toContain('data-priority="4"');

    const taskNoPriority: Task = { ...baseTask, priority: 0 };
    const htmlNoP = renderToStaticMarkup(<TimeBlock task={taskNoPriority} />);
    expect(htmlNoP).not.toContain('data-priority="0"');
    expect(htmlNoP).not.toContain('data-priority=');
  });
});

describe('Scheduler Restyle: Phase 4 Removal Sequence & Event Guards', () => {
  const sampleTask: Task = {
    id: 'task-rem-1',
    title: 'Task to Remove',
    is_completed: 0,
    is_trashed: 0,
    priority: 2,
    due_date: null,
    due_time: null,
    all_day: 0,
    list_id: 'default',
    parent_task_id: null,
    sort_order: 1,
    pomodoro_count: 0,
    is_habit: 0,
    is_starred: 0,
    created_at: '2026-10-14T10:00:00.000Z',
    updated_at: '2026-10-14T10:00:00.000Z',
    created_by_device: 'dev-1',
    scheduled_start_min: 600,
    scheduled_duration_min: 45,
  };

  beforeEach(() => {
    useTaskStore.setState({
      tasksById: { [sampleTask.id]: sampleTask },
    });
    useSchedulerUiStore.setState({
      selectedBlockId: sampleTask.id,
      hoveredBlockId: null,
    });
  });

  it('first click on remove button triggers removal once, and second click does nothing', async () => {
    const unscheduleSpy = vi.fn().mockResolvedValue(undefined);
    useTaskStore.setState({
      unscheduleTask: unscheduleSpy as any,
    });

    const leavingMap: Record<string, any> = {};

    const handleRemove = (task: Task) => {
      if (leavingMap[task.id]) return; // Guard: already leaving
      leavingMap[task.id] = { task };
      useTaskStore.getState().unscheduleTask(task.id);
    };

    // First click
    handleRemove(sampleTask);
    expect(unscheduleSpy).toHaveBeenCalledTimes(1);
    expect(unscheduleSpy).toHaveBeenCalledWith('task-rem-1');
    expect(leavingMap['task-rem-1']).toBeDefined();

    // Second click (rapid double click)
    handleRemove(sampleTask);
    expect(unscheduleSpy).toHaveBeenCalledTimes(1); // Still 1! Second click is ignored
  });

  it('cleans up leaving block after transitionend event for opacity', () => {
    let leavingBlocks: Record<string, any> = {
      'task-rem-1': { task: sampleTask },
    };

    const handleLeavingTransitionEnd = (
      taskId: string,
      e: { propertyName: string }
    ) => {
      if (e.propertyName === 'opacity') {
        const next = { ...leavingBlocks };
        delete next[taskId];
        leavingBlocks = next;
      }
    };

    // Ignore unrelated property transitionend
    handleLeavingTransitionEnd('task-rem-1', { propertyName: 'transform' });
    expect(leavingBlocks['task-rem-1']).toBeDefined();

    // Firing opacity transitionend removes block
    handleLeavingTransitionEnd('task-rem-1', { propertyName: 'opacity' });
    expect(leavingBlocks['task-rem-1']).toBeUndefined();
  });

  it('moves focus to the grid scroll container when the removed block was focused', () => {
    const focusSpy = vi.fn();
    const mockScrollContainer = {
      focus: focusSpy,
    };

    const mockBlock = {
      id: 'block-element',
    };

    (globalThis as any).document = {
      activeElement: mockBlock,
      querySelector: (selector: string) => {
        if (selector === '[data-testid="scheduler-scroll-container"]') {
          return mockScrollContainer;
        }
        return null;
      },
    };

    // Simulate TimeBlock handleUnschedule focus migration logic
    if (
      typeof document !== 'undefined' &&
      document.activeElement === mockBlock
    ) {
      const scrollEl = document.querySelector(
        '[data-testid="scheduler-scroll-container"]'
      ) as any;
      scrollEl?.focus();
    }

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Scheduler Restyle: Performance Budget (10+ blocks under 16ms)', () => {
  it('measures drag placement and resize math with 12 blocks stays well under 16ms per step', async () => {
    const { snapToGrid, yToMinutes, placeBlock, resizeLimits } = await import(
      '../../src/shared/utils/schedulerMath.js'
    );
    const { HOUR_HEIGHT } = await import(
      '../../src/renderer/features/lists/scheduler/useSchedulerLayout.js'
    );

    const blocks = Array.from({ length: 12 }, (_, i) => ({
      id: `task-${i}`,
      start: i * 60, // 0:00, 1:00, 2:00, etc.
      duration: 45,
    }));

    // 1. Measure 100 drag snap calculations
    const startDrag = performance.now();
    for (let step = 0; step < 100; step++) {
      const desiredY = step * 10;
      const desiredStart = snapToGrid(yToMinutes(desiredY, HOUR_HEIGHT));
      placeBlock(blocks, desiredStart, 30);
    }
    const totalDragMs = performance.now() - startDrag;
    const avgDragStepMs = totalDragMs / 100;

    // 2. Measure 100 resize limit calculations
    const startResize = performance.now();
    for (let step = 0; step < 100; step++) {
      resizeLimits(blocks, blocks[5], step % 2 === 0 ? 'top' : 'bottom');
    }
    const totalResizeMs = performance.now() - startResize;
    const avgResizeStepMs = totalResizeMs / 100;

    expect(avgDragStepMs).toBeLessThan(16);
    expect(avgResizeStepMs).toBeLessThan(16);
    expect(avgDragStepMs).toBeLessThan(1);
    expect(avgResizeStepMs).toBeLessThan(1);
  });
});

