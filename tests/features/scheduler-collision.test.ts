import { describe, it, expect } from 'vitest';
import { schedulerCollisionDetection } from '../../src/renderer/features/lists/scheduler/schedulerCollision.js';
import type { DroppableContainer, CollisionDetection } from '@dnd-kit/core';

type RectMap = Parameters<CollisionDetection>[0]['droppableRects'];

describe('schedulerCollisionDetection', () => {
  const schedulerContainer: DroppableContainer = {
    id: 'scheduler-grid',
    key: 'scheduler-grid',
    data: { current: { type: 'scheduler-grid' } },
    disabled: false,
    node: { current: null },
    rect: {
      current: {
        top: 100,
        bottom: 800,
        left: 600,
        right: 960,
        width: 360,
        height: 700,
      },
    },
  };

  const listContainer: DroppableContainer = {
    id: 'my-day-list-drop-zone',
    key: 'my-day-list-drop-zone',
    data: { current: { type: 'my-day-list' } },
    disabled: false,
    node: { current: null },
    rect: {
      current: {
        top: 100,
        bottom: 800,
        left: 200,
        right: 600,
        width: 400,
        height: 700,
      },
    },
  };

  const taskRowContainer: DroppableContainer = {
    id: 'task-row-1',
    key: 'task-row-1',
    data: { current: { type: 'task-row' } },
    disabled: false,
    node: { current: null },
    rect: {
      current: {
        top: 150,
        bottom: 200,
        left: 200,
        right: 600,
        width: 400,
        height: 50,
      },
    },
  };

  const droppableContainers = [schedulerContainer, listContainer, taskRowContainer];

  const droppableRects: RectMap = new Map([
    [
      'scheduler-grid',
      { top: 100, bottom: 800, left: 600, right: 960, width: 360, height: 700 },
    ],
    [
      'my-day-list-drop-zone',
      { top: 100, bottom: 800, left: 200, right: 600, width: 400, height: 700 },
    ],
    [
      'task-row-1',
      { top: 150, bottom: 200, left: 200, right: 600, width: 400, height: 50 },
    ],
  ]);

  it('returns scheduler-grid when pointer is inside the scheduler area (task drag)', () => {
    const collisions = schedulerCollisionDetection({
      active: {
        id: 'task-row-1',
        data: { current: { type: 'task' } },
        rect: { current: { initial: null, translated: null } },
      } as any,
      collisionRect: { top: 200, bottom: 250, left: 700, right: 900, width: 200, height: 50 },
      droppableContainers,
      droppableRects,
      pointerCoordinates: { x: 750, y: 300 },
    });

    expect(collisions).toHaveLength(1);
    expect(collisions[0].id).toBe('scheduler-grid');
  });

  it('returns scheduler-grid when pointer is inside the scheduler area (time block drag)', () => {
    const collisions = schedulerCollisionDetection({
      active: {
        id: 'block:task-1',
        data: { current: { type: 'time-block', taskId: 'task-1' } },
        rect: { current: { initial: null, translated: null } },
      } as any,
      collisionRect: { top: 200, bottom: 250, left: 700, right: 900, width: 200, height: 50 },
      droppableContainers,
      droppableRects,
      pointerCoordinates: { x: 700, y: 250 },
    });

    expect(collisions).toHaveLength(1);
    expect(collisions[0].id).toBe('scheduler-grid');
  });

  it('returns my-day-list-drop-zone when time block is dragged over the task list', () => {
    const collisions = schedulerCollisionDetection({
      active: {
        id: 'block:task-1',
        data: { current: { type: 'time-block', taskId: 'task-1' } },
        rect: { current: { initial: null, translated: null } },
      } as any,
      collisionRect: { top: 200, bottom: 250, left: 300, right: 500, width: 200, height: 50 },
      droppableContainers,
      droppableRects,
      pointerCoordinates: { x: 350, y: 300 },
    });

    expect(collisions).toHaveLength(1);
    expect(collisions[0].id).toBe('my-day-list-drop-zone');
  });

  it('returns empty array when time block is dragged outside both grid and list (suppresses nesting/reorder)', () => {
    const collisions = schedulerCollisionDetection({
      active: {
        id: 'block:task-1',
        data: { current: { type: 'time-block', taskId: 'task-1' } },
        rect: { current: { initial: null, translated: null } },
      } as any,
      collisionRect: { top: 50, bottom: 80, left: 50, right: 150, width: 100, height: 30 },
      droppableContainers,
      droppableRects,
      pointerCoordinates: { x: 80, y: 60 },
    });

    expect(collisions).toEqual([]);
  });

  it('delegates to closestCenter excluding scheduler-grid when normal task row is dragged over list', () => {
    const collisions = schedulerCollisionDetection({
      active: {
        id: 'task-row-2',
        data: { current: { type: 'task' } },
        rect: { current: { initial: null, translated: null } },
      } as any,
      collisionRect: { top: 160, bottom: 190, left: 250, right: 450, width: 200, height: 30 },
      droppableContainers,
      droppableRects,
      pointerCoordinates: { x: 300, y: 175 },
    });

    // Should detect task-row-1 or list-drop-zone via closestCenter, NOT scheduler-grid
    expect(collisions.some((c) => c.id === 'scheduler-grid')).toBe(false);
  });
});
