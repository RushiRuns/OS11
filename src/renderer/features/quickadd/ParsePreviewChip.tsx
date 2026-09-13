import React from 'react';
import type { ParsedQuickAddResult } from '@shared/types/nlp.js';
import styles from './ParsePreviewChip.module.css';

interface ParsePreviewChipProps {
  parsed: ParsedQuickAddResult | null;
}

export function ParsePreviewChip({ parsed }: ParsePreviewChipProps): React.ReactElement | null {
  if (!parsed) return null;

  const hasChips =
    parsed.tagNames.length > 0 ||
    parsed.listName ||
    parsed.priority > 0 ||
    parsed.dueDate ||
    parsed.recurrenceRule ||
    parsed.pomodoroRequested;

  if (!hasChips) return null;

  const priorityClass =
    parsed.priority === 4
      ? styles.priority4
      : parsed.priority === 3
        ? styles.priority3
        : parsed.priority === 2
          ? styles.priority2
          : parsed.priority === 1
            ? styles.priority1
            : '';

  const priorityLabel =
    parsed.priority === 4
      ? 'Critical'
      : parsed.priority === 3
        ? 'High'
        : parsed.priority === 2
          ? 'Medium'
          : parsed.priority === 1
            ? 'Low'
            : '';

  return (
    <div className={styles.previewRow}>
      {/* List chip */}
      {parsed.listName && (
        <span className={`${styles.chip} ${styles.chipList}`}>
          @{parsed.listName}
        </span>
      )}

      {/* Tags */}
      {parsed.tagNames.map((tag) => (
        <span key={tag} className={`${styles.chip} ${styles.chipTag}`}>
          #{tag}
        </span>
      ))}

      {/* Priority */}
      {parsed.priority > 0 && (
        <span className={`${styles.chip} ${styles.chipPriority} ${priorityClass}`}>
          !{priorityLabel}
        </span>
      )}

      {/* Due Date & Time */}
      {parsed.dueDate && (
        <span className={`${styles.chip} ${styles.chipDate}`}>
          📅 {parsed.dueDate} {parsed.dueTime ? parsed.dueTime : ''}
        </span>
      )}

      {/* Recurrence */}
      {parsed.recurrenceRule && (
        <span className={`${styles.chip} ${styles.chipRecurrence}`}>
          🔁 Recurring
        </span>
      )}

      {/* Pomodoro */}
      {parsed.pomodoroRequested && (
        <span className={`${styles.chip} ${styles.chipPomodoro}`}>
          🍅 Pomodoro
        </span>
      )}
    </div>
  );
}

export default ParsePreviewChip;
