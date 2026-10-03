import React from 'react';
import type { Task } from '@shared/types/task.js';
import { formatTimeRange } from './useSchedulerLayout.js';
import styles from './SchedulerPanel.module.css';

interface TimeBlockDragOverlayProps {
  task: Task;
  isOverGrid?: boolean;
  isInvalidDrop?: boolean;
}

export function TimeBlockDragOverlay({
  task,
  isOverGrid = false,
  isInvalidDrop = false,
}: TimeBlockDragOverlayProps): React.ReactElement {
  const startMin = task.scheduled_start_min ?? 0;
  const durationMin = task.scheduled_duration_min ?? 30;

  return (
    <div
      className={`
        ${styles.dragOverlayBlock}
        ${isOverGrid ? styles.dragOverlayOverGrid : ''}
        ${isInvalidDrop ? styles.dragOverlayInvalid : ''}
      `}
      aria-hidden="true"
    >
      <div className={styles.dragOverlayRange}>
        {formatTimeRange(startMin, durationMin)}
      </div>
      <div className={styles.dragOverlayTitle}>
        {task.title}
      </div>
    </div>
  );
}
