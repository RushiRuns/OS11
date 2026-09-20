import { describe, it, expect } from 'vitest';
import { Virtualizer } from '@tanstack/virtual-core';
import {
  createTaskListVirtualizerOptions,
  computeTaskItemEstimate,
  type FlattenedTaskItem,
} from '../../src/renderer/features/tasks/TaskList.js';

describe('TaskList Virtualization Regression Test', () => {
  const createMockAdapter = () => ({
    scrollToFn: () => {},
    observeElementRect: (_instance: any, cb: (rect: any) => void) => {
      cb({ width: 500, height: 800 });
    },
    observeElementOffset: (_instance: any, cb: (offset: number, isScrolling: boolean) => void) => {
      cb(0, false);
    },
    initialRect: { width: 500, height: 800 },
  });

  it('computes dynamic size estimates based on task contents', () => {
    // 1. Title only
    expect(
      computeTaskItemEstimate({
        task: { notes: null } as any,
        hasSubtasks: false,
      })
    ).toBe(44);

    // 2. Title + notes
    expect(
      computeTaskItemEstimate({
        task: { notes: 'Some notes' } as any,
        hasSubtasks: false,
      })
    ).toBe(64);

    // 3. Title + subtasks
    expect(
      computeTaskItemEstimate({
        task: { notes: null } as any,
        hasSubtasks: true,
      })
    ).toBe(62);

    // 4. Title + notes + subtasks
    expect(
      computeTaskItemEstimate({
        task: { notes: 'Some notes' } as any,
        hasSubtasks: true,
      })
    ).toBe(82);
  });

  it('preserves item heights and prevents ghost gaps/overlaps when tasks are reordered', () => {
    // Simulate 3 tasks with different visual heights:
    // task-1: 85px (tall: notes + tag)
    // task-2: 40px (short: title only)
    // task-3: 60px (medium: notes)
    let items: FlattenedTaskItem[] = [
      {
        task: { id: 'task-1', title: 'task 1', notes: 'task 111' } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: true,
        subtaskCount: { completed: 0, total: 0 },
      },
      {
        task: { id: 'task-2', title: 'task 2', notes: null } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: true,
        subtaskCount: { completed: 0, total: 0 },
      },
      {
        task: { id: 'task-3', title: 'task 3', notes: 'task 333' } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: true,
        subtaskCount: { completed: 0, total: 0 },
      },
    ];

    const scrollElement = {} as any;
    const options = createTaskListVirtualizerOptions(items, () => scrollElement);

    const virtualizer = new Virtualizer({
      ...createMockAdapter(),
      ...options,
    });
    virtualizer._didMount();

    // Populate initial measurements
    virtualizer.getVirtualItems();

    // ResizeObserver measures exact heights
    virtualizer.resizeItem(0, 85);
    virtualizer.resizeItem(1, 40);
    virtualizer.resizeItem(2, 60);

    // Initial check
    let virtualItems = virtualizer.getVirtualItems();
    expect(virtualItems[0].key).toBe('task-1');
    expect(virtualItems[0].size).toBe(85);
    expect(virtualItems[1].key).toBe('task-2');
    expect(virtualItems[1].start).toBe(85 + 8); // 93

    // Drag & Drop action: User moves task-2 to index 0: [task-2, task-1, task-3]
    items = [items[1], items[0], items[2]];

    // Virtualizer receives updated options
    const updatedOptions = createTaskListVirtualizerOptions(items, () => scrollElement);
    virtualizer.setOptions({
      ...createMockAdapter(),
      ...updatedOptions,
    });

    virtualItems = virtualizer.getVirtualItems();

    // Expected:
    // 1. Index 0 is task-2 and size must be 40px (NOT stale 85px from index 0's previous item)
    expect(virtualItems[0].key).toBe('task-2');
    expect(virtualItems[0].size).toBe(40);

    // 2. Index 1 is task-1 and start must be 40 + 8 = 48px (NO 45px ghost gap!)
    expect(virtualItems[1].key).toBe('task-1');
    expect(virtualItems[1].start).toBe(48);
    expect(virtualItems[1].size).toBe(85);

    // 3. Index 2 is task-3 and start must be 48 + 85 + 8 = 141px (NO overlap!)
    expect(virtualItems[2].key).toBe('task-3');
    expect(virtualItems[2].start).toBe(141);
  });
});
