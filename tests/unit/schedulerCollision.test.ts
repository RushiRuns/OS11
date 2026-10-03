import { describe, it, expect } from 'vitest';
import { schedulerCollisionDetection } from '../../src/renderer/features/lists/scheduler/schedulerCollision.js';
import type { DroppableContainer, Active } from '@dnd-kit/core';

describe('Scheduler Collision Detection (§6.4)', () => {
  const schedulerGridRect = {
    top: 100,
    bottom: 600,
    left: 800,
    right: 1160,
    width: 360,
    height: 500,
  };

  const myDayListRect = {
    top: 100,
    bottom: 600,
    left: 240,
    right: 790,
    width: 550,
    height: 500,
  };

  const listRowRect = {
    top: 120,
    bottom: 160,
    left: 250,
    right: 780,
    width: 530,
    height: 40,
  };

  const mockContainers: DroppableContainer[] = [
    {
      id: 'scheduler-grid',
      key: 'scheduler-grid',
      data: { current: { type: 'scheduler-grid' } },
      disabled: false,
      node: { current: null },
      rect: { current: schedulerGridRect },
    },
    {
      id: 'my-day-list-drop-zone',
      key: 'my-day-list-drop-zone',
      data: { current: { type: 'my-day-list' } },
      disabled: false,
      node: { current: null },
      rect: { current: myDayListRect },
    },
    {
      id: 'task-1',
      key: 'task-1',
      data: { current: { type: 'task-row', taskId: 'task-1' } },
      disabled: false,
      node: { current: null },
      rect: { current: listRowRect },
    },
  ];

  const droppableRects = new Map<string, any>([
    ['scheduler-grid', schedulerGridRect],
    ['my-day-list-drop-zone', myDayListRect],
    ['task-1', listRowRect],
  ]);

  it('returns ONLY scheduler-grid when pointer is inside the scheduler panel grid', () => {
    const active: Active = {
      id: 'task-new',
      data: { current: { type: 'task-row', taskId: 'task-new' } },
      rect: { current: { initial: null, translated: null } },
    };

    const collisions = schedulerCollisionDetection({
      active,
      collisionRect: { top: 200, bottom: 240, left: 850, right: 1100, width: 250, height: 40 },
      droppableContainers: mockContainers,
      droppableRects,
      pointerCoordinates: { x: 900, y: 250 }, // Inside scheduler grid
    });

    expect(collisions).toHaveLength(1);
    expect(collisions[0].id).toBe('scheduler-grid');
  });

  it('returns ONLY my-day-list-drop-zone when a time-block is dragged over the My Day list', () => {
    const active: Active = {
      id: 'block:task-scheduled',
      data: { current: { type: 'time-block', taskId: 'task-scheduled' } },
      rect: { current: { initial: null, translated: null } },
    };

    const collisions = schedulerCollisionDetection({
      active,
      collisionRect: { top: 200, bottom: 240, left: 300, right: 550, width: 250, height: 40 },
      droppableContainers: mockContainers,
      droppableRects,
      pointerCoordinates: { x: 400, y: 250 }, // Inside My Day list
    });

    expect(collisions).toHaveLength(1);
    expect(collisions[0].id).toBe('my-day-list-drop-zone');
  });

  it('returns empty array when a time-block is dragged outside both grid and list (cancels drop)', () => {
    const active: Active = {
      id: 'block:task-scheduled',
      data: { current: { type: 'time-block', taskId: 'task-scheduled' } },
      rect: { current: { initial: null, translated: null } },
    };

    const collisions = schedulerCollisionDetection({
      active,
      collisionRect: { top: 20, bottom: 60, left: 50, right: 200, width: 150, height: 40 },
      droppableContainers: mockContainers,
      droppableRects,
      pointerCoordinates: { x: 50, y: 30 }, // In titlebar / outside
    });

    expect(collisions).toHaveLength(0);
  });

  it('excludes scheduler-grid and my-day-list-drop-zone when dragging a task row over the list', () => {
    const active: Active = {
      id: 'task-2',
      data: { current: { type: 'task-row', taskId: 'task-2' } },
      rect: { current: { initial: null, translated: null } },
    };

    const collisions = schedulerCollisionDetection({
      active,
      collisionRect: { top: 125, bottom: 165, left: 255, right: 775, width: 520, height: 40 },
      droppableContainers: mockContainers,
      droppableRects,
      pointerCoordinates: { x: 400, y: 140 }, // Over task-1 in list
    });

    expect(collisions.some((c) => c.id === 'scheduler-grid')).toBe(false);
    expect(collisions.some((c) => c.id === 'my-day-list-drop-zone')).toBe(false);
    expect(collisions[0].id).toBe('task-1');
  });
});
