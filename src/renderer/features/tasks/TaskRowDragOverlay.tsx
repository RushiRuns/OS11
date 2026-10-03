import React from 'react';
import type { Task } from '@shared/types/task.js';

interface TaskRowDragOverlayProps {
  task: Task;
  subtaskCount?: { completed: number; total: number };
}

export function TaskRowDragOverlay({ task, subtaskCount }: TaskRowDragOverlayProps): React.ReactElement {
  const getPriorityColor = (p: number): string => {
    switch (p) {
      case 1:
        return 'var(--color-priority-1, #3b82f6)';
      case 2:
        return 'var(--color-priority-2, #eab308)';
      case 3:
        return 'var(--color-priority-3, #f97316)';
      case 4:
        return 'var(--color-priority-4, #ef4444)';
      default:
        return 'var(--text-tertiary, #888888)';
    }
  };

  const priorityColor = getPriorityColor(task.priority);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--surface-raised, rgba(35, 35, 42, 0.95))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        maxWidth: '420px',
        minWidth: '240px',
        cursor: 'grabbing',
        pointerEvents: 'none',
        userSelect: 'none',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0) scale(1.02)',
      }}
    >
      {/* Drag handle dots */}
      <span
        style={{
          fontSize: '14px',
          color: 'var(--text-tertiary, #888)',
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        ⠿
      </span>

      {/* Priority colored checkbox circle */}
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: `2px solid ${priorityColor}`,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />

      {/* Task title */}
      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-primary, #fff)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {task.title || 'Untitled task'}
      </span>

      {/* Subtask count progress badge */}
      {subtaskCount && subtaskCount.total > 0 && (
        <span
          style={{
            fontSize: '12px',
            color: 'var(--text-tertiary, #aaa)',
            background: 'var(--surface-sunken, rgba(0, 0, 0, 0.25))',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm, 6px)',
            flexShrink: 0,
          }}
        >
          ⑂ {subtaskCount.completed}/{subtaskCount.total}
        </span>
      )}

      {/* Scheduled Time badge if already scheduled */}
      {typeof task.scheduled_start_min === 'number' && typeof task.scheduled_duration_min === 'number' && (
        <span
          style={{
            fontSize: '11px',
            color: 'var(--accent, #6366f1)',
            background: 'rgba(99, 102, 241, 0.12)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm, 6px)',
            flexShrink: 0,
          }}
        >
          ⏱️ {task.scheduled_duration_min}m
        </span>
      )}
    </div>
  );
}

export default TaskRowDragOverlay;
