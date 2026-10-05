import React, { useEffect } from 'react';
import type { Goal, GoalProgressLog } from '../../../shared/types/Goal.js';
import styles from './GoalHistoryModal.module.css';

interface GoalHistoryModalProps {
  goal: Goal;
  logs: GoalProgressLog[];
  currentProgress: number;
  onClose: () => void;
}

export function GoalHistoryModal({
  goal,
  logs,
  currentProgress,
  onClose,
}: GoalHistoryModalProps): React.ReactElement {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sortedLogs = [...logs].sort((a, b) =>
    b.recorded_at.localeCompare(a.recorded_at)
  );

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <h2 className={styles.modalTitle}>📈 {goal.title}</h2>
            <span className={styles.modalSubtitle}>
              Current: <strong>{currentProgress}%</strong> ({goal.current_value} / {goal.target_value})
            </span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.timelineWrap}>
          {/* Current state entry */}
          <div className={styles.timelineItem}>
            <span className={styles.timelineBullet} style={{ backgroundColor: '#10b981' }} />
            <div className={styles.timelineContent}>
              <div className={styles.timelineRow}>
                <span className={styles.timelineDate}>Current Status</span>
                <span className={styles.timelinePercent} style={{ color: '#10b981' }}>
                  {currentProgress}%
                </span>
              </div>
              <span className={styles.timelineVal}>
                Progress: {goal.current_value} / {goal.target_value}
              </span>
            </div>
          </div>

          {/* Historical progress logs */}
          {sortedLogs.map((log) => {
            const dateDisplay = new Date(log.recorded_at).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={log.id} className={styles.timelineItem}>
                <span className={styles.timelineBullet} />
                <div className={styles.timelineContent}>
                  <div className={styles.timelineRow}>
                    <span className={styles.timelineDate}>{dateDisplay}</span>
                    <span className={styles.timelinePercent}>
                      {log.progress_percent}%
                    </span>
                  </div>
                  <span className={styles.timelineVal}>
                    Value reached: {log.current_value}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Creation milestone */}
          <div className={styles.timelineItem}>
            <span
              className={styles.timelineBullet}
              style={{ backgroundColor: 'var(--text-tertiary)', boxShadow: 'none' }}
            />
            <div className={styles.timelineContent}>
              <div className={styles.timelineRow}>
                <span className={styles.timelineDate}>
                  {new Date(goal.created_at).toLocaleDateString()}
                </span>
                <span className={styles.timelinePercent} style={{ color: 'var(--text-tertiary)' }}>
                  Created
                </span>
              </div>
              <span className={styles.timelineVal}>Goal initialized</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoalHistoryModal;
