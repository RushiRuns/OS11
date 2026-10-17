import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useToday } from '../../hooks/useToday.js';
import { formatDueLabel } from '../tasks/due-label.js';
import type { Objective, KeyResult, KeyResultStatus, CheckInEntryPayload } from '@shared/types/index.js';
import styles from './CheckInSheet.module.css';

export interface CheckInSheetProps {
  objective: Objective;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormKRState {
  value: number;
  status: KeyResultStatus;
  note: string;
}

export const CheckInSheet: React.FC<CheckInSheetProps> = ({
  objective,
  open,
  onOpenChange,
}) => {
  const todayStr = useToday();

  const keyResultsById = useOkrStore((s) => s.keyResultsById);
  const checkInsByKeyResultId = useOkrStore((s) => s.checkInsByKeyResultId);
  const recordCheckIns = useOkrStore((s) => s.recordCheckIns);

  const keyResults: KeyResult[] = Object.values(keyResultsById)
    .filter((kr) => kr.objective_id === objective.id)
    .sort((a, b) => {
      // Stale key results first (older checked_in_on first)
      const aCheckIns = checkInsByKeyResultId[a.id] || [];
      const bCheckIns = checkInsByKeyResultId[b.id] || [];
      const aLatest = aCheckIns[0]?.checked_in_on || '';
      const bLatest = bCheckIns[0]?.checked_in_on || '';
      return aLatest.localeCompare(bLatest);
    });

  const [formState, setFormState] = useState<Record<string, FormKRState>>({});
  const [notesRevealed, setNotesRevealed] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const initial: Record<string, FormKRState> = {};
      const initialNotes: Record<string, boolean> = {};
      for (const kr of keyResults) {
        const lastCheckIn = (checkInsByKeyResultId[kr.id] || [])[0];
        const status = lastCheckIn?.status ?? kr.status ?? 'on_track';
        initial[kr.id] = {
          value: kr.current_value,
          status,
          note: '',
        };
        if (status === 'at_risk' || status === 'off_track') {
          initialNotes[kr.id] = true;
        }
      }
      setFormState(initial);
      setNotesRevealed(initialNotes);
    }
  }, [open, keyResultsById]);

  const handleChange = (krId: string, updates: Partial<FormKRState>) => {
    setFormState((prev) => ({
      ...prev,
      [krId]: {
        ...prev[krId],
        ...updates,
      },
    }));
    if (updates.status === 'at_risk' || updates.status === 'off_track') {
      setNotesRevealed((prev) => ({ ...prev, [krId]: true }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const entries: CheckInEntryPayload[] = keyResults.map((kr) => {
      const state = formState[kr.id] || {
        value: kr.current_value,
        status: kr.status || 'on_track',
        note: '',
      };
      return {
        keyResultId: kr.id,
        value: Number(state.value),
        status: state.status,
        note: state.note.trim() ? state.note.trim() : null,
      };
    });

    setIsSubmitting(true);
    try {
      await recordCheckIns(entries, todayStr);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut Ctrl/Cmd + Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const todayLabel = formatDueLabel(todayStr)?.label ?? todayStr;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Check in"
      description={`${objective.title} · ${todayLabel}`}
    >
      <form className={styles.sheetContainer} onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        {keyResults.map((kr, idx) => {
          const state = formState[kr.id] || {
            value: kr.current_value,
            status: kr.status || 'on_track',
            note: '',
          };
          const lastCheckIn = (checkInsByKeyResultId[kr.id] || [])[0];
          const lastDateLabel = lastCheckIn
            ? formatDueLabel(lastCheckIn.checked_in_on)?.label ?? lastCheckIn.checked_in_on
            : null;
          const unitSuffix = kr.unit ? ` ${kr.unit}` : '';
          const isNoteVisible =
            notesRevealed[kr.id] ||
            state.status === 'at_risk' ||
            state.status === 'off_track' ||
            Boolean(state.note.trim());

          return (
            <div key={kr.id} className={styles.krCheckInCard}>
              <div className={styles.krTitleRow}>
                <span className={styles.krTitle}>{kr.title}</span>
                {lastCheckIn && (
                  <span className={styles.lastCheckInText}>
                    Last: {lastCheckIn.value}{unitSuffix} on {lastDateLabel}
                  </span>
                )}
              </div>

              {/* Number Input with unit as a suffix, first one autofocused */}
              {kr.kind === 'metric' && (
                <div className={styles.inputRow}>
                  <div className={styles.numberInputContainer}>
                    <input
                      type="number"
                      className={styles.numberInput}
                      value={state.value}
                      onChange={(e) => handleChange(kr.id, { value: Number(e.target.value) })}
                      autoFocus={idx === 0}
                    />
                    {kr.unit && <span className={styles.unitSuffix}>{kr.unit}</span>}
                  </div>
                </div>
              )}

              {/* Status 3-option Segmented Control with Dots */}
              <div className={styles.segmentedStatus} role="radiogroup" aria-label="Health status">
                <button
                  type="button"
                  role="radio"
                  aria-checked={state.status === 'on_track'}
                  className={`${styles.statusBtn} ${state.status === 'on_track' ? styles.statusActive : ''}`}
                  onClick={() => handleChange(kr.id, { status: 'on_track' })}
                >
                  <span className={`${styles.statusDot} ${styles.dotOnTrack}`} />
                  <span>On track</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={state.status === 'at_risk'}
                  className={`${styles.statusBtn} ${state.status === 'at_risk' ? styles.statusActive : ''}`}
                  onClick={() => handleChange(kr.id, { status: 'at_risk' })}
                >
                  <span className={`${styles.statusDot} ${styles.dotAtRisk}`} />
                  <span>At risk</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={state.status === 'off_track'}
                  className={`${styles.statusBtn} ${state.status === 'off_track' ? styles.statusActive : ''}`}
                  onClick={() => handleChange(kr.id, { status: 'off_track' })}
                >
                  <span className={`${styles.statusDot} ${styles.dotOffTrack}`} />
                  <span>Off track</span>
                </button>
              </div>

              {/* Note input revealed quietly or auto when at risk / off track */}
              {isNoteVisible ? (
                <input
                  type="text"
                  className={styles.noteInput}
                  placeholder={
                    state.status !== 'on_track'
                      ? 'What is putting this at risk or off track?'
                      : 'Add note...'
                  }
                  value={state.note}
                  onChange={(e) => handleChange(kr.id, { note: e.target.value })}
                  autoFocus={state.status === 'at_risk' || state.status === 'off_track'}
                />
              ) : (
                <button
                  type="button"
                  className={styles.addNoteBtn}
                  onClick={() => setNotesRevealed((prev) => ({ ...prev, [kr.id]: true }))}
                >
                  + Add note
                </button>
              )}
            </div>
          );
        })}

        <div className={styles.actions}>
          <span className={styles.shortcutHint}>Ctrl+Enter to save</span>
          <div className={styles.btnGroup}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save check-in'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
};

export default CheckInSheet;
