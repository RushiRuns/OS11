import React from 'react';
import type { Objective } from '@shared/types/index.js';
import { ProgressRing } from './ProgressRing.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useOkrMetrics } from '../../hooks/useOkrMetrics.js';
import { useToday } from '../../hooks/useToday.js';
import { formatDueLabel } from '../tasks/due-label.js';
import { currentQuarter } from '@shared/utils/okr.js';
import styles from './GoalRow.module.css';

export interface GoalRowProps {
  objective: Objective;
  onClick: () => void;
  onCheckInClick: () => void;
}

export const GoalRow: React.FC<GoalRowProps> = ({
  objective,
  onClick,
  onCheckInClick,
}) => {
  const todayStr = useToday();
  const metrics = useOkrMetrics(todayStr);

  const updateObjective = useOkrStore((s) => s.updateObjective);
  const deleteObjective = useOkrStore((s) => s.deleteObjective);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);

  const keyResults = Object.values(keyResultsById).filter(
    (kr) => kr.objective_id === objective.id
  );

  const progress = metrics.objectiveProgressMap.get(objective.id) ?? 0;
  const state = metrics.objectiveStateMap.get(objective.id);
  const due = metrics.objectiveDueMap.get(objective.id);

  const isCompleted = objective.status === 'completed';
  const isDueOrOverdue = due?.isDue || due?.isOverdue;

  const handleStatusChange = async (newStatus: Objective['status']) => {
    await updateObjective(objective.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete goal "${objective.title}"?`)) {
      await deleteObjective(objective.id);
    }
  };

  const menuItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'toggle-complete',
      label: isCompleted ? 'Reopen goal' : 'Mark completed',
      onClick: () => handleStatusChange(isCompleted ? 'active' : 'completed'),
    },
    {
      id: 'toggle-pause',
      label: objective.status === 'paused' ? 'Resume goal' : 'Pause goal',
      onClick: () =>
        handleStatusChange(objective.status === 'paused' ? 'active' : 'paused'),
    },
    {
      id: 'toggle-archive',
      label: objective.status === 'archived' ? 'Unarchive goal' : 'Archive goal',
      onClick: () =>
        handleStatusChange(objective.status === 'archived' ? 'active' : 'archived'),
    },
    'separator',
    {
      id: 'delete-goal',
      label: 'Delete goal',
      danger: true,
      onClick: handleDelete,
    },
  ];

  const renderStateBadge = () => {
    if (!state) return null;
    let className = styles.statePill;
    let label = state.replace('_', ' ');

    switch (state) {
      case 'overdue':
        className += ` ${styles.stateOverdue}`;
        label = `Overdue by ${due?.daysOverdue || 1}d`;
        break;
      case 'due':
        className += ` ${styles.stateDue}`;
        label = 'Check-in due';
        break;
      case 'off_track':
        className += ` ${styles.stateOffTrack}`;
        label = 'Off track';
        break;
      case 'at_risk':
        className += ` ${styles.stateAtRisk}`;
        label = 'At risk';
        break;
      case 'behind_pace':
        className += ` ${styles.stateBehind}`;
        label = 'Behind pace';
        break;
      case 'paused':
        className += ` ${styles.statePaused}`;
        label = 'Paused';
        break;
      case 'ended':
        className += ` ${styles.statePaused}`;
        label = 'Period ended';
        break;
    }

    return <span className={className}>{label}</span>;
  };

  return (
    <div className={styles.goalRow} onClick={onClick}>
      <div className={styles.leftSection}>
        <ProgressRing progress={progress} size={22} strokeWidth={2.4} />

        <div className={styles.infoColumn}>
          <div className={styles.titleRow}>
            <span className={`${styles.title} ${isCompleted ? styles.completedTitle : ''}`}>
              {objective.title}
            </span>
            {renderStateBadge()}
          </div>

          <div className={styles.metaRow}>
            <span>
              {objective.period_kind === 'quarter'
                ? currentQuarter(objective.period_start).label
                : `${formatDueLabel(objective.period_start)?.label ?? objective.period_start} to ${formatDueLabel(objective.period_end)?.label ?? objective.period_end}`}
            </span>
            <span className={styles.metaDot}>·</span>
            <span>
              {objective.cadence === 'daily'
                ? 'Check in daily'
                : objective.cadence === 'weekly'
                ? 'Check in weekly'
                : objective.cadence === 'biweekly'
                ? 'Check in every 2 weeks'
                : 'Check in monthly'}
            </span>
            <span className={styles.metaDot}>·</span>
            <span>
              {keyResults.length} {keyResults.length === 1 ? 'key result' : 'key results'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.rightSection} onClick={(e) => e.stopPropagation()}>
        <span className={styles.progressText}>{progress}%</span>

        {objective.status === 'active' && keyResults.length > 0 && (
          <button
            type="button"
            className={`${styles.checkInBtn} ${isDueOrOverdue ? styles.checkInBtnFilled : ''}`}
            onClick={onCheckInClick}
          >
            Check in
          </button>
        )}

        <DropdownMenu
          trigger={
            <button type="button" className={styles.menuTriggerBtn} aria-label="Goal options">
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
  );
};

export default GoalRow;
