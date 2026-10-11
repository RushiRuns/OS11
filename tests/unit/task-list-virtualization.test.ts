import { describe, it, expect } from 'vitest';
import { Virtualizer } from '@tanstack/virtual-core';
import {
  createTaskListVirtualizerOptions,
  computeTaskItemEstimate,
  planDrop,
  type FlattenedTaskItem,
} from '../../src/renderer/features/tasks/TaskList.js';

describe('TaskList Virtualization Regression Test', () => {
  const ROW_GAP = 4; // Compact row gap

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

  it('computes dynamic size estimates based on task contents (compact 40px base)', () => {
    // 1. Title only (compact base)
    expect(
      computeTaskItemEstimate({
        task: { notes: null } as any,
        hasSubtasks: false,
      })
    ).toBe(40);

    // 2. Title + notes (40 + 20)
    expect(
      computeTaskItemEstimate({
        task: { notes: 'Some notes' } as any,
        hasSubtasks: false,
      })
    ).toBe(60);

    // 3. Title + meta (40 + 19)
    expect(
      computeTaskItemEstimate({
        task: { notes: null, due_date: '2026-10-15' } as any,
        hasSubtasks: false,
      })
    ).toBe(59);

    // 4. Title + notes + meta (40 + 20 + 19)
    expect(
      computeTaskItemEstimate({
        task: { notes: 'Some notes', due_date: '2026-10-15' } as any,
        hasSubtasks: false,
      })
    ).toBe(79);
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
    expect(options.gap).toBe(ROW_GAP);

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
    expect(virtualItems[1].start).toBe(85 + ROW_GAP); // 89

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

    // 2. Index 1 is task-1 and start must be 40 + 4 = 44px (NO ghost gap!)
    expect(virtualItems[1].key).toBe('task-1');
    expect(virtualItems[1].start).toBe(44);
    expect(virtualItems[1].size).toBe(85);

    // 3. Index 2 is task-3 and start must be 44 + 85 + 4 = 133px (NO overlap!)
    expect(virtualItems[2].key).toBe('task-3');
    expect(virtualItems[2].start).toBe(133);
  });

  it('TC-03: prevents overlap when adjacent tasks have different dynamic heights (multi-line notes/tags)', () => {
    const items: FlattenedTaskItem[] = [
      {
        task: { id: 'task-1', title: 'Task with notes and tags', notes: 'Some note' } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
      {
        task: { id: 'task-2', title: 'Compact task', notes: null } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
    ];

    const options = createTaskListVirtualizerOptions(items, () => ({} as any));
    expect(options.gap).toBe(ROW_GAP);

    const virtualizer = new Virtualizer({
      ...createMockAdapter(),
      ...options,
    });
    virtualizer._didMount();

    // Populate initial measurements
    virtualizer.getVirtualItems();

    // Simulate task-1 having a rendered height of 68px (multi-line) and task-2 32px
    virtualizer.resizeItem(0, 68);
    virtualizer.resizeItem(1, 32);

    const virtualItems = virtualizer.getVirtualItems();
    expect(virtualItems[0].size).toBe(68);
    // Task 2 must start precisely at 68 + gap (no overlap!)
    expect(virtualItems[1].start).toBe(68 + ROW_GAP);
  });

  it('TC-04: preserves drag-and-drop insertion lineTop calculation with compact gap', () => {
    const items: FlattenedTaskItem[] = [
      {
        task: { id: 'task-1', title: 'Task 1' } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
      {
        task: { id: 'task-2', title: 'Task 2' } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
    ];

    // Case 1: Dragging from above (activeCenterY < overCenterY) -> insert before task-2
    const dropBefore = planDrop({
      items,
      activeId: 'task-1',
      overId: 'task-2',
      deltaX: 0,
      activeRect: { top: 0, height: 32 },
      overRect: { top: 34, height: 32 },
      indentPx: 28,
      rowGapPx: ROW_GAP,
    });
    expect(dropBefore).not.toBeNull();
    expect(dropBefore!.lineTop).toBe(34 - ROW_GAP / 2); // 32

    // Case 2: Dragging from below (activeCenterY > overCenterY) -> insert after task-2
    const dropAfter = planDrop({
      items,
      activeId: 'task-1',
      overId: 'task-2',
      deltaX: 0,
      activeRect: { top: 68, height: 32 },
      overRect: { top: 34, height: 32 },
      indentPx: 28,
      rowGapPx: ROW_GAP,
    });
    expect(dropAfter).not.toBeNull();
    expect(dropAfter!.lineTop).toBe(34 + 32 + ROW_GAP / 2); // 68
  });
});
