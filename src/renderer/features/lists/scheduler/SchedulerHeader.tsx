import React from 'react';
import { usePlannedMinutes, useUnplacedCount, useTaskStore } from '../../../stores/taskStore.js';
import { useToday } from '../../../hooks/useToday.js';
import styles from './SchedulerPanel.module.css';

export function SchedulerHeader(): React.ReactElement {
  const todayStr = useToday();
  const plannedMinutes = usePlannedMinutes(todayStr);
  const unplacedCount = useUnplacedCount(todayStr);

  const formatPlannedTime = (mins: number) => {
    if (mins <= 0) return '0m planned';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m planned`;
    if (m === 0) return `${h}h planned`;
    return `${h}h ${m}m planned`;
  };

  const handleClose = () => {
    useTaskStore.getState().toggleScheduler();
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerTitleRow}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Today</h2>
          <div className={styles.metaRow}>
            <span className={styles.plannedSummary}>{formatPlannedTime(plannedMinutes)}</span>
            {unplacedCount > 0 ? (
              <span className={styles.unplacedCount}>• {unplacedCount} not placed</span>
            ) : plannedMinutes > 0 ? (
              <span className={styles.allPlaced}>• All placed</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close scheduler"
          title="Close scheduler"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
