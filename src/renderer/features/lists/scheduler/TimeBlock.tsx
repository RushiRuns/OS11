import React, { useState, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types/task.js';
import { HOUR_HEIGHT, PIXELS_PER_MINUTE, GUTTER_WIDTH, formatTimeRange } from './useSchedulerLayout.js';
import { SNAP, resizeLimits, type BlockInterval } from '@shared/utils/schedulerMath.js';
import { toISODate } from '@shared/utils/date.js';
import { useTaskStore } from '../../../stores/taskStore.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import { useUndoRedoStore } from '../../../hooks/useUndoRedo.js';
import styles from './SchedulerPanel.module.css';

interface TimeBlockProps {
  task: Task;
}

export function TimeBlock({ task }: TimeBlockProps): React.ReactElement {
  const [resizingEdge, setResizingEdge] = useState<'top' | 'bottom' | null>(null);
  const [liveStart, setLiveStart] = useState<number>(task.scheduled_start_min ?? 0);
  const [liveDuration, setLiveDuration] = useState<number>(task.scheduled_duration_min ?? 30);

  const liveStartRef = useRef(liveStart);
  const liveDurationRef = useRef(liveDuration);
  liveStartRef.current = liveStart;
  liveDurationRef.current = liveDuration;

  const resizeStateRef = useRef<{
    edge: 'top' | 'bottom';
    pointerId: number;
    initialPointerY: number;
    initialStart: number;
    initialDuration: number;
    limits: { min: number; max: number };
  } | null>(null);

  useEffect(() => {
    if (resizingEdge === null) {
      setLiveStart(task.scheduled_start_min ?? 0);
      setLiveDuration(task.scheduled_duration_min ?? 30);
    }
  }, [task.scheduled_start_min, task.scheduled_duration_min, resizingEdge]);

  useEffect(() => {
    if (!resizingEdge) return;

    const onPointerMove = (e: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || (state.pointerId !== undefined && e.pointerId !== state.pointerId)) return;

      const deltaPx = e.clientY - state.initialPointerY;
      const rawDeltaMin = (deltaPx / HOUR_HEIGHT) * 60;
      const deltaMin = Math.round(rawDeltaMin / SNAP) * SNAP;

      if (state.edge === 'bottom') {
        const rawEnd = state.initialStart + state.initialDuration + deltaMin;
        const clampedEnd = Math.max(state.limits.min, Math.min(state.limits.max, rawEnd));
        const newDuration = clampedEnd - state.initialStart;
        setLiveDuration(newDuration);
      } else {
        const rawStart = state.initialStart + deltaMin;
        const clampedStart = Math.max(state.limits.min, Math.min(state.limits.max, rawStart));
        const initialEnd = state.initialStart + state.initialDuration;
        const newDuration = initialEnd - clampedStart;
        setLiveStart(clampedStart);
        setLiveDuration(newDuration);
      }
    };

    const onPointerUp = async () => {
      const state = resizeStateRef.current;
      if (!state) return;

      const { initialStart, initialDuration } = state;
      const finalStart = liveStartRef.current;
      const finalDuration = liveDurationRef.current;

      resizeStateRef.current = null;
      setResizingEdge(null);

      if (finalStart !== initialStart || finalDuration !== initialDuration) {
        try {
          await useTaskStore.getState().updateTimeBlock(task.id, finalStart, finalDuration);
          useUndoRedoStore.getState().pushAction({
            description: `Resized "${task.title}"`,
            undoFn: async () => {
              await useTaskStore.getState().updateTimeBlock(task.id, initialStart, initialDuration);
            },
            redoFn: async () => {
              await useTaskStore.getState().updateTimeBlock(task.id, finalStart, finalDuration);
            },
          });
        } catch (err) {
          console.error('Failed to update time block:', err);
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
    if (e.button !== 0) return;
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
        (t) =>
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
    disabled: resizingEdge !== null,
    data: {
      type: 'time-block',
      taskId: task.id,
      task,
    },
  });

  const selectedBlockId = useSchedulerUiStore((s) => s.selectedBlockId);
  const setSelectedBlockId = useSchedulerUiStore((s) => s.setSelectedBlockId);
  const hoveredBlockId = useSchedulerUiStore((s) => s.hoveredBlockId);
  const setHoveredBlockId = useSchedulerUiStore((s) => s.setHoveredBlockId);

  const isSelected = selectedBlockId === task.id;
  const isHovered = hoveredBlockId === task.id;
  const isCompleted = task.is_completed === 1;

  const effectiveStart = resizingEdge ? liveStart : (task.scheduled_start_min ?? 0);
  const effectiveDuration = resizingEdge ? liveDuration : (task.scheduled_duration_min ?? 30);
  const isCompact = effectiveDuration <= 30;

  const top = effectiveStart * PIXELS_PER_MINUTE;
  const height = Math.max(18, effectiveDuration * PIXELS_PER_MINUTE - 2);

  const handleUnschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevStart = task.scheduled_start_min;
    const prevDuration = task.scheduled_duration_min;
    useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
    if (isSelected) {
      setSelectedBlockId(null);
    }
    if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
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
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBlockId(task.id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    useTaskStore.getState().openDetail(task.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      const prevStart = task.scheduled_start_min;
      const prevDuration = task.scheduled_duration_min;
      useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
      setSelectedBlockId(null);
      if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
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
    } else if (e.key === 'Escape') {
      setSelectedBlockId(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      useTaskStore.getState().openDetail(task.id);
    }
  };

  // Priority color variable
  const priorityClass =
    task.priority === 4
      ? styles.priorityP1
      : task.priority === 3
        ? styles.priorityP2
        : task.priority === 2
          ? styles.priorityP3
          : task.priority === 1
            ? styles.priorityP4
            : '';

  return (
    <div
      ref={setNodeRef}
      data-dnd-kind="time-block"
      data-task-id={task.id}
      aria-label={`${task.title}, ${formatTimeRange(effectiveStart, effectiveDuration)}`}
      className={`
        ${styles.timeBlock}
        ${priorityClass}
        ${isSelected ? styles.timeBlockSelected : ''}
        ${isHovered ? styles.timeBlockHovered : ''}
        ${isCompleted ? styles.timeBlockCompleted : ''}
        ${isDragging ? styles.timeBlockDragging : ''}
        ${resizingEdge ? styles.timeBlockResizing : ''}
        ${isCompact ? styles.timeBlockCompact : ''}
      `}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${GUTTER_WIDTH + 4}px`,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHoveredBlockId(task.id)}
      onMouseLeave={() => setHoveredBlockId(null)}
      {...attributes}
      {...listeners}
    >
      {/* Top resize handle */}
      <div
        data-resize-handle="top"
        className={styles.resizeHandleTop}
        onPointerDown={(e) => handleResizeStart(e, 'top')}
        aria-label="Resize start time"
      />

      <div className={styles.timeBlockContent}>
        <div className={styles.timeBlockHeader}>
          <span className={styles.timeBlockRange}>
            {formatTimeRange(effectiveStart, effectiveDuration)}
          </span>
          <button
            type="button"
            className={styles.timeBlockRemoveBtn}
            onClick={handleUnschedule}
            title="Unschedule task"
            aria-label="Unschedule task"
          >
            <svg
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
        </div>
        <div className={styles.timeBlockTitle} title={task.title}>
          {task.title}
        </div>
      </div>

      {/* Bottom resize handle */}
      <div
        data-resize-handle="bottom"
        className={styles.resizeHandleBottom}
        onPointerDown={(e) => handleResizeStart(e, 'bottom')}
        aria-label="Resize duration"
      />
    </div>
  );
}
