import React from 'react';
import type { Task } from '@shared/types/task.js';
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
  return (
    <div
      className={`
        ${styles.timeBlock}
        ${styles.dragOverlayBlock}
        ${isOverGrid ? styles.dragOverlayOverGrid : ''}
        ${isOverList ? styles.dragOverlayOverList : ''}
        ${isOutside ? styles.dragOverlayOutside : ''}
      `}
      data-priority={task.priority ? String(task.priority) : undefined}
      data-size="regular"
      style={{
        cursor: isOutside ? 'not-allowed' : 'grabbing',
      }}
      aria-hidden="true"
    >
      <div className={styles.timeBlockContent}>
        <div className={styles.timeBlockTitle} title={task.title}>
          {task.title}
        </div>
      </div>
    </div>
  );
}

export default TimeBlockDragOverlay;
