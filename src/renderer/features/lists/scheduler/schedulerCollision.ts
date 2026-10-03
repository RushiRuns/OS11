import { closestCenter, type CollisionDetection } from '@dnd-kit/core';

/**
 * Custom collision detection for the single shared DndContext.
 *
 * Rules (per §6.4 and design decisions):
 * 1. If pointer is inside the scheduler panel's grid rect, returns ONLY 'scheduler-grid'.
 * 2. If active drag item is a 'time-block':
 *    - If pointer is inside 'my-day-list-drop-zone', returns ONLY 'my-day-list-drop-zone'.
 *    - Otherwise returns empty [] (outside both, drop is cancelled, cursor shows not-allowed).
 *    - Task rows are excluded from collision so nesting and reordering are suppressed.
 * 3. Otherwise (task row or list drag), excludes 'scheduler-grid' and 'my-day-list-drop-zone'
 *    and runs standard closestCenter collision for list rows and sidebar targets.
 */
export const schedulerCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers, droppableRects, pointerCoordinates } = args;

  if (!pointerCoordinates) {
    return closestCenter(args);
  }

  const isTimeBlock = active.data?.current?.type === 'time-block';

  // 1. Check if pointer is inside scheduler-grid rect
  const schedulerGridContainer = droppableContainers.find(
    (c) => c.id === 'scheduler-grid'
  );

  let isPointerOverScheduler = false;
  if (schedulerGridContainer) {
    const gridRect =
      droppableRects.get(schedulerGridContainer.id) ??
      schedulerGridContainer.node.current?.getBoundingClientRect();
    if (
      gridRect &&
      pointerCoordinates.x >= gridRect.left &&
      pointerCoordinates.x <= gridRect.right &&
      pointerCoordinates.y >= gridRect.top &&
      pointerCoordinates.y <= gridRect.bottom
    ) {
      isPointerOverScheduler = true;
    }
  }

  if (isPointerOverScheduler && schedulerGridContainer) {
    return [
      {
        id: 'scheduler-grid',
        data: schedulerGridContainer.data.current,
      },
    ];
  }

  // 2. If active item is a time-block:
  if (isTimeBlock) {
    const myDayListContainer = droppableContainers.find(
      (c) => c.id === 'my-day-list-drop-zone'
    );
    if (myDayListContainer) {
      const listRect =
        droppableRects.get(myDayListContainer.id) ??
        myDayListContainer.node.current?.getBoundingClientRect();
      if (
        listRect &&
        pointerCoordinates.x >= listRect.left &&
        pointerCoordinates.x <= listRect.right &&
        pointerCoordinates.y >= listRect.top &&
        pointerCoordinates.y <= listRect.bottom
      ) {
        return [
          {
            id: 'my-day-list-drop-zone',
            data: myDayListContainer.data.current,
          },
        ];
      }
    }
    // Time block is outside both grid and list -> no target
    return [];
  }

  // 3. Otherwise (task row or list reordering drag):
  // Exclude scheduler-grid and my-day-list-drop-zone from collision candidates
  const filteredContainers = droppableContainers.filter(
    (c) => c.id !== 'scheduler-grid' && c.id !== 'my-day-list-drop-zone'
  );

  return closestCenter({
    ...args,
    droppableContainers: filteredContainers,
  });
};
