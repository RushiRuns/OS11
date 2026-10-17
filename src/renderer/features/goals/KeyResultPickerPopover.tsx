import React, { useState, useEffect, useMemo } from 'react';
import { Popover } from '../../components/Popover/Popover.js';
import { useOkrStore } from '../../stores/okrStore.js';
import type { KeyResult, Objective } from '@shared/types/index.js';
import styles from './KeyResultPickerPopover.module.css';

export interface KeyResultPickerPopoverProps {
  value?: string | null;
  onChange: (keyResultId: string | null) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const KeyResultPickerPopover: React.FC<KeyResultPickerPopoverProps> = ({
  value,
  onChange,
  trigger,
  align = 'start',
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const loadAll = useOkrStore((s) => s.loadAll);
  const objectivesById = useOkrStore((s) => s.objectivesById);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);

  useEffect(() => {
    if (open) {
      loadAll().catch(() => {});
    }
  }, [open, loadAll]);

  const activeObjectives = useMemo(() => {
    return Object.values(objectivesById).filter((obj) => obj.status === 'active');
  }, [objectivesById]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: Array<{ objective: Objective; keyResults: KeyResult[] }> = [];

    for (const obj of activeObjectives) {
      const allKrs = Object.values(keyResultsById).filter(
        (kr) => kr.objective_id === obj.id
      );

      const matchingKrs = allKrs.filter((kr) => {
        if (!q) return true;
        return (
          kr.title.toLowerCase().includes(q) ||
          obj.title.toLowerCase().includes(q)
        );
      });

      if (matchingKrs.length > 0) {
        result.push({ objective: obj, keyResults: matchingKrs });
      }
    }

    return result;
  }, [activeObjectives, keyResultsById, query]);

  const handleSelect = (krId: string | null) => {
    onChange(krId);
    setOpen(false);
  };

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      align={align}
      side={side}
      variant="glass"
      className={styles.popoverContent}
    >
      <div className={styles.searchWrapper}>
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search key results..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.listArea}>
        <button
          type="button"
          className={`${styles.noneOption} ${!value ? styles.selected : ''}`}
          onClick={() => handleSelect(null)}
        >
          <span>None (Clear key result)</span>
          {!value && (
            <svg
              className={styles.checkIcon}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {grouped.length === 0 ? (
          <div className={styles.emptyState}>No key results found</div>
        ) : (
          grouped.map(({ objective, keyResults }) => (
            <div key={objective.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <span>{objective.title}</span>
              </div>
              {keyResults.map((kr) => {
                const isSelected = value === kr.id;
                return (
                  <button
                    key={kr.id}
                    type="button"
                    className={`${styles.krOption} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleSelect(kr.id)}
                  >
                    <div className={styles.krLeft}>
                      <span className={styles.krTitle}>{kr.title}</span>
                      <span className={styles.kindBadge}>
                        {kr.kind === 'metric'
                          ? 'Metric'
                          : kr.kind === 'habit'
                          ? `${kr.target_value}x/wk`
                          : 'Work'}
                      </span>
                    </div>
                    {isSelected && (
                      <svg
                        className={styles.checkIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Popover>
  );
};

export default KeyResultPickerPopover;
