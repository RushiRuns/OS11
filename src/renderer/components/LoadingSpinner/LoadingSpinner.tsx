import React from 'react';
import styles from './LoadingSpinner.module.css';

export interface LoadingSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  size,
  label = 'Loading...',
  className = '',
}: LoadingSpinnerProps): React.ReactElement {
  const customStyle: React.CSSProperties = size
    ? { width: `${size}px`, height: `${size}px` }
    : {};

  return (
    <div className={`${styles.spinnerWrapper} ${className}`} role="status" aria-label={label}>
      <div className={styles.spinner} style={customStyle} />
    </div>
  );
}

export default LoadingSpinner;
