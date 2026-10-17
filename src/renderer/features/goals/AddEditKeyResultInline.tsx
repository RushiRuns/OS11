import React, { useState } from 'react';
import type { KeyResult, KeyResultKind } from '@shared/types/index.js';
import styles from './AddEditKeyResultInline.module.css';

export interface AddEditKeyResultInlineProps {
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
  onCancel: () => void;
}

export const AddEditKeyResultInline: React.FC<AddEditKeyResultInlineProps> = ({
  objectiveId,
  initialKeyResult,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialKeyResult);

  const [kind, setKind] = useState<KeyResultKind>(initialKeyResult?.kind ?? 'metric');
  const [title, setTitle] = useState(initialKeyResult?.title ?? '');
  const [unit, setUnit] = useState(initialKeyResult?.unit ?? '');
  const [startValue, setStartValue] = useState<number>(initialKeyResult?.start_value ?? 0);
  const [targetValue, setTargetValue] = useState<number>(
    initialKeyResult?.target_value ?? (kind === 'habit' ? 3 : 100)
  );
  const [resetHistory, setResetHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
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
        title: title.trim(),
        kind,
        unit: kind === 'metric' && unit.trim() ? unit.trim() : null,
        start_value: kind === 'metric' ? Number(startValue) : 0,
        target_value: kind === 'metric' || kind === 'habit' ? Number(targetValue) : 0,
        resetHistory,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsSaving(false);
    }
  };

  return (
    <form
      className={styles.formContainer}
      onSubmit={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {/* Kind Segmented Control */}
      <div className={styles.segmentedControl}>
        <button
          type="button"
          className={`${styles.segmentBtn} ${kind === 'metric' ? styles.activeSegment : ''}`}
          onClick={() => handleKindChange('metric')}
        >
          A number
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${kind === 'work' ? styles.activeSegment : ''}`}
          onClick={() => handleKindChange('work')}
        >
          Work I complete
        </button>
        <button
          type="button"
          className={`${styles.segmentBtn} ${kind === 'habit' ? styles.activeSegment : ''}`}
          onClick={() => handleKindChange('habit')}
        >
          A habit
        </button>
      </div>

      {/* Title */}
      <div className={styles.inputGroup}>
        <label className={styles.label}>Title</label>
        <input
          type="text"
          className={styles.textInput}
          placeholder={
            kind === 'metric'
              ? 'e.g. Monthly revenue'
              : kind === 'work'
              ? 'e.g. Ship new onboarding tour'
              : 'e.g. Exercise 3 times a week'
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      {/* Kind-specific inputs */}
      {kind === 'metric' && (
        <>
          <div className={styles.rowInputs}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Start</label>
              <input
                type="number"
                className={`${styles.textInput} ${styles.numberInput}`}
                value={startValue}
                onChange={(e) => setStartValue(Number(e.target.value))}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Target</label>
              <input
                type="number"
                className={`${styles.textInput} ${styles.numberInput}`}
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Unit (optional)</label>
              <input
                type="text"
                className={`${styles.textInput} ${styles.unitInput}`}
                placeholder="e.g. %, $, ms"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
          <span className={styles.helperText}>
            {targetValue > startValue
              ? `Goes up from ${startValue} to ${targetValue}`
              : targetValue < startValue
              ? `Goes down from ${startValue} to ${targetValue}`
              : 'Start and target must differ'}
          </span>
        </>
      )}

      {kind === 'habit' && (
        <div className={styles.inputGroup}>
          <label className={styles.label}>Times per week</label>
          <input
            type="number"
            min={1}
            max={7}
            className={`${styles.textInput} ${styles.numberInput}`}
            value={targetValue}
            onChange={(e) => setTargetValue(Number(e.target.value))}
          />
        </div>
      )}

      {kind === 'work' && (
        <span className={styles.helperText}>
          Progress comes from the projects and tasks you link.
        </span>
      )}

      {isEditing && (
        <label className={styles.resetHistoryRow}>
          <input
            type="checkbox"
            checked={resetHistory}
            onChange={(e) => setResetHistory(e.target.checked)}
          />
          <span>Reset history (clears existing check-ins and resets starting value)</span>
        </label>
      )}

      {error && <div className={styles.errorText}>{error}</div>}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className={styles.saveBtn} disabled={isSaving}>
          {isSaving ? 'Saving...' : isEditing ? 'Save changes' : 'Add key result'}
        </button>
      </div>
    </form>
  );
};

export default AddEditKeyResultInline;
