import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { HOUR_HEIGHT, GUTTER_WIDTH, PIXELS_PER_MINUTE, formatTimeRange } from './useSchedulerLayout.js';
import { NowLine } from './NowLine.js';
import { TimeBlock } from './TimeBlock.js';
import { useScheduledTasks } from '../../../stores/taskStore.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import styles from './SchedulerPanel.module.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourGutter(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
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
            <div className={styles.gutterCell} style={{ width: `${GUTTER_WIDTH}px` }}>
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
            left: `${GUTTER_WIDTH + 4}px`,
          }}
        >
          <div className={styles.ghostRange}>
            {formatTimeRange(dragPreviewMinutes.startMin, dragPreviewMinutes.durationMin)}
          </div>
        </div>
      )}

      {/* Scheduled Time Blocks */}
      {scheduledTasks.map((task) => (
        <TimeBlock key={task.id} task={task} />
      ))}
    </div>
  );
}
