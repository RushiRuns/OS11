import React, { memo, useState, useMemo } from 'react';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import type {
  Goal,
  GoalLink,
  GoalStreakStatus,
  GoalDeadlineInfo,
  Task,
  Project,
} from '../../../shared/types/index.js';
import styles from './GoalCard.module.css';

export interface GoalCardProps {
  goal: Goal;
  progress: number;
  links: GoalLink[];
  subGoals: Goal[];
  isHabit: boolean;
  streakStatus: GoalStreakStatus | null;
  deadlineInfo: GoalDeadlineInfo;
  parentGoalTitle?: string;
  tasksById: Record<string, Task>;
  projectsById: Record<string, Project>;
  onOpenContextMenu: (goal: Goal, pos: { x: number; y: number }) => void;
  onCheckInHabit: (goal: Goal) => void;
  onIncrementStreak: (goal: Goal) => void;
  onAdjustProgress: (goalId: string, delta: number) => void;
  onMarkCompleted: (goal: Goal) => void;
  onReopenGoal: (goal: Goal) => void;
  onToggleArchive: (goal: Goal) => void;
  onOpenEdit: (goal: Goal) => void;
  onLinkResource: (goalId: string, resourceId: string, resourceType: 'task' | 'project') => void;
  onUnlinkResource: (goalId: string, resourceId: string, resourceType: 'task' | 'project') => void;
}

