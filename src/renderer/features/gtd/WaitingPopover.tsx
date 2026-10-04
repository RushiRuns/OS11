import React, { useState } from 'react';
import { Button } from '../../components/Button/Button.js';
import styles from './WaitingPopover.module.css';

interface WaitingPopoverProps {
  initialWaitingOn?: string | null;
  initialFollowUpDate?: string | null;
  position?: { x: number; y: number };
  onSave: (waitingOn: string, followUpDate?: string | null) => void;
  onCancel: () => void;
}

export function WaitingPopover({
  initialWaitingOn = '',
  initialFollowUpDate = '',
  position,
  onSave,
  onCancel,
}: WaitingPopoverProps): React.ReactElement {
  const [waitingOn, setWaitingOn] = useState(initialWaitingOn || '');
  const [followUpDate, setFollowUpDate] = useState(initialFollowUpDate || '');

  const handlePresetDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setFollowUpDate(d.toISOString().split('T')[0]);
  };

  const handleSave = () => {
    if (waitingOn.trim()) {
      onSave(waitingOn.trim(), followUpDate || null);
    }
  };

  return (
    <div
      className={styles.popover}
      style={
        position
          ? {
              top: `${Math.min(position.y, window.innerHeight - 300)}px`,
              left: `${Math.min(position.x, window.innerWidth - 340)}px`,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className={styles.title}>
        <span>⏳</span> Waiting Details
      </h3>

      <div className={styles.formGroup}>
        <label className={styles.label}>Waiting on whom or what?</label>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. Sarah for approval"
          value={waitingOn}
          onChange={(e) => setWaitingOn(e.target.value)}
          maxLength={120}
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Follow-up Date</label>
        <input
          type="date"
          className={styles.input}
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
        />
        <div className={styles.presetsRow}>
          <button
            type="button"
            className={styles.presetBtn}
            onClick={() => handlePresetDate(2)}
          >
            +2 Days
          </button>
          <button
            type="button"
            className={styles.presetBtn}
            onClick={() => handlePresetDate(7)}
          >
            +1 Week
          </button>
          <button
            type="button"
            className={styles.presetBtn}
            onClick={() => handlePresetDate(14)}
          >
            +2 Weeks
          </button>
          {followUpDate && (
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => setFollowUpDate('')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!waitingOn.trim()}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export default WaitingPopover;
