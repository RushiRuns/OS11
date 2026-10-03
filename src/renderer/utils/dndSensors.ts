import { PointerSensor } from '@dnd-kit/core';

/**
 * ONE pointer sensor for the whole shared DndContext.
 *
 * Why one: dnd-kit builds each draggable's `listeners` by reducing every sensor's
 * activators into an object keyed by event name. Two sensors that both listen on
 * `onPointerDown` overwrite each other and only the LAST one is ever attached. With
 * [RowPointerSensor, BlockPointerSensor] every draggable, task rows included, ran
 * BlockPointerSensor's guard, which rejects anything that is not a time block. Task rows
 * could therefore never start a drag.
 *
 * Routing by target now happens inside this one class instead:
 * - activation distance is 2px for task rows and 3px for time blocks
 * - clicks, double-clicks, checkboxes, buttons, inputs and resize handles never start a drag
 * - only the primary button starts a drag (right-click stays a context menu)
 */

const BLOCK_SELECTOR = '[data-dnd-kind="time-block"]';
const RESIZE_SELECTOR = '[data-resize-handle]';
// Deliberately no [role="button"]: dnd-kit's own `attributes` put role="button" on the
// draggable root, so including it would block every time-block drag.
const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [data-no-dnd]';

const ROW_DRAG_DISTANCE_PX = 2;
const BLOCK_DRAG_DISTANCE_PX = 3;

type PointerSensorCtorProps = ConstructorParameters<typeof PointerSensor>[0];

function shouldStartDrag(event: PointerEvent): boolean {
  if (!event.isPrimary || event.button !== 0) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest(RESIZE_SELECTOR) || target.closest(INTERACTIVE_SELECTOR)) return false;
  return true;
}

export class AppPointerSensor extends PointerSensor {
  constructor(props: PointerSensorCtorProps) {
    const target = props.event.target instanceof Element ? props.event.target : null;
    const distance = target?.closest(BLOCK_SELECTOR) ? BLOCK_DRAG_DISTANCE_PX : ROW_DRAG_DISTANCE_PX;
    super({ ...props, options: { ...props.options, activationConstraint: { distance } } });
  }

  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: (
        { nativeEvent: event }: { nativeEvent: PointerEvent },
        { onActivation }: { onActivation?: (args: { event: PointerEvent }) => void }
      ) => {
        if (!shouldStartDrag(event)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** @deprecated Same class. Kept so any other importer keeps compiling. Never register two of these in one DndContext. */
export const RowPointerSensor = AppPointerSensor;
/** @deprecated Same class. Kept so any other importer keeps compiling. Never register two of these in one DndContext. */
export const BlockPointerSensor = AppPointerSensor;
