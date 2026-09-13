import React, { memo, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { useSelectionStore } from '../../stores/selectionStore.js';
import type { Task } from '@shared/types/task.js';
import styles from './TaskCard.module.css';

export interface TaskCardProps {
  task: Task;
  isSelected?: boolean;
  allTaskIds?: string[];
  isSubtaskTarget?: boolean;
  onSelect?: (task: Task) => void;
  onToggleComplete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onUpdateTitle?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onFileDrop?: (taskId: string, files: FileList) => void;
}

export const TaskCard = memo(function TaskCard({
  task,
  isSelected = false,
  allTaskIds,
  isSubtaskTarget = false,
  onSelect,
  onToggleComplete,
  onToggleStar,
  onUpdateTitle,
  onDelete,
  onDuplicate,
  onContextMenu,
  onFileDrop,
}: TaskCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [fileOver, setFileOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { selectedIds, isMultiSelectActive, toggleSelect, selectRange } = useSelectionStore();
  const isMultiSelected = selectedIds.has(task.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveTitle = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdateTitle?.(task.id, editTitle.trim());
    } else {
      setEditTitle(task.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(task.title);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    if (e.shiftKey) {
      e.stopPropagation();
      selectRange(allTaskIds || [], task.id);
      return;
    }
    if (isMultiSelectActive) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    onSelect?.(task);
  };

  // Priority border class
  const getPriorityClass = (p: number) => {
    switch (p) {
      case 1:
        return styles.priority1;
      case 2:
        return styles.priority2;
      case 3:
        return styles.priority3;
      case 4:
        return `${styles.priority4} ${styles.priorityCriticalPulse}`;
      default:
        return '';
    }
  };

  // Check if overdue
  const isOverdue =
    task.due_date &&
    task.is_completed === 0 &&
    new Date(task.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={`${styles.taskCard} ${getPriorityClass(task.priority)} ${
        isSelected ? styles.taskCardSelected : ''
      }`}
      data-multiselect={isMultiSelectActive || isMultiSelected ? 'active' : 'inactive'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-droptarget={isSubtaskTarget ? 'true' : 'false'}
      data-filedrop={fileOver ? 'true' : 'false'}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, task);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={(e) => {
        setFileOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          onFileDrop?.(task.id, e.dataTransfer.files);
        }
      }}
      tabIndex={0}
      role="row"
      aria-selected={isSelected || isMultiSelected}
    >
      {/* Drag Grip Handle */}
      <span
        className={styles.dragGrip}
        {...attributes}
        {...listeners}
        title="Drag to reorder or nest task"
      >
        ⋮⋮
      </span>

      {/* Multi-Select Checkbox */}
      <div
        className={styles.multiSelectCheckboxWrap}
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            selectRange(allTaskIds || [], task.id);
          } else {
            toggleSelect(task.id);
          }
        }}
      >
        <input
          type="checkbox"
          className={styles.multiSelectInput}
          checked={isMultiSelected}
          onChange={() => {}}
          aria-label={`Select ${task.title}`}
        />
      </div>

      {/* Layer 1: Checkbox & Title */}
      <div
        className={styles.checkboxWrap}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(task.id);
        }}
      >
        <Checkbox
          checked={task.is_completed === 1}
          onChange={() => onToggleComplete?.(task.id)}
        />
      </div>

      <div className={styles.titleArea}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={styles.titleInput}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`${styles.titleText} ${
              task.is_completed === 1 ? styles.completedTitle : ''
            }`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title={task.title}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Layer 2: Metadata Badges (Hover/Focus progressive disclosure) */}
      <div className={styles.metadataWrap}>
        {task.due_date && (
          <span
            className={`${styles.dueDateChip} ${
              isOverdue ? styles.dueDateOverdue : ''
            }`}
          >
            {task.due_date}
          </span>
        )}

        {task.pomodoro_count > 0 && (
          <span className={styles.badgePill} title="Completed Pomodoro Sessions">
            🍅 ×{task.pomodoro_count}
          </span>
        )}

        {task.recurrence_rule && (
          <span className={styles.badgePill} title="Recurring Task">
            🔄
          </span>
        )}
      </div>

      {/* Layer 3: Action Buttons */}
      <div className={styles.actionsRow} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`${styles.iconButton} ${
            task.is_starred === 1 ? styles.starButtonActive : ''
          }`}
          onClick={() => onToggleStar?.(task.id)}
          title={task.is_starred === 1 ? 'Unstar' : 'Star'}
          aria-label="Toggle Star"
        >
          ★
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onDuplicate?.(task.id)}
          title="Duplicate Task"
          aria-label="Duplicate Task"
        >
          ⧉
        </button>

        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onDelete?.(task.id)}
          title="Move to Trash"
          aria-label="Delete Task"
        >
          ✕
        </button>
      </div>
    </div>
  );
});

export default TaskCard;
