import { PointerSensor } from '@dnd-kit/core';

/**
 * Custom PointerSensor for task rows:
 * - Distance constraint is 2px (allows click / double-click to work cleanly).
 * - Ignores pointer events that initiate on a time-block or resize handle.
 */
export class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        const target = event.target as HTMLElement | null;
        if (!target) return true;
        // Do not activate row drag if initiating on time block or resize handle
        if (target.closest('[data-dnd-kind="time-block"]') || target.closest('[data-resize-handle]')) {
          return false;
        }
        return true;
      },
    },
  ];
}

/**
 * Custom PointerSensor for time blocks:
 * - Distance constraint is 3px (distinguishes click for popover from drag).
 * - Only activates for pointer events targeting [data-dnd-kind="time-block"].
 * - Ignores resize handles (which use direct pointer capture).
 */
export class BlockPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) => {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        // Do not activate block drag if clicking resize handle
        if (target.closest('[data-resize-handle]')) {
          return false;
        }
        return Boolean(target.closest('[data-dnd-kind="time-block"]'));
      },
    },
  ];
}
