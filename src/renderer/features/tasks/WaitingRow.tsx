import React, { useState } from 'react';
import type { Task } from '@shared/types/task.js';
import { Button } from '../../components/Button/Button.js';
import styles from './WaitingRow.module.css';

interface WaitingRowProps {
  task: Task;
  onUpdateWaiting: (waitingOn: string, followUpDate?: string | null) => void;
  onClearWaiting: () => void;
}

export function WaitingRow({
  task,
  onUpdateWaiting,
  onClearWaiting,
}: WaitingRowProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [waitingOnInput, setWaitingOnInput] = useState(task.waiting_on || '');
  const [followUpDateInput, setFollowUpDateInput] = useState(task.follow_up_date || '');

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = Boolean(task.follow_up_date && task.follow_up_date < todayStr);

  const handleSave = () => {
    if (waitingOnInput.trim()) {
      onUpdateWaiting(waitingOnInput.trim(), followUpDateInput || null);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setWaitingOnInput(task.waiting_on || '');
    setFollowUpDateInput(task.follow_up_date || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={styles.editForm}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
          Waiting on whom or what?
        </div>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. Alice for code review sign-off"
          value={waitingOnInput}
          onChange={(e) => setWaitingOnInput(e.target.value)}
          maxLength={120}
          autoFocus
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Follow-up date:</span>
          <input
            type="date"
            className={styles.input}
            style={{ width: 'auto' }}
            value={followUpDateInput}
            onChange={(e) => setFollowUpDateInput(e.target.value)}
          />
        </div>
        <div className={styles.formActions}>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <span className={styles.label}>
        <span style={{ fontSize: '13px' }}>⏳</span> Waiting For
      </span>

      {task.waiting_on ? (
        <div className={`${styles.waitingPill} ${isOverdue ? styles.overdue : ''}`}>
          <span
            onClick={() => setIsEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Click to edit waiting details"
          >
            {task.waiting_on}
            {task.follow_up_date && ` (Follow-up: ${task.follow_up_date})`}
          </span>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClearWaiting}
            title="Clear waiting status"
            aria-label="Clear waiting status"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setIsEditing(true)}
        >
          + Mark Waiting
        </button>
      )}
    </div>
  );
}

export default WaitingRow;
