import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Task } from '@shared/types/task.js';
import { HOUR_HEIGHT, PIXELS_PER_MINUTE, formatTimeRange } from './useSchedulerLayout.js';
import { NowLine } from './NowLine.js';
import { TimeBlock } from './TimeBlock.js';
import { useScheduledTasks, useTaskStore } from '../../../stores/taskStore.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import { useUndoRedoStore } from '../../../hooks/useUndoRedo.js';
import styles from './SchedulerPanel.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CLEANUP_SAFETY_TIMEOUT_MS = 250; // Safety timer longer than --motion-default (180ms)

function formatHourGutter(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

interface LeavingBlockSnapshot {
  task: Task;
  startMin: number;
  durationMin: number;
}

export function SchedulerGrid(): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: 'scheduler-grid',
    data: {
      type: 'scheduler-grid',
    },
  });

  const scheduledTasks = useScheduledTasks();
  const dragPreviewMinutes = useSchedulerUiStore((s) => s.dragPreviewMinutes);
  const setSelectedBlockId = useSchedulerUiStore((s) => s.setSelectedBlockId);

  const [leavingBlocks, setLeavingBlocks] = useState<Record<string, LeavingBlockSnapshot>>({});
  const safetyTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  const isInitialMountRef = useRef(true);
  const renderedIdsRef = useRef<Set<string>>(new Set());
  const [newBlockIds, setNewBlockIds] = useState<Set<string>>(new Set());

  // Track new block additions while panel is open
  useEffect(() => {
    if (isInitialMountRef.current) {
      renderedIdsRef.current = new Set(scheduledTasks.map((t) => t.id));
      isInitialMountRef.current = false;
      return;
    }

    const currentIds = new Set(scheduledTasks.map((t) => t.id));
    const addedIds = scheduledTasks
      .map((t) => t.id)
      .filter((id) => !renderedIdsRef.current.has(id));

    if (addedIds.length > 0) {
      setNewBlockIds((prev) => {
        const next = new Set(prev);
        addedIds.forEach((id) => next.add(id));
        return next;
      });
    }

    renderedIdsRef.current = currentIds;
  }, [scheduledTasks]);

  // If a task is scheduled again while leaving, cancel its leaving state
  useEffect(() => {
    const scheduledIds = new Set(scheduledTasks.map((t) => t.id));
    setLeavingBlocks((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (scheduledIds.has(id)) {
          if (safetyTimersRef.current[id]) {
            clearTimeout(safetyTimersRef.current[id]);
            delete safetyTimersRef.current[id];
          }
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [scheduledTasks]);

  const handleAnimationEnd = useCallback((taskId: string) => {
    setNewBlockIds((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  const removeLeavingId = useCallback((taskId: string) => {
    if (safetyTimersRef.current[taskId]) {
      clearTimeout(safetyTimersRef.current[taskId]);
      delete safetyTimersRef.current[taskId];
    }
    setLeavingBlocks((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    (task: Task) => {
      if (leavingBlocks[task.id]) return; // Prevent double removal

      const start = task.scheduled_start_min ?? 0;
      const duration = task.scheduled_duration_min ?? 30;

      // 1. Snapshot block for leaving exit transition
      setLeavingBlocks((prev) => ({
        ...prev,
        [task.id]: { task, startMin: start, durationMin: duration },
      }));

      // 2. Immediate store removal
      useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
      setSelectedBlockId(null);

      // Undo/redo push
      useUndoRedoStore.getState().pushAction({
        description: `Unscheduled "${task.title}"`,
        undoFn: async () => {
          await useTaskStore.getState().updateTimeBlock(task.id, start, duration);
        },
        redoFn: async () => {
          await useTaskStore.getState().unscheduleTask(task.id);
        },
      });

      // 3. Safety fallback timer
      safetyTimersRef.current[task.id] = setTimeout(() => {
        removeLeavingId(task.id);
      }, CLEANUP_SAFETY_TIMEOUT_MS);
    },
    [leavingBlocks, removeLeavingId, setSelectedBlockId]
  );

  const handleLeavingTransitionEnd = useCallback(
    (taskId: string, e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName === 'opacity') {
        removeLeavingId(taskId);
      }
    },
    [removeLeavingId]
  );

  return (
    <div
      ref={setNodeRef}
      className={`${styles.gridRoot} ${isOver ? styles.gridOver : ''}`}
      style={{ height: `${24 * HOUR_HEIGHT}px` }}
      data-drop-target="scheduler-grid"
    >
      {/* 24 Hour Row Backgrounds & Gutter Labels */}
      {HOURS.map((h) => {
        const top = h * HOUR_HEIGHT;
        return (
          <div
            key={h}
            className={styles.hourRow}
            style={{ top: `${top}px`, height: `${HOUR_HEIGHT}px` }}
          >
            <div className={styles.gutterCell}>
              <span className={styles.gutterLabel}>{formatHourGutter(h)}</span>
            </div>
            <div className={styles.hourContentArea}>
              <div className={styles.hourLine} />
              <div className={styles.halfHourLine} />
            </div>
          </div>
        );
      })}

      {/* Now Indicator Line */}
      <NowLine />

      {/* Ghost Drop Preview */}
      {dragPreviewMinutes && (
        <div
          className={`${styles.ghostBlock} ${dragPreviewMinutes.isValid === false ? styles.ghostBlockInvalid : ''}`}
          style={{
            top: `${dragPreviewMinutes.startMin * PIXELS_PER_MINUTE}px`,
            height: `${Math.max(18, dragPreviewMinutes.durationMin * PIXELS_PER_MINUTE - 2)}px`,
          }}
        >
          <div className={styles.ghostRange}>
            {formatTimeRange(dragPreviewMinutes.startMin, dragPreviewMinutes.durationMin)}
          </div>
        </div>
      )}

      {/* Scheduled Time Blocks */}
      {scheduledTasks.map((task) => (
        <TimeBlock
          key={task.id}
          task={task}
          isNew={newBlockIds.has(task.id)}
          onAnimationEnd={handleAnimationEnd}
          onRemove={handleRemove}
        />
      ))}

      {/* Leaving Time Blocks */}
      {Object.values(leavingBlocks).map((leaving) => (
        <TimeBlock
          key={`leaving:${leaving.task.id}`}
          task={leaving.task}
          isLeaving={true}
          onTransitionEnd={handleLeavingTransitionEnd}
        />
      ))}
    </div>
  );
}

export default SchedulerGrid;
