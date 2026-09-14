import React, { useState, useMemo, useEffect } from 'react';
import {
  humanReadableRRule,
  buildCustomRRule,
  type BuildCustomRRuleOptions,
} from '../../../shared/utils/recurrence.js';
import styles from './RecurrencePicker.module.css';

export interface RecurrencePickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRule?: string | null;
  currentBasis?: 'fixed' | 'after_completion' | null;
  onSave: (rule: string | null, basis: 'fixed' | 'after_completion' | null) => void;
  onSkipOccurrence?: () => void;
}

const PRESETS = [
  { label: 'Daily', rule: 'RRULE:FREQ=DAILY' },
  { label: 'Weekdays', rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly', rule: 'RRULE:FREQ=WEEKLY' },
  { label: 'Monthly', rule: 'RRULE:FREQ=MONTHLY' },
  { label: 'Yearly', rule: 'RRULE:FREQ=YEARLY' },
];

const DAYS_OF_WEEK = [
  { key: 'MO', label: 'M' },
  { key: 'TU', label: 'T' },
  { key: 'WE', label: 'W' },
  { key: 'TH', label: 'Th' },
  { key: 'FR', label: 'F' },
  { key: 'SA', label: 'Sa' },
  { key: 'SU', label: 'Su' },
];

export function RecurrencePicker({
  isOpen,
  onClose,
  currentRule,
  currentBasis,
  onSave,
  onSkipOccurrence,
}: RecurrencePickerProps): React.ReactElement | null {
  const [selectedRule, setSelectedRule] = useState<string | null>(currentRule ?? null);
  const [isAfterCompletion, setIsAfterCompletion] = useState<boolean>(currentBasis === 'after_completion');

  // Custom builder state
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [freq, setFreq] = useState<BuildCustomRRuleOptions['frequency']>('WEEKLY');
  const [interval, setInterval] = useState<number>(1);
  const [selectedDays, setSelectedDays] = useState<string[]>(['MO']);

  useEffect(() => {
    if (isOpen) {
      setSelectedRule(currentRule ?? null);
      setIsAfterCompletion(currentBasis === 'after_completion');
      setIsCustomMode(false);
    }
  }, [isOpen, currentRule, currentBasis]);

  // Compute live custom rule if in custom mode
  const activeCustomRule = useMemo(() => {
    return buildCustomRRule({
      frequency: freq,
      interval: Math.max(1, interval),
      daysOfWeek: freq === 'WEEKLY' ? selectedDays : undefined,
    });
  }, [freq, interval, selectedDays]);

  const effectiveRule = isCustomMode ? activeCustomRule : selectedRule;

  const humanPreview = useMemo(() => {
    if (!effectiveRule) return 'Does not repeat';
    return humanReadableRRule(effectiveRule);
  }, [effectiveRule]);

  if (!isOpen) return null;

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

  const handleApplyPreset = (rule: string) => {
    setSelectedRule(rule);
    setIsCustomMode(false);
  };

  const handleSave = () => {
    const basis = isAfterCompletion ? 'after_completion' : 'fixed';
    onSave(effectiveRule, effectiveRule ? basis : null);
    onClose();
  };

  const handleRemove = () => {
    onSave(null, null);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Repeat Task</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Presets */}
        <div className={styles.presetGrid}>
          {PRESETS.map((p) => {
            const isActive = !isCustomMode && selectedRule === p.rule;
            return (
              <button
                key={p.label}
                type="button"
                className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ''}`}
                onClick={() => handleApplyPreset(p.rule)}
              >
                {p.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`${styles.presetBtn} ${isCustomMode ? styles.presetBtnActive : ''}`}
            onClick={() => setIsCustomMode(true)}
          >
            Custom...
          </button>
        </div>

        {/* Custom Builder */}
        {isCustomMode && (
          <div className={styles.customSection}>
            <div className={styles.customRow}>
              <span className={styles.customLabel}>Every</span>
              <input
                type="number"
                min="1"
                max="99"
                className={styles.numberInput}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
              <select
                className={styles.selectInput}
                value={freq}
                onChange={(e) => setFreq(e.target.value as BuildCustomRRuleOptions['frequency'])}
              >
                <option value="DAILY">Day(s)</option>
                <option value="WEEKLY">Week(s)</option>
                <option value="MONTHLY">Month(s)</option>
                <option value="YEARLY">Year(s)</option>
              </select>
            </div>

            {freq === 'WEEKLY' && (
              <div className={styles.dayButtonGroup}>
                {DAYS_OF_WEEK.map((d) => {
                  const isDaySelected = selectedDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={`${styles.dayBtn} ${isDaySelected ? styles.dayBtnActive : ''}`}
                      onClick={() => handleDayToggle(d.key)}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* After Completion Toggle */}
        <div className={styles.basisToggle}>
          <div className={styles.basisInfo}>
            <span className={styles.basisTitle}>Repeat after completion</span>
            <span className={styles.basisDesc}>
              {isAfterCompletion
                ? 'Next instance schedules from today when completed'
                : 'Next instance follows strict fixed calendar dates'}
            </span>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={isAfterCompletion}
              onChange={(e) => setIsAfterCompletion(e.target.checked)}
            />
            <span className={styles.slider} />
          </label>
        </div>

        {/* Live Preview */}
        <div className={styles.previewBox}>
          Schedule: <span className={styles.previewHighlight}>{humanPreview}</span>
          {effectiveRule && isAfterCompletion && <span> (calculated after completion)</span>}
        </div>

        {/* Action Controls */}
        <div className={styles.actions}>
          <div className={styles.leftActions}>
            {selectedRule && (
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleRemove}>
                Remove
              </button>
            )}
            {currentRule && onSkipOccurrence && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnWarning}`}
                onClick={() => {
                  onSkipOccurrence();
                  onClose();
                }}
                title="Complete task now without generating next recurring instance"
              >
                Skip occurrence
              </button>
            )}
          </div>

          <div className={styles.rightActions}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecurrencePicker;
