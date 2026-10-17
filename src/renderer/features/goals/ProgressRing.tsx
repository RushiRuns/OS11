import React from 'react';
import styles from './ProgressRing.module.css';

export interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number; // default 20
  strokeWidth?: number; // default 2
  color?: string; // override stroke color
  className?: string;
  showCheckmark?: boolean; // default true
  ariaLabel?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 20,
  strokeWidth = 2,
  color,
  className = '',
  showCheckmark = true,
  ariaLabel,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const isComplete = clampedProgress >= 100;

  const center = size / 2;
  const radius = Math.max(1, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const strokeColor = color || (isComplete ? 'var(--color-success)' : 'var(--accent)');
  const checkmarkSize = Math.round(size * 0.58);
  const checkmarkOffset = (size - checkmarkSize) / 2;

  return (
    <div
      className={`${styles.ringWrapper} ${isComplete ? styles.complete : ''} ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `Progress: ${clampedProgress}%`}
    >
      <svg
        className={styles.ringSvg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background track circle */}
        <circle
          className={styles.track}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />

        {/* Foreground progress circle */}
        <circle
          className={styles.progress}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />

        {/* Center checkmark when 100% complete */}
        {isComplete && showCheckmark && (
          <svg
            x={checkmarkOffset}
            y={checkmarkOffset}
            width={checkmarkSize}
            height={checkmarkSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.checkmark}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </svg>
    </div>
  );
};

export default ProgressRing;
