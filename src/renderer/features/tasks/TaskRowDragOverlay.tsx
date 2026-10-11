import React from 'react';
import type { Task } from '../../shared/types/task.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { CardGlyph } from './card-glyphs.js';

interface TaskRowDragOverlayProps {
  task: Task;
  subtaskCount?: { completed: number; total: number };
}

export function TaskRowDragOverlay({ task, subtaskCount }: TaskRowDragOverlayProps): React.ReactElement {
  const getPriorityColor = (p: number): string | undefined => {
    switch (p) {
      case 1:
        return 'var(--color-priority-1)';
      case 2:
        return 'var(--color-priority-2)';
      case 3:
        return 'var(--color-priority-3)';
      case 4:
        return 'var(--color-priority-4)';
      default:
        return undefined;
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
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--surface-overlay, rgba(35, 35, 42, 0.95))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-default, rgba(255, 255, 255, 0.12))',
        boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.35))',
        maxWidth: '420px',
        minWidth: '240px',
        cursor: 'grabbing',
        pointerEvents: 'none',
        userSelect: 'none',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0) scale(1.02)',
      }}
    >
      {/* Circle Checkbox */}
      <Checkbox
        checked={Boolean(task.is_completed)}
        onChange={() => {}}
        shape="circle"
        size={18}
        projectColor={priorityColor}
        disabled
      />

      {/* Task title */}
      <span
        style={{
          fontSize: '14px',
          fontWeight: 400,
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--text-tertiary, #aaa)',
            background: 'var(--surface-sunken, rgba(0, 0, 0, 0.25))',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm, 4px)',
            flexShrink: 0,
          }}
        >
          <CardGlyph name="subtasks" style={{ width: '12px', height: '12px' }} />
          <span>
            {subtaskCount.completed}/{subtaskCount.total}
          </span>
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
            borderRadius: 'var(--radius-sm, 4px)',
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
