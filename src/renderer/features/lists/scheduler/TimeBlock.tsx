import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task } from '@shared/types/task.js';
import { PIXELS_PER_MINUTE, GUTTER_WIDTH, formatTimeRange } from './useSchedulerLayout.js';
import { useTaskStore } from '../../../stores/taskStore.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import styles from './SchedulerPanel.module.css';

interface TimeBlockProps {
  task: Task;
}

export function TimeBlock({ task }: TimeBlockProps): React.ReactElement {
  const startMin = task.scheduled_start_min ?? 0;
  const durationMin = task.scheduled_duration_min ?? 30;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${task.id}`,
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

  const top = startMin * PIXELS_PER_MINUTE;
  const height = Math.max(18, durationMin * PIXELS_PER_MINUTE - 2);

  const handleUnschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
    if (isSelected) {
      setSelectedBlockId(null);
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
      useTaskStore.getState().unscheduleTask(task.id).catch(console.error);
      setSelectedBlockId(null);
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
      aria-label={`${task.title}, ${formatTimeRange(startMin, durationMin)}`}
      className={`
        ${styles.timeBlock}
        ${priorityClass}
        ${isSelected ? styles.timeBlockSelected : ''}
        ${isHovered ? styles.timeBlockHovered : ''}
        ${isCompleted ? styles.timeBlockCompleted : ''}
        ${isDragging ? styles.timeBlockDragging : ''}
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
      <div className={styles.timeBlockContent}>
        <div className={styles.timeBlockHeader}>
          <span className={styles.timeBlockRange}>
            {formatTimeRange(startMin, durationMin)}
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
    </div>
  );
}
