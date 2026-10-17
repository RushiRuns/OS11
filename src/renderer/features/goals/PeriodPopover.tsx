import React, { useState, useEffect, useRef } from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { getRadixPortalContainer } from '../../components/primitives/portal.js';
import { PeriodSelector } from './PeriodSelector.js';
import { formatDueLabel } from '../tasks/due-label.js';
import { currentQuarter } from '@shared/utils/okr.js';
import type { Objective, ObjectivePeriodKind } from '@shared/types/index.js';
import detailStyles from './GoalDetail.module.css';
import styles from './PeriodPopover.module.css';

export interface PeriodPopoverProps {
  objective: Objective;
  onSave: (payload: { period_start: string; period_end: string; period_kind: ObjectivePeriodKind }) => Promise<void>;
  disabled?: boolean;
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export const PeriodPopover: React.FC<PeriodPopoverProps> = ({
  objective,
  onSave,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(objective.period_start);
  const [endDate, setEndDate] = useState(objective.period_end);
  const [periodKind, setPeriodKind] = useState<ObjectivePeriodKind>(objective.period_kind);
  const [isSaving, setIsSaving] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setStartDate(objective.period_start);
      setEndDate(objective.period_end);
      setPeriodKind(objective.period_kind);
    }
  }, [open, objective.period_start, objective.period_end, objective.period_kind]);

  const hasChanged =
    startDate !== objective.period_start ||
    endDate !== objective.period_end ||
    periodKind !== objective.period_kind;

  // Validation
  const hasBothDates = Boolean(startDate.trim() && endDate.trim());
  const isDateOrderValid = hasBothDates && endDate >= startDate;
  const isValid = hasBothDates && isDateOrderValid;

  const errorMessage = !hasBothDates
    ? 'Both start and end dates are required.'
    : !isDateOrderValid
      ? 'End date must be on or after the start date.'
      : null;

  const canSave = hasChanged && isValid && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        period_start: startDate,
        period_end: endDate,
        period_kind: periodKind,
      });
      setOpen(false);
      chipRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    chipRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canSave) {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Compute chip label
  const chipLabel = (() => {
    if (objective.period_kind === 'quarter') {
      const q = currentQuarter(objective.period_start);
      return q.label;
    }
    const startFormatted = formatDueLabel(objective.period_start)?.label ?? objective.period_start;
    const endFormatted = formatDueLabel(objective.period_end)?.label ?? objective.period_end;
    return `${startFormatted} to ${endFormatted}`;
  })();

  const portalContainer = getRadixPortalContainer();

  return (
    <RadixPopover.Root open={open} onOpenChange={(nextOpen) => {
      if (disabled) return;
      setOpen(nextOpen);
    }}>
      <RadixPopover.Trigger asChild>
        <button
          ref={chipRef}
          type="button"
          className={detailStyles.metaPill}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Edit period dates"
        >
          <span className={detailStyles.metaChipIcon}>
            <CalendarIcon />
          </span>
          <span className={detailStyles.metaChipText}>{chipLabel}</span>
          <span className={detailStyles.metaChipChevron}>
            <ChevronDownIcon />
          </span>
        </button>
      </RadixPopover.Trigger>

      <RadixPopover.Portal container={portalContainer}>
        <RadixPopover.Content
          className={styles.popoverSurface}
          align="start"
          side="bottom"
          sideOffset={6}
          onKeyDown={handleKeyDown}
        >
          <PeriodSelector
            startDate={startDate}
            endDate={endDate}
            periodKind={periodKind}
            onChange={(newStart, newEnd, newKind) => {
              setStartDate(newStart);
              setEndDate(newEnd);
              setPeriodKind(newKind);
            }}
          />

          {errorMessage && (
            <div className={styles.validationError} role="alert">
              {errorMessage}
            </div>
          )}

          <div className={styles.popoverFooter}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

export default PeriodPopover;
