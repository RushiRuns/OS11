import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import type { KeyResult, KeyResultKind } from '@shared/types/index.js';
import styles from './KeyResultModal.module.css';

export interface KeyResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  initialKeyResult?: KeyResult;
  onSave: (payload: {
    objective_id: string;
    title: string;
    kind: KeyResultKind;
    unit?: string | null;
    start_value?: number;
    target_value?: number;
    resetHistory?: boolean;
  }) => Promise<void>;
}

export const KeyResultModal: React.FC<KeyResultModalProps> = ({
  open,
  onOpenChange,
  objectiveId,
  initialKeyResult,
  onSave,
}) => {
  const isEditing = Boolean(initialKeyResult);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<KeyResultKind>(initialKeyResult?.kind ?? 'metric');
  const [title, setTitle] = useState(initialKeyResult?.title ?? '');
  const [unit, setUnit] = useState(initialKeyResult?.unit ?? '');
  const [startValue, setStartValue] = useState<number>(initialKeyResult?.start_value ?? 0);
  const [targetValue, setTargetValue] = useState<number>(
    initialKeyResult?.target_value ?? (initialKeyResult?.kind === 'habit' ? 3 : 100)
  );
  const [resetHistory, setResetHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKind(initialKeyResult?.kind ?? 'metric');
      setTitle(initialKeyResult?.title ?? '');
      setUnit(initialKeyResult?.unit ?? '');
      setStartValue(initialKeyResult?.start_value ?? 0);
      setTargetValue(
        initialKeyResult?.target_value ?? (initialKeyResult?.kind === 'habit' ? 3 : 100)
      );
      setResetHistory(false);
      setError(null);
      setIsSaving(false);

      // Focus title input on open
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [open, initialKeyResult]);

  const handleKindChange = (newKind: KeyResultKind) => {
    setKind(newKind);
    setError(null);
    if (newKind === 'habit') {
      setTargetValue(3);
    } else if (newKind === 'metric') {
      setTargetValue(100);
    } else {
      setTargetValue(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Key result title is required.');
      return;
    }

    if (kind === 'metric') {
      if (startValue === targetValue) {
        setError('Target value must be different from start value.');
        return;
      }
    } else if (kind === 'habit') {
      if (targetValue < 1 || targetValue > 7) {
        setError('Habit frequency must be between 1 and 7 days per week.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave({
        objective_id: objectiveId,
        title: trimmedTitle,
        kind,
        unit: kind === 'metric' && unit.trim() ? unit.trim() : null,
        start_value: kind === 'metric' ? Number(startValue) : 0,
        target_value: kind === 'metric' || kind === 'habit' ? Number(targetValue) : 0,
        resetHistory,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const renderDirectionText = () => {
    if (kind !== 'metric') return null;
    if (startValue === targetValue) {
      return (
        <span className={`${styles.directionText} ${styles.directionTextWarn}`}>
          Start and target must differ
        </span>
      );
    }
    if (targetValue > startValue) {
      return (
        <span className={styles.directionText}>
          Goes up from {startValue} to {targetValue}
        </span>
      );
    }
    return (
      <span className={styles.directionText}>
        Goes down from {startValue} to {targetValue}
      </span>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit key result' : 'New key result'}
    >
      <form className={styles.modalForm} onSubmit={handleSubmit}>
        {/* Kind selector */}
        <div className={styles.inputGroup}>
          <div className={styles.label}>Type</div>
          <div className={styles.segmentedControl} role="tablist" aria-label="Key result type">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'metric'}
              className={`${styles.segmentBtn} ${kind === 'metric' ? styles.activeSegment : ''}`}
              onClick={() => handleKindChange('metric')}
            >
              A number
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'work'}
              className={`${styles.segmentBtn} ${kind === 'work' ? styles.activeSegment : ''}`}
              onClick={() => handleKindChange('work')}
            >
              Work I complete
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'habit'}
              className={`${styles.segmentBtn} ${kind === 'habit' ? styles.activeSegment : ''}`}
              onClick={() => handleKindChange('habit')}
            >
              A habit
            </button>
          </div>
        </div>

        {/* Title input */}
        <div className={styles.inputGroup}>
          <label htmlFor="kr-modal-title" className={styles.label}>
            Title
          </label>
          <input
            ref={titleInputRef}
            id="kr-modal-title"
            type="text"
            className={styles.textInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              kind === 'metric'
                ? 'e.g. Monthly revenue'
                : kind === 'work'
                ? 'e.g. Complete redesign'
                : 'e.g. Exercise 3 times a week'
            }
          />
        </div>

        {/* Metric fields */}
        {kind === 'metric' && (
          <div className={styles.inputGroup}>
            <div className={styles.metricGrid}>
              <div className={styles.inputGroup}>
                <label htmlFor="kr-modal-start" className={styles.label}>
                  Start
                </label>
                <input
                  id="kr-modal-start"
                  type="number"
                  className={styles.metricInput}
                  value={startValue}
                  onChange={(e) => setStartValue(Number(e.target.value))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="kr-modal-target" className={styles.label}>
                  Target
                </label>
                <input
                  id="kr-modal-target"
                  type="number"
                  className={styles.metricInput}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Number(e.target.value))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="kr-modal-unit" className={styles.label}>
                  Unit (optional)
                </label>
                <input
                  id="kr-modal-unit"
                  type="text"
                  className={styles.metricInput}
                  placeholder="e.g. %, $, ms"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>
            {renderDirectionText()}
          </div>
        )}

        {/* Work info */}
        {kind === 'work' && (
          <p className={styles.helperText}>
            Progress comes from the projects and tasks you link.
          </p>
        )}

        {/* Habit fields */}
        {kind === 'habit' && (
          <div className={styles.inputGroup}>
            <label htmlFor="kr-modal-habit-target" className={styles.label}>
              Times per week
            </label>
            <input
              id="kr-modal-habit-target"
              type="number"
              min="1"
              max="7"
              className={styles.metricInput}
              style={{ width: '120px' }}
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
            />
            <span className={styles.helperText}>Days per week to complete this habit</span>
          </div>
        )}

        {/* Reset history option when editing */}
        {isEditing && (
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={resetHistory}
              onChange={(e) => setResetHistory(e.target.checked)}
            />
            Reset check-in history
          </label>
        )}

        {/* Error message */}
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Actions */}
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSaving || !title.trim()}
          >
            {isSaving
              ? 'Saving...'
              : isEditing
              ? 'Save changes'
              : 'Add key result'}
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default KeyResultModal;
