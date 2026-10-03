import type { CollisionDetection } from '@dnd-kit/core';
import { closestCenter } from '@dnd-kit/core';

export const schedulerCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers, droppableRects, pointerCoordinates } = args;

  const isTimeBlock = active?.data?.current?.type === 'time-block';

  // 1. Check if pointer is inside scheduler panel or scheduler-grid
  const schedulerContainer = droppableContainers.find((c) => c.id === 'scheduler-grid');
  if (schedulerContainer && pointerCoordinates) {
    const panelEl = typeof document !== 'undefined'
      ? (document.querySelector('[data-testid="scheduler-panel"]') as HTMLElement | null)
      : null;
    const rect = panelEl ? panelEl.getBoundingClientRect() : droppableRects.get(schedulerContainer.id);
    if (
      rect &&
      pointerCoordinates.x >= rect.left &&
      pointerCoordinates.x <= rect.right &&
      pointerCoordinates.y >= rect.top &&
      pointerCoordinates.y <= rect.bottom
    ) {
      return [{ id: 'scheduler-grid', data: schedulerContainer.data?.current }];
    }
  }

  // 2. When active item is a time block:
  // Pointer inside my-day-list-drop-zone returns my-day-list-drop-zone, else nothing.
  if (isTimeBlock) {
    const listContainer = droppableContainers.find((c) => c.id === 'my-day-list-drop-zone');
    if (listContainer && pointerCoordinates) {
      const rect = droppableRects.get(listContainer.id);
      if (
        rect &&
        pointerCoordinates.x >= rect.left &&
        pointerCoordinates.x <= rect.right &&
        pointerCoordinates.y >= rect.top &&
        pointerCoordinates.y <= rect.bottom
      ) {
        return [{ id: 'my-day-list-drop-zone', data: listContainer.data?.current }];
      }
    }
    // Outside both scheduler-grid and list container: return nothing
    return [];
  }

  // 3. For regular task row drags: exclude scheduler-grid from closestCenter calculation
  const filteredContainers = droppableContainers.filter((c) => c.id !== 'scheduler-grid');
  return closestCenter({
    ...args,
    droppableContainers: filteredContainers,
  });
};
