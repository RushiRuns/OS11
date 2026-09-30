import React, { memo, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import type { Task } from '@shared/types/index.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useAttachmentStore } from '../../stores/attachmentStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import styles from './BoardCard.module.css';

export interface BoardCardProps {
  task: Task;
  isSelected?: boolean;
  onSelect?: (task: Task) => void;
  onToggleComplete?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  isOverlay?: boolean;
}

function formatCardDueDate(dueDate?: string | null, dueTime?: string | null): string | null {
  if (!dueDate && !dueTime) return null;
  if (!dueDate) return dueTime ?? null;

  const parts = dueDate.split('T')[0].split('-');
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[month - 1] || parts[1];
    return `${monthName} ${day}`;
  }
  return dueDate;
}

export const BoardCard = memo(function BoardCard({
  task,
  isSelected = false,
  onSelect,
  onToggleComplete,
  onContextMenu,
  isOverlay = false,
}: BoardCardProps): React.ReactElement {
  // Sortable hook only when not rendered inside a DragOverlay
  const sortable = useSortable({
    id: task.id,
    disabled: isOverlay,
  });

  const { attributes, listeners, setNodeRef, isDragging } = sortable;

  // Tags & Attachments
  const taskTags = useTagStore((state) => state.getTagsForTask(task.id));
  const loadTagsForTask = useTagStore((state) => state.loadTagsForTask);
  const attachmentCount = useAttachmentStore((state) => state.countsByTaskId[task.id] ?? 0);

  useEffect(() => {
    if (!isOverlay) {
      loadTagsForTask(task.id);
    }
  }, [task.id, loadTagsForTask, isOverlay]);

  // Subtasks calculation
  const tasksById = useTaskStore((state) => state.tasksById);
  const subtasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) => t.parent_task_id === task.id && t.is_trashed === 0
    );
  }, [tasksById, task.id]);

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((t) => t.is_completed === 1).length;

  // Overdue check
  const isDone = task.is_completed === 1;
  const isOverdue = useMemo(() => {
    if (!task.due_date || isDone) return false;
    if (task.due_time && task.all_day !== 1) {
      const timePart = task.due_time.length === 5 ? `${task.due_time}:00` : task.due_time;
      const datePart = task.due_date.split('T')[0];
      const dueTimestamp = new Date(`${datePart}T${timePart}`).getTime();
      if (!isNaN(dueTimestamp)) {
        return dueTimestamp < Date.now();
      }
    }
    const d = new Date(task.due_date.split('T')[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }, [task.due_date, task.due_time, task.all_day, isDone]);

  // Priority CSS class
  const getPriorityClass = (priority: number) => {
    switch (priority) {
      case 1:
        return styles.priorityAccent1;
      case 2:
        return styles.priorityAccent2;
      case 3:
        return styles.priorityAccent3;
      case 4:
        return styles.priorityAccent4;
      default:
        return '';
    }
  };

  const formattedDue = useMemo(
    () => formatCardDueDate(task.due_date, task.due_time),
    [task.due_date, task.due_time]
  );

  const cardClassName = [
    styles.boardCard,
    getPriorityClass(task.priority),
    isSelected ? styles.boardCardSelected : '',
    isDone ? styles.boardCardCompleted : '',
    isOverlay ? styles.boardCardGhost : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardStyle: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={cardStyle}
      className={cardClassName}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={() => onSelect?.(task)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, task);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Task: ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSelect?.(task);
        }
      }}
    >
      {/* Top Row: Checkbox, Title, Star */}
      <div className={styles.cardHeader}>
        <div
          className={styles.checkboxWrap}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isDone}
            onChange={() => onToggleComplete?.(task.id)}
          />
        </div>

        <div className={styles.titleArea}>
          <span
            className={`${styles.cardTitle} ${isDone ? styles.cardTitleCompleted : ''}`}
          >
            {task.title}
          </span>
          {task.is_starred === 1 && (
            <span className={styles.starBadge} title="Starred" aria-label="Starred">
              ★
            </span>
          )}
        </div>
      </div>

      {/* Tags Row */}
      {taskTags.length > 0 && (
        <div className={styles.tagsRow}>
          {taskTags.map((tag) => (
            <span key={tag.id} className={styles.tagPill} title={tag.name}>
              {tag.color && (
                <span
                  className={styles.tagColorDot}
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
              )}
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer Chips (Due Date, Estimate, Attachments) */}
      {(formattedDue || task.estimated_minutes || attachmentCount > 0) && (
        <div className={styles.cardFooter}>
          {formattedDue && (
            <span
              className={`${styles.chip} ${isOverdue ? styles.overdueChip : ''}`}
              title={isOverdue ? 'Overdue' : 'Due date'}
            >
              📅 {formattedDue}
            </span>
          )}
          {task.estimated_minutes ? (
            <span className={styles.chip} title="Estimated time">
              ⏱ {task.estimated_minutes}m
            </span>
          ) : null}
          {attachmentCount > 0 && (
            <span className={`${styles.chip} ${styles.attachmentChip}`} title={`${attachmentCount} attachment(s)`}>
              📎 {attachmentCount}
            </span>
          )}
        </div>
      )}

      {/* Subtask Mini Progress Bar */}
      {totalSubtasks > 0 && (
        <div className={styles.subtaskProgressWrap}>
          <div className={styles.subtaskProgressBar}>
            <div
              className={`${styles.subtaskProgressFill} ${
                completedSubtasks === totalSubtasks ? styles.subtaskProgressFillComplete : ''
              }`}
              style={{
                width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`,
              }}
            />
          </div>
          <span className={styles.subtaskProgressText}>
            {completedSubtasks}/{totalSubtasks}
          </span>
        </div>
      )}
    </div>
  );
});

export default BoardCard;
