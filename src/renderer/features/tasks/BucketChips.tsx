import React from 'react';
import { useModuleStore } from '../../stores/moduleStore.js';
import styles from './BucketChips.module.css';

interface BucketChipsProps {
  currentBucket?: 'anytime' | 'someday' | null;
  onSelectBucket: (bucket: 'anytime' | 'someday' | null) => void;
  className?: string;
}

export function BucketChips({
  currentBucket,
  onSelectBucket,
  className,
}: BucketChipsProps): React.ReactElement | null {
  const isEnabled = useModuleStore((s) => s.isEnabled);
  const anytimeEnabled = isEnabled('anytime');
  const somedayEnabled = isEnabled('someday');

  if (!anytimeEnabled && !somedayEnabled) {
    return null;
  }

  return (
    <div
      className={`${styles.container} ${className || ''}`}
      role="group"
      aria-label="Bucket selection"
    >
      {anytimeEnabled && (
        <button
          type="button"
          className={`${styles.chip} ${
            currentBucket === 'anytime' ? styles.chipActiveAnytime : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectBucket(currentBucket === 'anytime' ? null : 'anytime');
          }}
          aria-pressed={currentBucket === 'anytime'}
        >
          <span>⚡</span>
          <span>Anytime</span>
        </button>
      )}

      {somedayEnabled && (
        <button
          type="button"
          className={`${styles.chip} ${
            currentBucket === 'someday' ? styles.chipActiveSomeday : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectBucket(currentBucket === 'someday' ? null : 'someday');
          }}
          aria-pressed={currentBucket === 'someday'}
        >
          <span>💡</span>
          <span>Someday</span>
        </button>
      )}

      {currentBucket && (
        <button
          type="button"
          className={`${styles.chip} ${styles.clearChip}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectBucket(null);
          }}
          aria-label="Clear bucket"
          title="Clear bucket"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

export default BucketChips;