export const GoalCard = memo(function GoalCard({
  goal,
  progress,
  links,
  subGoals,
  isHabit,
  streakStatus,
  deadlineInfo,
  parentGoalTitle,
  tasksById,
  projectsById,
  onOpenContextMenu,
  onCheckInHabit,
  onIncrementStreak,
  onAdjustProgress,
  onMarkCompleted,
  onReopenGoal,
  onToggleArchive,
  onOpenEdit,
  onLinkResource,
  onUnlinkResource,
}: GoalCardProps): React.ReactElement {
  const [isExpandedSubGoals, setIsExpandedSubGoals] = useState(false);
  const [isExpandedLinks, setIsExpandedLinks] = useState(false);
  const [isExpandedHabitStrip, setIsExpandedHabitStrip] = useState(false);

  const availableTasksToLink = useMemo(() => {
    const existing = new Set(
      links.filter((l) => l.resource_type === 'task').map((l) => l.resource_id)
    );
    return Object.values(tasksById).filter((t) => !existing.has(t.id) && t.is_trashed === 0);
  }, [links, tasksById]);

  const availableProjectsToLink = useMemo(() => {
    const existing = new Set(
      links.filter((l) => l.resource_type === 'project').map((l) => l.resource_id)
    );
    return Object.values(projectsById).filter((p) => !existing.has(p.id) && p.status !== 'archived');
  }, [links, projectsById]);

  const cardClass = [
    styles.goalCard,
    goal.status === 'completed' ? styles.goalCardCompleted : '',
    goal.status === 'paused' ? styles.goalCardPaused : '',
    goal.status === 'archived' ? styles.goalCardArchived : '',
    deadlineInfo.state === 'overdue' ? styles.goalCardOverdue : '',
    deadlineInfo.state === 'due_today' ? styles.goalCardDueToday : '',
  ]
    .filter(Boolean)
    .join(' ');

  const typeBadgeClass =
    goal.goal_type === 'habit'
      ? styles.badgeHabit
      : goal.goal_type === 'outcome'
        ? styles.badgeOutcome
        : styles.badgeMilestone;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenContextMenu(goal, { x: e.clientX, y: e.clientY });
  };

  const handleMenuButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onOpenContextMenu(goal, { x: rect.right - 200, y: rect.bottom + 4 });
  };

  return (
    <div
      className={cardClass}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role="region"
      aria-label={`Goal: ${goal.title}`}
    >
      {/* Top Header: Badges & Overflow Menu */}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderBadges}>
          <span className={`${styles.badge} ${typeBadgeClass}`}>
            {goal.goal_type}
          </span>

          {goal.category && (
            <span className={`${styles.badge} ${styles.badgeCategory}`} title={`Category: ${goal.category}`}>
              🏷️ {goal.category}
            </span>
          )}

          {goal.status === 'completed' && (
            <span className={`${styles.badge} ${styles.badgeCompleted}`}>
              ✓ Completed
            </span>
          )}

          {goal.status === 'paused' && (
            <span className={`${styles.badge} ${styles.badgePaused}`}>
              ⏸ Paused
            </span>
          )}

          {goal.status === 'archived' && (
            <span className={`${styles.badge} ${styles.badgeArchived}`}>
              📦 Archived
            </span>
          )}

          {isHabit && streakStatus && streakStatus.currentStreak > 0 && (
            <span
              className={styles.streakFlame}
              title={`Streak: ${streakStatus.currentStreak}d (Best: ${streakStatus.longestStreak}d)`}
            >
              🔥 {streakStatus.currentStreak}d
            </span>
          )}

          {!isHabit && goal.streak_count > 0 && (
            <span
              className={styles.streakFlame}
              title="Active streak (click to +1)"
              onClick={() => onIncrementStreak(goal)}
              style={{ cursor: 'pointer' }}
            >
              🔥 {goal.streak_count}d
            </span>
          )}
        </div>

        {/* 3-dots Menu trigger */}
        <button
          type="button"
          className={styles.menuTriggerBtn}
          onClick={handleMenuButtonClick}
          title="More options (Edit, Duplicate, Delete...)"
          aria-label="More options"
        >
          •••
        </button>
      </div>

      {/* Title & Description */}
      <div className={styles.cardTitleArea}>
        {parentGoalTitle && (
          <div className={styles.parentGoalTag}>
            <span>↳ Sub-goal of:</span>
            <strong>{parentGoalTitle}</strong>
          </div>
        )}

        <h2 className={styles.goalTitle} title={goal.title}>
          {goal.title}
        </h2>

        {goal.description && (
          <p className={styles.goalDesc} title={goal.description}>
            {goal.description}
          </p>
        )}
      </div>

      {/* Progress Bar & Value Row */}
      <div className={styles.progressSection}>
        <ProgressBar progress={progress} showLabel={false} />
        <div className={styles.progressInfoRow}>
          <span>
            {links.length > 0
              ? `${links.length} linked resources`
              : `${goal.current_value} / ${goal.target_value}`}
          </span>
          <span className={styles.progressPercentage}>{progress}%</span>
        </div>
      </div>

      {/* Interactive Chips (Tier 2 Progressive Disclosure) */}
      <div className={styles.chipsRow}>
        {subGoals.length > 0 && (
          <button
            type="button"
            className={`${styles.chipBtn} ${isExpandedSubGoals ? styles.chipBtnActive : ''}`}
            onClick={() => setIsExpandedSubGoals((prev) => !prev)}
            aria-expanded={isExpandedSubGoals}
          >
            <span>{isExpandedSubGoals ? '▾' : '▸'}</span>
            <span>{subGoals.length} Sub-goals</span>
          </button>
        )}

        {(links.length > 0 || goal.status !== 'archived') && (
          <button
            type="button"
            className={`${styles.chipBtn} ${isExpandedLinks ? styles.chipBtnActive : ''}`}
            onClick={() => setIsExpandedLinks((prev) => !prev)}
            aria-expanded={isExpandedLinks}
          >
            <span>📁</span>
            <span>{links.length > 0 ? `${links.length} Resources` : '+ Link Resource'}</span>
          </button>
        )}

        {isHabit && streakStatus && (
          <button
            type="button"
            className={`${styles.chipBtn} ${isExpandedHabitStrip ? styles.chipBtnActive : ''}`}
            onClick={() => setIsExpandedHabitStrip((prev) => !prev)}
            aria-expanded={isExpandedHabitStrip}
          >
            <span>📅</span>
            <span>7-Day History</span>
          </button>
        )}
      </div>

      {/* Expandable Sub-goals Drawer */}
      {subGoals.length > 0 && (
        <div className={`${styles.drawerContainer} ${isExpandedSubGoals ? styles.drawerContainerOpen : ''}`}>
          <div className={styles.drawerInner}>
            <div className={styles.drawerBox}>
              <div className={styles.drawerHeader}>
                <span>Sub-goals / OKRs ({subGoals.length})</span>
              </div>
              <div className={styles.subGoalsList}>
                {subGoals.map((sub) => {
                  const subProgress =
                    sub.target_value > 0
                      ? Math.min(100, Math.round(((sub.current_value || 0) / sub.target_value) * 100))
                      : 0;
                  return (
                    <div key={sub.id} className={styles.subGoalItem}>
                      <div className={styles.subGoalTitleRow}>
                        <span className={styles.subGoalTitle}>
                          <span className={styles.subGoalBullet}>▸</span>
                          {sub.title}
                        </span>
                        <span className={styles.subGoalPercent}>{subProgress}%</span>
                      </div>
                      <div className={styles.subGoalProgressTrack}>
                        <div
                          className={styles.subGoalProgressBar}
                          style={{ width: `${subProgress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Linked Resources Drawer */}
      <div className={`${styles.drawerContainer} ${isExpandedLinks ? styles.drawerContainerOpen : ''}`}>
        <div className={styles.drawerInner}>
          <div className={styles.drawerBox}>
            <div className={styles.drawerHeader}>
              <span>Linked Resources ({links.length})</span>
            </div>

            {/* Resource Linker Picker */}
            {goal.status !== 'archived' && (
              <select
                className={styles.linkPickerSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const [type, id] = e.target.value.split(':') as ['task' | 'project', string];
                    onLinkResource(goal.id, id, type);
                  }
                }}
              >
                <option value="">+ Link a project or task...</option>
                {availableProjectsToLink.length > 0 && (
                  <optgroup label="Projects">
                    {availableProjectsToLink.map((p) => (
                      <option key={`project:${p.id}`} value={`project:${p.id}`}>
                        📁 {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableTasksToLink.length > 0 && (
                  <optgroup label="Tasks">
                    {availableTasksToLink.map((t) => (
                      <option key={`task:${t.id}`} value={`task:${t.id}`}>
                        ✓ {t.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            {/* List of Linked Items */}
            {links.length > 0 && (
              <div className={styles.linkList}>
                {links.map((link) => {
                  if (link.resource_type === 'project') {
                    const project = projectsById[link.resource_id];
                    if (!project) return null;
                    return (
                      <div key={`project-${link.resource_id}`} className={styles.linkItem}>
                        <span title={project.name}>📁 {project.name}</span>
                        {goal.status !== 'archived' && (
                          <button
                            type="button"
                            className={styles.unlinkBtn}
                            onClick={() => onUnlinkResource(goal.id, link.resource_id, 'project')}
                            title="Unlink project"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  }

                  const task = tasksById[link.resource_id];
                  if (!task) return null;
                  return (
                    <div key={`task-${link.resource_id}`} className={styles.linkItem}>
                      <span
                        title={task.title}
                        style={{
                          textDecoration: task.is_completed === 1 ? 'line-through' : 'none',
                          color: task.is_completed === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        }}
                      >
                        {task.is_completed === 1 ? '✓ ' : '○ '}
                        {task.title}
                      </span>
                      {goal.status !== 'archived' && (
                        <button
                          type="button"
                          className={styles.unlinkBtn}
                          onClick={() => onUnlinkResource(goal.id, link.resource_id, 'task')}
                          title="Unlink task"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Habit 7-Day Consistency Drawer */}
      {isHabit && streakStatus && (
        <div className={`${styles.drawerContainer} ${isExpandedHabitStrip ? styles.drawerContainerOpen : ''}`}>
          <div className={styles.drawerInner}>
            <div className={styles.drawerBox}>
              <div className={styles.drawerHeader}>
                <span>Last 7 Days</span>
                <span style={{ fontWeight: 'normal', color: 'var(--text-tertiary)' }}>
                  Best: <strong>{streakStatus.longestStreak}d</strong>
                </span>
              </div>
              <div className={styles.habitStripRow}>
                {streakStatus.recentDays.map((d) => (
                  <div
                    key={d.date}
                    className={`${styles.dayDot} ${d.checked ? styles.dayDotChecked : ''} ${d.isToday ? styles.dayDotToday : ''}`}
                    title={`${d.date} (${d.dayLabel}): ${d.checked ? 'Checked in' : 'Missed'}${d.isToday ? ' (Today)' : ''}`}
                  >
                    <span>{d.dayLabel}</span>
                    <span className={styles.dayDotIndicator}>{d.checked ? '✓' : '·'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Footer: Deadline & Single Primary Fast Action */}
      <div className={styles.cardFooter}>
        <div className={styles.cardFooterLeft}>
          <span>
            {goal.status === 'completed' && goal.completed_at
              ? `🏆 ${new Date(goal.completed_at).toLocaleDateString()}`
              : goal.target_date
                ? `🎯 ${goal.target_date}`
                : 'No target date'}
          </span>

          {goal.status !== 'completed' && goal.status !== 'archived' && deadlineInfo.state !== 'none' && (
            <span
              className={
                deadlineInfo.state === 'overdue'
                  ? styles.deadlineBadgeOverdue
                  : deadlineInfo.state === 'due_today'
                    ? styles.deadlineBadgeDueToday
                    : deadlineInfo.state === 'due_soon'
                      ? styles.deadlineBadgeDueSoon
                      : styles.deadlineBadgeOnTrack
              }
            >
              {deadlineInfo.label}
            </span>
          )}
        </div>

        {/* Primary Action Button */}
        <div className={styles.primaryActionGroup}>
          {goal.status === 'archived' ? (
            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => onToggleArchive(goal)}
              title="Restore to active"
            >
              ↺ Unarchive
            </button>
          ) : isHabit && streakStatus ? (
            <button
              type="button"
              className={`${styles.primaryActionBtn} ${
                streakStatus.checkedInToday ? styles.btnDoneToday : styles.btnCheckIn
              }`}
              onClick={() => onCheckInHabit(goal)}
              title={streakStatus.checkedInToday ? 'Checked in today! Click to undo' : 'Check in for today'}
            >
              {streakStatus.checkedInToday
                ? '✓ Done Today'
                : streakStatus.health === 'broken'
                  ? '+ Restart'
                  : '+ Check In'}
            </button>
          ) : links.length === 0 ? (
            /* Numeric Stepper */
            <div className={styles.stepperWrap}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => onAdjustProgress(goal.id, -1)}
                title="Decrease progress (-1)"
                aria-label="Decrease progress"
              >
                −
              </button>
              <span
                className={styles.stepperLabel}
                title="Click to edit values"
                onClick={() => onOpenEdit(goal)}
                style={{ cursor: 'pointer' }}
              >
                {goal.current_value} / {goal.target_value}
              </span>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => onAdjustProgress(goal.id, 1)}
                title="Increase progress (+1)"
                aria-label="Increase progress"
              >
                +
              </button>
            </div>
          ) : goal.status === 'completed' ? (
            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => onReopenGoal(goal)}
              title="Reopen goal"
            >
              ↺ Reopen
            </button>
          ) : progress >= 100 ? (
            <button
              type="button"
              className={`${styles.primaryActionBtn} ${styles.btnCompleteCelebration}`}
              onClick={() => onMarkCompleted(goal)}
              title="Celebrate & complete goal"
            >
              🎉 Complete
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => onMarkCompleted(goal)}
              title="Mark completed"
            >
              ✓ Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
