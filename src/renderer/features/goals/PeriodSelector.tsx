import React, { useMemo } from 'react';
import { currentQuarter, quarterRange } from '@shared/utils/okr.js';
import { useToday } from '../../hooks/useToday.js';
import type { ObjectivePeriodKind } from '@shared/types/index.js';
import styles from './PeriodSelector.module.css';

export interface PeriodSelectorProps {
  startDate: string;
  endDate: string;
  periodKind: ObjectivePeriodKind;
  onChange: (start: string, end: string, kind: ObjectivePeriodKind) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  startDate,
  endDate,
  periodKind,
  onChange,
  className = '',
}) => {
  const todayStr = useToday();

  const curQ = useMemo(() => currentQuarter(todayStr), [todayStr]);
  const nextQ = useMemo(() => {
    const nextQNum = ((curQ.quarter % 4) + 1) as 1 | 2 | 3 | 4;
    const nextQYear = curQ.quarter === 4 ? curQ.year + 1 : curQ.year;
    const range = quarterRange(nextQYear, nextQNum);
    return {
      quarter: nextQNum,
      year: nextQYear,
      label: `Q${nextQNum} ${nextQYear}`,
      start: range.start,
      end: range.end,
    };
  }, [curQ]);

  // Determine active segment tab
  const activeTab: 'this_quarter' | 'next_quarter' | 'custom' = useMemo(() => {
    if (periodKind === 'quarter') {
      if (startDate === curQ.start && endDate === curQ.end) {
        return 'this_quarter';
      }
      if (startDate === nextQ.start && endDate === nextQ.end) {
        return 'next_quarter';
      }
    }
    return 'custom';
  }, [startDate, endDate, periodKind, curQ, nextQ]);

  const handleSelectThisQuarter = () => {
    onChange(curQ.start, curQ.end, 'quarter');
  };

  const handleSelectNextQuarter = () => {
    onChange(nextQ.start, nextQ.end, 'quarter');
  };

  const handleSelectCustom = () => {
    onChange(startDate, endDate, 'custom');
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    onChange(newStart, endDate, 'custom');
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    onChange(startDate, newEnd, 'custom');
  };

  return (
    <div className={`${styles.periodControlWrapper} ${className}`.trim()}>
      <div className={styles.segmentedControl} role="tablist" aria-label="Period selection">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'this_quarter'}
          className={`${styles.segmentBtn} ${activeTab === 'this_quarter' ? styles.activeSegment : ''}`}
          onClick={handleSelectThisQuarter}
        >
          This quarter ({curQ.label})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'next_quarter'}
          className={`${styles.segmentBtn} ${activeTab === 'next_quarter' ? styles.activeSegment : ''}`}
          onClick={handleSelectNextQuarter}
        >
          Next quarter ({nextQ.label})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'custom'}
          className={`${styles.segmentBtn} ${activeTab === 'custom' ? styles.activeSegment : ''}`}
          onClick={handleSelectCustom}
        >
          Custom
        </button>
      </div>

      <div className={styles.dateRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={startDate}
          onChange={handleStartDateChange}
          aria-label="Start date"
        />
        <input
          type="date"
          className={styles.dateInput}
          value={endDate}
          onChange={handleEndDateChange}
          aria-label="End date"
        />
      </div>
    </div>
  );
};

export default PeriodSelector;
