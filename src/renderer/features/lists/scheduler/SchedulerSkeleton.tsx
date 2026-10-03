import React from 'react';
import styles from './SchedulerPanel.module.css';

export function SchedulerSkeleton(): React.ReactElement {
  return (
    <div className={styles.skeletonContainer}>
      <div className={styles.skeletonHeader}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonSubtitle} />
      </div>
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <div className={styles.skeletonGutter} />
            <div className={styles.skeletonLine} />
          </div>
        ))}
      </div>
    </div>
  );
}
