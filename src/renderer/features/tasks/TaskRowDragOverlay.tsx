import React from 'react';
import type { Task } from '@shared/types/task.js';

interface TaskRowDragOverlayProps {
  task: Task;
}

export function TaskRowDragOverlay({ task }: TaskRowDragOverlayProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--surface-raised, #2a2a2e)',
        border: '1px solid var(--border-subtle, #3a3a3e)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        maxWidth: '380px',
        cursor: 'grabbing',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{ fontSize: '13px', color: 'var(--text-tertiary, #888)', lineHeight: 1 }}
        aria-hidden="true"
      >
        ⠿
      </span>
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '2px solid var(--text-tertiary, #888)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: '14px',
          color: 'var(--text-primary, #fff)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {task.title}
      </span>
    </div>
  );
}
