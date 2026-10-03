import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { PlannedGroup } from '../../hooks/usePlannedGroups.js';
import styles from './PlannedDateGroup.module.css';

export interface PlannedDateGroupProps {
  group: PlannedGroup;
  taskCount: number;
}

export const PlannedDateGroup = React.memo(function PlannedDateGroup({
  group,
  taskCount,
}: PlannedDateGroupProps): React.ReactElement {
  const isOverdue = group.kind === 'overdue';

  const { setNodeRef, isOver } = useDroppable({
    id: `droppable-header-${group.kind}-${group.dateISO ?? group.label}`,
    data: {
      type: 'planned-group',
      targetDropDateISO: group.targetDropDateISO,
      kind: group.kind,
      groupKey: group.key,
    },
  });

  const isInvalidHover = isOver && isOverdue;
  const isValidHover = isOver && !isOverdue;

  return (
    <div
      ref={setNodeRef}
      className={`${styles.groupHeader} ${
        isValidHover ? styles.dropActive : ''
      } ${isInvalidHover ? styles.invalidDropActive : ''}`}
      role="region"
      aria-label={`${group.label}, ${taskCount} task${taskCount === 1 ? '' : 's'}`}
    >
      <div className={styles.labelWrap}>
        <span className={`${styles.groupLabel} ${isOverdue ? styles.overdueLabel : ''}`}>
          {group.label}
        </span>
      </div>

      <span className={`${styles.countBadge} ${isOverdue ? styles.overdueBadge : ''}`}>
        {taskCount}
      </span>
    </div>
  );
});

export default PlannedDateGroup;
