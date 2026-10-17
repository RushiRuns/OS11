import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { currentQuarter } from '@shared/utils/okr.js';
import { useToday } from '../../hooks/useToday.js';
import { PeriodSelector } from './PeriodSelector.js';
import type { Objective, ObjectivePeriodKind } from '@shared/types/index.js';
import styles from './CreateGoalModal.module.css';

export interface CreateGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (objective: Objective) => void;
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const todayStr = useToday();
  const createObjective = useOkrStore((s) => s.createObjective);

  const [title, setTitle] = useState('');
  const curQ = currentQuarter(todayStr);

  const [startDate, setStartDate] = useState(curQ.start);
  const [endDate, setEndDate] = useState(curQ.end);
  const [periodKind, setPeriodKind] = useState<ObjectivePeriodKind>('quarter');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const q = currentQuarter(todayStr);
      setTitle('');
      setStartDate(q.start);
      setEndDate(q.end);
      setPeriodKind('quarter');
      setError(null);
    }
  }, [open, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Goal title is required.');
      return;
    }

    if (!startDate.trim() || !endDate.trim()) {
      setError('Both start and end dates are required.');
      return;
    }

    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createObjective({
        title: title.trim(),
        period_kind: periodKind,
        period_start: startDate,
        period_end: endDate,
        cadence: 'weekly',
        status: 'active',
      });

      setTitle('');
      onOpenChange(false);
      if (onCreated) {
        onCreated(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New goal"
      description="Check in weekly. You can change this on the goal."
    >
      <form className={styles.modalForm} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Title</label>
          <input
            type="text"
            className={styles.textInput}
            placeholder="e.g. Launch OS11 v1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>Period</label>
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
        </div>

        {error && <div className={styles.errorText}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create goal'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default CreateGoalModal;
