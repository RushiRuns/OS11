import { describe, it, expect } from 'vitest';
import {
  planDrop,
  type FlattenedTaskItem,
  INDENT_PX,
  INDENT_LINE_BASE_PADDING,
  ROW_GAP_PX,
} from '../../src/renderer/features/tasks/TaskList.js';

describe('Project View — Tree-Aware Drag and Drop & Drop Indicator', () => {
  const sampleItems: FlattenedTaskItem[] = [
    {
      task: { id: 'task-1', title: 'Parent Task', parent_task_id: null, sort_order: 1000 } as any,
      depth: 0,
      hasSubtasks: false,
      isExpanded: false,
      subtaskCount: { completed: 0, total: 0 },
    },
    {
      task: { id: 'task-2', title: 'Task to be nested', parent_task_id: null, sort_order: 2000 } as any,
      depth: 0,
      hasSubtasks: false,
      isExpanded: false,
      subtaskCount: { completed: 0, total: 0 },
    },
  ];

  it('TC-01: Reorders task without nesting when horizontal travel is zero (deltaX = 0)', () => {
    const plan = planDrop({
      items: sampleItems,
      activeId: 'task-2',
      overId: 'task-1',
      deltaX: 0,
      activeRect: { top: -10, height: 32 },
      overRect: { top: 0, height: 32 },
      indentPx: INDENT_PX,
      rowGapPx: ROW_GAP_PX,
    });

    expect(plan).not.toBeNull();
    expect(plan!.depth).toBe(0);
    expect(plan!.parentId).toBeNull();
    // Insertion line at depth 0 before task-1
    expect(plan!.lineTop).toBe(0 - ROW_GAP_PX / 2);
  });

  it('TC-02: Nests task as subtask under task-1 when dragged right (deltaX >= 28px)', () => {
    const plan = planDrop({
      items: sampleItems,
      activeId: 'task-2',
      overId: 'task-1',
      deltaX: 35, // Dragged right past 28px indent threshold
      activeRect: { top: 36, height: 32 },
      overRect: { top: 0, height: 32 },
      indentPx: INDENT_PX,
      rowGapPx: ROW_GAP_PX,
    });

    expect(plan).not.toBeNull();
    expect(plan!.depth).toBe(1);
    expect(plan!.parentId).toBe('task-1');
  });

  it('TC-03: Outdents subtask back to root when dragged left (deltaX <= -28px)', () => {
    const nestedItems: FlattenedTaskItem[] = [
      {
        task: { id: 'task-1', title: 'Parent', parent_task_id: null, sort_order: 1000 } as any,
        depth: 0,
        hasSubtasks: true,
        isExpanded: true,
        subtaskCount: { completed: 0, total: 1 },
      },
      {
        task: { id: 'sub-1', title: 'Subtask', parent_task_id: 'task-1', sort_order: 2000 } as any,
        depth: 1,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
      {
        task: { id: 'task-3', title: 'Follower', parent_task_id: null, sort_order: 3000 } as any,
        depth: 0,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
    ];

    const plan = planDrop({
      items: nestedItems,
      activeId: 'sub-1',
      overId: 'task-3',
      deltaX: -30, // Dragged left to outdent
      activeRect: { top: 36, height: 32 },
      overRect: { top: 72, height: 32 },
      indentPx: INDENT_PX,
      rowGapPx: ROW_GAP_PX,
    });

    expect(plan).not.toBeNull();
    expect(plan!.depth).toBe(0);
    expect(plan!.parentId).toBeNull();
  });

  it('TC-04: Prevents cycle when dragging parent task into its own subtask subtree', () => {
    const nestedItems: FlattenedTaskItem[] = [
      {
        task: { id: 'task-1', title: 'Parent', parent_task_id: null, sort_order: 1000 } as any,
        depth: 0,
        hasSubtasks: true,
        isExpanded: true,
        subtaskCount: { completed: 0, total: 1 },
      },
      {
        task: { id: 'sub-1', title: 'Subtask', parent_task_id: 'task-1', sort_order: 2000 } as any,
        depth: 1,
        hasSubtasks: false,
        isExpanded: false,
        subtaskCount: { completed: 0, total: 0 },
      },
    ];

    // Hovering inside the dragged row's own subtree
    const plan = planDrop({
      items: nestedItems,
      activeId: 'task-1',
      overId: 'sub-1',
      deltaX: 0,
      activeRect: { top: 0, height: 32 },
      overRect: { top: 36, height: 32 },
      indentPx: INDENT_PX,
      rowGapPx: ROW_GAP_PX,
    });

    expect(plan).toBeNull(); // Cycle prevented
  });

  it('TC-05: Dynamic blue line positioning and bullet dot coordinate math across nesting depths', () => {
    const containerRect = { left: 100, right: 600, top: 50 };

    // At depth 0
    const depth0Left = containerRect.left + INDENT_LINE_BASE_PADDING + 0 * INDENT_PX;
    const depth0BulletLeft = depth0Left - 4;
    expect(depth0Left).toBe(140);
    expect(depth0BulletLeft).toBe(136);

    // At depth 1 (subtask)
    const depth1Left = containerRect.left + INDENT_LINE_BASE_PADDING + 1 * INDENT_PX;
    const depth1BulletLeft = depth1Left - 4;
    expect(depth1Left).toBe(168);
    expect(depth1BulletLeft).toBe(164);

    // At depth 2 (nested subtask)
    const depth2Left = containerRect.left + INDENT_LINE_BASE_PADDING + 2 * INDENT_PX;
    const depth2BulletLeft = depth2Left - 4;
    expect(depth2Left).toBe(196);
    expect(depth2BulletLeft).toBe(192);
  });
});
