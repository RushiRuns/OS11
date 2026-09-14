import React from 'react';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  size?: 'thin' | 'standard';
  variant?: 'primary' | 'success' | 'warning';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  size = 'standard',
  variant,
  showLabel = false,
  label,
  className,
}: ProgressBarProps): React.ReactElement {
  const clampedProgress = Math.min(100, Math.max(0, isNaN(progress) ? 0 : progress));

  // Auto-switch to success variant if 100% and variant not explicitly forced
  const resolvedVariant =
    variant ?? (clampedProgress >= 100 ? 'success' : 'primary');

  const fillVariantClass =
    resolvedVariant === 'success'
      ? styles.fillSuccess
      : resolvedVariant === 'warning'
        ? styles.fillWarning
        : styles.fillPrimary;

  const trackSizeClass = size === 'thin' ? styles.trackThin : styles.trackStandard;

  return (
    <div className={`${styles.wrapper} ${className || ''}`} role="progressbar" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100}>
      {(showLabel || label) && (
        <div className={styles.headerRow}>
          {label && <span>{label}</span>}
          {showLabel && <span>{Math.round(clampedProgress)}%</span>}
        </div>
      )}
      <div className={`${styles.track} ${trackSizeClass}`}>
        <div
          className={`${styles.fill} ${fillVariantClass}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
