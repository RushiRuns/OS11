import React from 'react';
import type { Task } from '@shared/types/task.js';
import { formatTimeRange } from './useSchedulerLayout.js';
import styles from './SchedulerPanel.module.css';

export interface TimeBlockDragOverlayProps {
  task: Task;
  isOverGrid?: boolean;
  isOverList?: boolean;
  isOutside?: boolean;
}

export function TimeBlockDragOverlay({
  task,
  isOverGrid = false,
  isOverList = false,
  isOutside = false,
}: TimeBlockDragOverlayProps): React.ReactElement {
  const start = task.scheduled_start_min ?? 0;
  const duration = task.scheduled_duration_min ?? 30;

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
      className={`
        ${styles.timeBlock}
        ${styles.dragOverlayBlock}
        ${priorityClass}
        ${isOverGrid ? styles.dragOverlayOverGrid : ''}
        ${isOverList ? styles.dragOverlayOverList : ''}
        ${isOutside ? styles.dragOverlayOutside : ''}
      `}
      style={{
        width: '240px',
        minHeight: '44px',
        cursor: isOutside ? 'not-allowed' : 'grabbing',
      }}
      aria-hidden="true"
    >
      <div className={styles.timeBlockContent}>
        <div className={styles.timeBlockHeader}>
          <span className={styles.timeBlockRange}>
            {formatTimeRange(start, duration)}
          </span>
        </div>
        <div className={styles.timeBlockTitle} title={task.title}>
          {task.title}
        </div>
      </div>
    </div>
  );
}

export default TimeBlockDragOverlay;
