import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types/task.js';
import { PIXELS_PER_MINUTE, formatTimeRange } from './useSchedulerLayout.js';
import { SNAP, resizeLimits, type BlockInterval } from '@shared/utils/schedulerMath.js';
import { toISODate } from '@shared/utils/date.js';
import { useTaskStore } from '../../../stores/taskStore.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import { useUndoRedoStore } from '../../../hooks/useUndoRedo.js';
import styles from './SchedulerPanel.module.css';

export interface TimeBlockProps {
  task: Task;
  isLeaving?: boolean;
  isNew?: boolean;
  onAnimationEnd?: (taskId: string) => void;
  onTransitionEnd?: (taskId: string, e: React.TransitionEvent<HTMLDivElement>) => void;
  onRemove?: (task: Task) => void;
}

function getSizeVariant(durationMin: number): 'compact' | 'tight' | 'regular' | 'roomy' {
  if (durationMin <= 15) return 'compact';
  if (durationMin <= 30) return 'tight';
  if (durationMin <= 45) return 'regular';
  return 'roomy';
}

function TimeBlockComponent({
  task,
  isLeaving = false,
  isNew = false,
  onAnimationEnd,
  onTransitionEnd,
  onRemove,
}: TimeBlockProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [resizingEdge, setResizingEdge] = useState<'top' | 'bottom' | null>(null);
  const [liveStart, setLiveStart] = useState<number>(task.scheduled_start_min ?? 0);
  const [liveDuration, setLiveDuration] = useState<number>(task.scheduled_duration_min ?? 30);

  const resizeStateRef = useRef<{
    edge: 'top' | 'bottom';
    pointerId: number;
    initialPointerY: number;
    initialStart: number;
    initialDuration: number;
    limits: { min: number; max: number };
  } | null>(null);

  const liveStartRef = useRef(liveStart);
  const liveDurationRef = useRef(liveDuration);

  useEffect(() => {
    if (!resizingEdge) return;

    const onPointerMove = (e: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const deltaY = e.clientY - state.initialPointerY;
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);
      const snappedDelta = Math.round(deltaMinutes / SNAP) * SNAP;

      if (state.edge === 'bottom') {
        const rawEnd = state.initialStart + state.initialDuration + snappedDelta;
        const clampedEnd = Math.max(state.limits.min, Math.min(state.limits.max, rawEnd));
        const newDuration = clampedEnd - state.initialStart;
        liveDurationRef.current = newDuration;
        setLiveDuration(newDuration);
      } else {
        const rawStart = state.initialStart + snappedDelta;
        const clampedStart = Math.max(state.limits.min, Math.min(state.limits.max, rawStart));
        const originalEnd = state.initialStart + state.initialDuration;
        const newDuration = originalEnd - clampedStart;
        liveStartRef.current = clampedStart;
        liveDurationRef.current = newDuration;
        setLiveStart(clampedStart);
        setLiveDuration(newDuration);
      }
    };

    const onPointerUp = async (_e: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;

      const finalStart = liveStartRef.current;
      const finalDuration = liveDurationRef.current;
      resizeStateRef.current = null;
      setResizingEdge(null);

      if (finalStart !== state.initialStart || finalDuration !== state.initialDuration) {
        try {
          await useTaskStore.getState().updateTimeBlock(task.id, finalStart, finalDuration);
          useUndoRedoStore.getState().pushAction({
            description: `Resized "${task.title}"`,
            undoFn: async () => {
              await useTaskStore
                .getState()
                .updateTimeBlock(task.id, state.initialStart, state.initialDuration);
            },
            redoFn: async () => {
              await useTaskStore.getState().updateTimeBlock(task.id, finalStart, finalDuration);
            },
          });
        } catch (err) {
          console.error('[TimeBlock] Failed to persist block resize:', err);
          setLiveStart(state.initialStart);
          setLiveDuration(state.initialDuration);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const state = resizeStateRef.current;
        if (state) {
          setLiveStart(state.initialStart);
          setLiveDuration(state.initialDuration);
          resizeStateRef.current = null;
          setResizingEdge(null);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [resizingEdge, task.id, task.title]);

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>, edge: 'top' | 'bottom') => {
    if (e.button !== 0 || isLeaving) return;
    e.stopPropagation();
    e.preventDefault();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const start = task.scheduled_start_min ?? 0;
    const duration = task.scheduled_duration_min ?? 30;

    const today = toISODate(new Date());
    const others: BlockInterval[] = Object.values(useTaskStore.getState().tasksById)
      .filter(
        (t): t is Task =>
          t.id !== task.id &&
          t.my_day_date === today &&
          t.is_trashed === 0 &&
          typeof t.scheduled_start_min === 'number' &&
          typeof t.scheduled_duration_min === 'number'
      )
      .map((t) => ({
        id: t.id,
        start: t.scheduled_start_min!,
        duration: t.scheduled_duration_min!,
      }));

    const currentBlock: BlockInterval = { id: task.id, start, duration };
    const limits = resizeLimits(others, currentBlock, edge);

    resizeStateRef.current = {
      edge,
      pointerId: e.pointerId,
      initialPointerY: e.clientY,
      initialStart: start,
      initialDuration: duration,
      limits,
    };

    liveStartRef.current = start;
    liveDurationRef.current = duration;
    setResizingEdge(edge);
    setLiveStart(start);
    setLiveDuration(duration);
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${task.id}`,
    disabled: resizingEdge !== null || isLeaving,
    data: {
      type: 'time-block',
      taskId: task.id,
      task,
    },
  });

  const prevDraggingRef = useRef(false);
  const [isArrived, setIsArrived] = useState(false);

  useEffect(() => {
    if (prevDraggingRef.current && !isDragging) {
      setIsArrived(true);
    }
    prevDraggingRef.current = isDragging;
  }, [isDragging]);

  const selectedBlockId = useSchedulerUiStore((s) => s.selectedBlockId);
  const isSelected = selectedBlockId === task.id;
  const isHovered = useSchedulerUiStore((s) => s.hoveredBlockId === task.id);
  const setSelectedBlockId = useSchedulerUiStore((s) => s.setSelectedBlockId);
  const setHoveredBlockId = useSchedulerUiStore((s) => s.setHoveredBlockId);

  const isCompleted = task.is_completed === 1;
  const effectiveStart = resizingEdge ? liveStart : (task.scheduled_start_min ?? 0);
  const effectiveDuration = resizingEdge ? liveDuration : (task.scheduled_duration_min ?? 30);
  const sizeVariant = getSizeVariant(effectiveDuration);

  const top = effectiveStart * PIXELS_PER_MINUTE;
  const height = Math.max(18, effectiveDuration * PIXELS_PER_MINUTE - 2);

  const handleUnschedule = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        typeof document !== 'undefined' &&
        (document.activeElement === rootRef.current || rootRef.current?.contains(document.activeElement))
      ) {
        const scrollEl = document.querySelector(
          '[data-testid="scheduler-scroll-container"]'
        ) as HTMLElement | null;
        scrollEl?.focus();
      }

      if (onRemove) {
        onRemove(task);
      } else {
        const prevStart = task.scheduled_start_min;
        const prevDuration = task.scheduled_duration_min;
        useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
        if (isSelected) {
          setSelectedBlockId(null);
        }
        if (
          prevStart !== null &&
          prevDuration !== null &&
          prevStart !== undefined &&
          prevDuration !== undefined
        ) {
          useUndoRedoStore.getState().pushAction({
            description: `Unscheduled "${task.title}"`,
            undoFn: async () => {
              await useTaskStore.getState().updateTimeBlock(task.id, prevStart, prevDuration);
            },
            redoFn: async () => {
              await useTaskStore.getState().unscheduleTask(task.id);
            },
          });
        }
      }
    },
    [task, isSelected, onRemove, setSelectedBlockId]
  );

  const handleClick = (e: React.MouseEvent) => {
    if (isLeaving) return;
    e.stopPropagation();
    setSelectedBlockId(task.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isLeaving) return;
    e.stopPropagation();
    useTaskStore.getState().openDetail(task.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLeaving) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      handleUnschedule(e as unknown as React.MouseEvent);
    } else if (e.key === 'Escape') {
      setSelectedBlockId(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      useTaskStore.getState().openDetail(task.id);
    }
  };

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (isArrived) {
      setIsArrived(false);
    }
    if (isNew && onAnimationEnd) {
      onAnimationEnd(task.id);
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (isLeaving && onTransitionEnd) {
      onTransitionEnd(task.id, e);
    }
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rootRef.current = el;
      }}
      data-dnd-kind="time-block"
      data-task-id={task.id}
      data-priority={task.priority ? String(task.priority) : undefined}
      data-size={sizeVariant}
      data-dragging={isDragging ? 'true' : undefined}
      data-resizing={resizingEdge !== null ? 'true' : undefined}
      data-arrived={isArrived ? 'true' : undefined}
      data-new={isNew ? 'true' : undefined}
      data-leaving={isLeaving ? 'true' : undefined}
      title={
        sizeVariant === 'compact'
          ? `${task.title} (${formatTimeRange(effectiveStart, effectiveDuration)})`
          : undefined
      }
      aria-label={`${task.title}, ${formatTimeRange(effectiveStart, effectiveDuration)}`}
      className={`
        ${styles.timeBlock}
        ${isSelected ? styles.timeBlockSelected : ''}
        ${isHovered ? styles.timeBlockHovered : ''}
        ${isCompleted ? styles.timeBlockCompleted : ''}
      `}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => !isLeaving && setHoveredBlockId(task.id)}
      onMouseLeave={() => !isLeaving && setHoveredBlockId(null)}
      onAnimationEnd={handleAnimationEnd}
      onTransitionEnd={handleTransitionEnd}
      {...attributes}
      {...listeners}
    >
      {/* Top resize handle & grip */}
      <div
        data-resize-handle="top"
        className={styles.resizeHandleTop}
        onPointerDown={(e) => handleResizeStart(e, 'top')}
        aria-label="Resize start time"
      >
        <div className={styles.resizeGrip} />
      </div>

      <div className={styles.timeBlockContent}>
        <div className={styles.timeBlockTitle} title={task.title}>
          {task.title}
        </div>
        {sizeVariant !== 'compact' && (
          <span className={styles.timeBlockRange}>
            {formatTimeRange(effectiveStart, effectiveDuration)}
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        className={styles.timeBlockRemoveBtn}
        onClick={handleUnschedule}
        title={`Remove time block: ${task.title}`}
        aria-label={`Remove time block: ${task.title}`}
      >
        <svg
          className={styles.removeIcon}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Bottom resize handle & grip */}
      <div
        data-resize-handle="bottom"
        className={styles.resizeHandleBottom}
        onPointerDown={(e) => handleResizeStart(e, 'bottom')}
        aria-label="Resize duration"
      >
        <div className={styles.resizeGrip} />
      </div>
    </div>
  );
}

export const TimeBlock = React.memo(TimeBlockComponent);
export default TimeBlock;
