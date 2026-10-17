import React, { useState, useEffect } from 'react';
import type { Objective, ObjectiveCadence, ObjectivePeriodKind, KeyResultKind } from '@shared/types/index.js';
import { KeyResultRow } from './KeyResultRow.js';
import { KeyResultModal } from './KeyResultModal.js';
import { CheckInSheet } from './CheckInSheet.js';
import { GoalDropdownMenu, type GoalDropdownOption } from './GoalDropdownMenu.js';
import { PeriodPopover } from './PeriodPopover.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useOkrMetrics } from '../../hooks/useOkrMetrics.js';
import { useToday } from '../../hooks/useToday.js';
import styles from './GoalDetail.module.css';

export interface GoalDetailProps {
  objectiveId: string;
  onBack: () => void;
}

export const GoalDetail: React.FC<GoalDetailProps> = ({ objectiveId, onBack }) => {
  const todayStr = useToday();
  const metrics = useOkrMetrics(todayStr);

  const objective = useOkrStore((s) => s.objectivesById[objectiveId]);
  const updateObjective = useOkrStore((s) => s.updateObjective);
  const deleteObjective = useOkrStore((s) => s.deleteObjective);
  const createKeyResult = useOkrStore((s) => s.createKeyResult);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);

  const areasById = useAreaStore((s) => s.areasById);
  const orderedAreaIds = useAreaStore((s) => s.orderedAreaIds);

  const [title, setTitle] = useState(objective?.title || '');
  const [notes, setNotes] = useState(objective?.notes || '');
  const [isAddingKr, setIsAddingKr] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);

  useEffect(() => {
    if (objective) {
      setTitle(objective.title);
      setNotes(objective.notes || '');
    }
  }, [objective?.title, objective?.notes]);

  if (!objective) {
    return (
      <div className={styles.detailContainer}>
        <div className={styles.topBar}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to goals
          </button>
        </div>
        <p className={styles.emptyKrs}>Goal not found or has been deleted.</p>
      </div>
    );
  }

  const keyResults = Object.values(keyResultsById)
    .filter((kr) => kr.objective_id === objective.id)
    .sort((a, b) => a.title.localeCompare(b.title));

  const progress = metrics.objectiveProgressMap.get(objective.id) ?? 0;
  const due = metrics.objectiveDueMap.get(objective.id);

  const isCompleted = objective.status === 'completed';
  const isDueOrOverdue = due?.isDue || due?.isOverdue;

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== objective.title) {
      await updateObjective(objective.id, { title: trimmed });
    } else {
      setTitle(objective.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleNotesBlur = async () => {
    if (notes !== (objective.notes || '')) {
      await updateObjective(objective.id, { notes });
    }
  };

  const handlePeriodSave = async (payload: {
    period_start: string;
    period_end: string;
    period_kind: ObjectivePeriodKind;
  }) => {
    await updateObjective(objective.id, {
      period_start: payload.period_start,
      period_end: payload.period_end,
      period_kind: payload.period_kind,
    });
  };

  const handleStatusChange = async (newStatus: Objective['status']) => {
    await updateObjective(objective.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete goal "${objective.title}"?`)) {
      await deleteObjective(objective.id);
      onBack();
    }
  };

  const handleSaveKr = async (payload: {
    objective_id: string;
    title: string;
    kind: KeyResultKind;
    unit?: string | null;
    start_value?: number;
    target_value?: number;
    resetHistory?: boolean;
  }) => {
    await createKeyResult(payload);
    setIsAddingKr(false);
  };

  const isChipsDisabled = objective.status === 'archived';

  const rhythmOptions: GoalDropdownOption[] = [
    { id: 'daily', label: 'Daily', value: 'daily' },
    { id: 'weekly', label: 'Weekly', value: 'weekly' },
    { id: 'biweekly', label: 'Every 2 weeks', value: 'biweekly' },
    { id: 'monthly', label: 'Monthly', value: 'monthly' },
  ];

  const rhythmChipText = (() => {
    switch (objective.cadence) {
      case 'daily':
        return 'Check in daily';
      case 'weekly':
        return 'Check in weekly';
      case 'biweekly':
        return 'Check in every 2 weeks';
      case 'monthly':
        return 'Check in monthly';
      default:
        return 'Check in weekly';
    }
  })();

  const areaOptions: GoalDropdownOption[] = [
    { id: 'none', label: 'No area', value: null },
    ...orderedAreaIds
      .map((aid) => areasById[aid])
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => ({
        id: a.id,
        label: a.name,
        value: a.id,
      })),
  ];

  const currentArea = objective.area_id ? areasById[objective.area_id] : null;
  const areaChipText = currentArea?.name ?? 'No area';

  const menuItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'toggle-complete',
      label: isCompleted ? 'Reopen goal' : 'Mark completed',
      onClick: () => handleStatusChange(isCompleted ? 'active' : 'completed'),
    },
    {
      id: 'toggle-pause',
      label: objective.status === 'paused' ? 'Resume goal' : 'Pause goal',
      onClick: () => handleStatusChange(objective.status === 'paused' ? 'active' : 'paused'),
    },
    {
      id: 'toggle-archive',
      label: objective.status === 'archived' ? 'Unarchive' : 'Archive',
      onClick: () => handleStatusChange(objective.status === 'archived' ? 'active' : 'archived'),
    },
    'separator',
    {
      id: 'delete-goal',
      label: 'Delete goal',
      danger: true,
      onClick: handleDelete,
    },
  ];

  const health = metrics.objectiveHealthMap.get(objective.id);

  return (
    <div className={styles.detailContainer}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Goals
        </button>

        <div className={styles.topRightActions}>
          {objective.status === 'active' && keyResults.length > 0 && (
            <button
              type="button"
              className={`${styles.checkInBtn} ${isDueOrOverdue ? styles.checkInBtnFilled : ''}`}
              onClick={() => setCheckInOpen(true)}
            >
              Check in
            </button>
          )}

          <DropdownMenu
            trigger={
              <button type="button" className={styles.menuBtn} aria-label="Goal options">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="12" r="1" />
                </svg>
              </button>
            }
            items={menuItems}
          />
        </div>
      </div>

      {/* Header section with title and metadata pills */}
      <div className={styles.headerSection}>
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="Goal title"
        />

        <div className={styles.metaRow}>
          {/* Period Pill (Editable Popover) */}
          <PeriodPopover
            objective={objective}
            onSave={handlePeriodSave}
            disabled={isChipsDisabled}
          />

          {/* Rhythm Dropdown */}
          <GoalDropdownMenu
            chipText={rhythmChipText}
            items={rhythmOptions}
            currentValue={objective.cadence}
            onSelect={async (val) => {
              if (val) await updateObjective(objective.id, { cadence: val as ObjectiveCadence });
            }}
            ariaLabel="Check-in rhythm"
            disabled={isChipsDisabled}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
          />

          {/* Area Dropdown */}
          <GoalDropdownMenu
            chipText={areaChipText}
            items={areaOptions}
            currentValue={objective.area_id ?? null}
            onSelect={async (val) => {
              await updateObjective(objective.id, { area_id: val });
            }}
            ariaLabel="Goal area"
            disabled={isChipsDisabled}
            icon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Progress Hero - text only, no box, no ring, no bar */}
      {keyResults.length === 0 ? (
        <div className={styles.progressHero}>
          <span className={styles.progressEmpty}>No key results yet</span>
        </div>
      ) : (
        <div className={styles.progressHero}>
          <span className={styles.progressPercent}>{progress}%</span>
          <span className={styles.progressKrCount}>
            of {keyResults.length} {keyResults.length === 1 ? 'key result' : 'key results'}
          </span>
          <span className={styles.progressSeparator}>·</span>
          {health === null ? (
            <span className={styles.progressHealthNoCheckIn}>No check-in yet</span>
          ) : health === 'on_track' ? (
            <span className={styles.progressHealthOnTrack}>On track</span>
          ) : health === 'at_risk' ? (
            <span className={styles.progressHealthAtRisk}>At risk</span>
          ) : (
            <span className={styles.progressHealthOffTrack}>Off track</span>
          )}
          {due?.isOverdue && (
            <>
              <span className={styles.progressSeparator}>·</span>
              <span className={styles.progressHealthOffTrack}>Check-in overdue</span>
            </>
          )}
          {due?.isDue && !due?.isOverdue && (
            <>
              <span className={styles.progressSeparator}>·</span>
              <span className={styles.progressHealthAtRisk}>Check-in due</span>
            </>
          )}
        </div>
      )}

      {/* Notes / Narrative - no label, placeholder "Why this matters", no resize grip */}
      <div className={styles.notesSection}>
        <textarea
          className={styles.notesInput}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Why this matters"
          rows={1}
        />
      </div>

      {/* Key Results Section */}
      <div className={styles.krSection}>
        <div className={styles.krSectionHeader}>
          <h2 className={styles.krSectionTitle}>KEY RESULTS</h2>
          <button
            type="button"
            className={styles.addKrBtn}
            onClick={() => setIsAddingKr(true)}
          >
            + Add
          </button>
        </div>

        <div className={styles.krList}>
          {keyResults.length === 0 ? (
            <div className={styles.emptyKrs}>
              No key results yet. Add one to measure progress toward this goal.
            </div>
          ) : (
            keyResults.map((kr) => <KeyResultRow key={kr.id} keyResult={kr} />)
          )}
        </div>
      </div>

      {/* Add key result modal */}
      <KeyResultModal
        open={isAddingKr}
        onOpenChange={setIsAddingKr}
        objectiveId={objective.id}
        onSave={handleSaveKr}
      />

      {/* Check-In Sheet */}
      <CheckInSheet
        objective={objective}
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
      />
    </div>
  );
};

export default GoalDetail;
