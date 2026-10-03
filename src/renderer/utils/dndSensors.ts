import { PointerSensor } from '@dnd-kit/core';

export class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: PointerEvent },
        { onActivation }: { onActivation?: (params: { event: PointerEvent }) => void }
      ) => {
        if (!event.isPrimary || event.button !== 0) {
          return false;
        }

        const target = event.target as HTMLElement | null;
        if (
          target?.closest?.('[data-dnd-kind="time-block"]') ||
          target?.closest?.('[data-resize-handle]')
        ) {
          return false;
        }

        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export class BlockPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: PointerEvent },
        { onActivation }: { onActivation?: (params: { event: PointerEvent }) => void }
      ) => {
        if (!event.isPrimary || event.button !== 0) {
          return false;
        }

        const target = event.target as HTMLElement | null;
        if (target?.closest?.('[data-resize-handle]')) {
          return false;
        }

        if (target?.closest?.('[data-dnd-kind="time-block"]')) {
          onActivation?.({ event });
          return true;
        }

        return false;
      },
    },
  ];
}
