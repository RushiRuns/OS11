import React, { useState, useEffect, useMemo } from 'react';
import { useGoalStore } from '../../stores/goalStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { Toast } from '../../components/Toast/Toast.js';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { HabitTracker } from './HabitTracker.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload } from '../../../shared/types/index.js';
import styles from './GoalsView.module.css';

export function GoalsView(): React.ReactElement {
  const isHabitsEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');
  const effectiveTab = isHabitsEnabled && activeTab === 'habits' ? 'habits' : 'goals';

  const {
    goalsById,
    linksByGoalId,
    loadGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    linkTask,
    unlinkTask,
    incrementStreak,
    adjustGoalProgress,
    restoreGoal,
  } = useGoalStore();

  const { pushAction, undo, lastToastAction, clearToast } = useUndoRedo();
  const tasksById = useTaskStore((state) => state.tasksById);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const [isReviewDismissed, setIsReviewDismissed] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<'habit' | 'milestone' | 'outcome'>('milestone');
  const [targetDate, setTargetDate] = useState('');
  const [targetValue, setTargetValue] = useState<number>(100);
  const [currentValue, setCurrentValue] = useState<number>(0);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const goals = useMemo(() => {
    return Object.values(goalsById).sort((a, b) => {
      if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
      if (a.target_date) return -1;
      if (b.target_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [goalsById]);

  // Is today Friday? (Day 5)
  const isFriday = useMemo(() => new Date().getDay() === 5, []);
  const showWeeklyReview = isFriday && !isReviewDismissed;

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setGoalType('milestone');
    setTargetDate('');
    setTargetValue(100);
    setCurrentValue(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setDescription(goal.description ?? '');
    setGoalType(goal.goal_type);
    setTargetDate(goal.target_date ?? '');
    setTargetValue(goal.target_value ?? 100);
    setCurrentValue(goal.current_value ?? 0);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tVal = Number(targetValue) > 0 ? Number(targetValue) : 100;
    const cVal = Math.max(0, Number(currentValue) || 0);

    if (editingGoal) {
      const payload: UpdateGoalPayload = {
        title: title.trim(),
        description: description.trim() || null,
        goal_type: goalType,
        target_date: targetDate || null,
        target_value: tVal,
        current_value: cVal,
      };
      await updateGoal(editingGoal.id, payload);
    } else {
      const payload: CreateGoalPayload = {
        title: title.trim(),
        description: description.trim() || null,
        goal_type: goalType,
        target_date: targetDate || null,
        target_value: tVal,
        current_value: cVal,
      };
      await createGoal(payload);
    }

    setIsModalOpen(false);
    setEditingGoal(null);
  };

  const handleDeleteGoal = async (goal: Goal) => {
    const links = linksByGoalId[goal.id] ?? [];
    await deleteGoal(goal.id);

    pushAction({
      description: `Goal "${goal.title}" deleted`,
      undoFn: async () => {
        await restoreGoal(goal, links);
      },
      redoFn: async () => {
        await deleteGoal(goal.id);
      },
    });
  };

  const computeGoalProgress = (goal: Goal): number => {
    const links = linksByGoalId[goal.id] ?? [];
    const taskLinks = links.filter((l) => l.resource_type === 'task');

    if (taskLinks.length > 0) {
      let completed = 0;
      for (const link of taskLinks) {
        const task = tasksById[link.resource_id];
        if (task && task.is_completed === 1) {
          completed++;
        }
      }
      return Math.round((completed / taskLinks.length) * 100);
    }

    if (goal.target_value > 0) {
      return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
    }

    return 0;
  };

  const availableTasksToLink = useMemo(() => {
    if (!linkingGoalId) return [];
    const existing = new Set((linksByGoalId[linkingGoalId] ?? []).map((l) => l.resource_id));
    return Object.values(tasksById).filter((t) => !existing.has(t.id) && t.is_trashed === 0);
  }, [linkingGoalId, linksByGoalId, tasksById]);

  return (
    <div className={styles.pageContainer}>
      {isHabitsEnabled && (
        <div className={styles.topTabBar}>
          <div className={styles.tabList} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={effectiveTab === 'goals'}
              className={`${styles.tabItem} ${effectiveTab === 'goals' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('goals')}
            >
              <span>🎯</span>
              <span>Goals</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={effectiveTab === 'habits'}
              className={`${styles.tabItem} ${effectiveTab === 'habits' ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab('habits')}
            >
              <span>🔁</span>
              <span>Habits</span>
            </button>
          </div>
        </div>
      )}

      <div className={styles.tabContent}>
        {effectiveTab === 'habits' ? (
          <HabitTracker />
        ) : (
          <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Goals & Objectives</h1>
          <p className={styles.subtitle}>
            Connect high-level aspirations to daily execution and track streaks
          </p>
        </div>

        <button
          type="button"
          className={styles.createBtn}
          onClick={handleOpenCreate}
        >
          + Create Goal
        </button>
      </div>

      {/* Weekly Review Prompt Banner */}
      {showWeeklyReview && (
        <div className={styles.reviewBanner}>
          <div className={styles.reviewLeft}>
            <span className={styles.reviewIcon}>📋</span>
            <div>
              <div className={styles.reviewTitle}>It&apos;s Friday! Weekly Review Time</div>
              <div className={styles.reviewDesc}>
                Take a few minutes to check off completed milestones, celebrate streaks, and realign next week&apos;s focus.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={() => useAppStore.getState().setActiveListId('view_weekly_review')}
              style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)', borderColor: 'var(--accent)' }}
            >
              Start Review →
            </button>
            <button
              type="button"
              className={styles.dismissBtn}
              onClick={() => setIsReviewDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No Goals Defined"
          description="Create your first goal to link tasks and track your journey toward meaningful milestones."
          action={
            <button
              type="button"
              className={styles.createBtn}
              onClick={handleOpenCreate}
            >
              + Create First Goal
            </button>
          }
        />
      ) : (
        <div className={styles.goalsGrid}>
          {goals.map((goal) => {
            const progress = computeGoalProgress(goal);
            const links = linksByGoalId[goal.id] ?? [];

            const typeBadgeClass =
              goal.goal_type === 'habit'
                ? styles.badgeHabit
                : goal.goal_type === 'outcome'
                  ? styles.badgeOutcome
                  : styles.badgeMilestone;

            return (
              <div key={goal.id} className={styles.goalCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span className={`${styles.goalTypeBadge} ${typeBadgeClass}`}>
                      {goal.goal_type}
                    </span>
                    <h2 className={styles.goalTitle}>{goal.title}</h2>
                    {goal.description && <p className={styles.goalDesc}>{goal.description}</p>}
                  </div>

                  {goal.streak_count > 0 && (
                    <span className={styles.streakBadge} title="Active streak">
                      🔥 {goal.streak_count}d
                    </span>
                  )}
                </div>

                {/* Progress Bar & Stepper */}
                <div>
                  <ProgressBar
                    progress={progress}
                    showLabel
                    label={links.length > 0 ? `${links.length} linked tasks (${progress}%)` : `${goal.current_value} / ${goal.target_value} (${progress}%)`}
                  />

                  {links.length === 0 && (
                    <div className={styles.stepperRow}>
                      <span>
                        Target: <strong className={styles.stepperValue} title="Click to edit values" onClick={() => handleOpenEdit(goal)}>{goal.current_value} / {goal.target_value}</strong>
                      </span>
                      <div className={styles.stepperGroup}>
                        <button
                          type="button"
                          className={styles.stepperBtn}
                          onClick={() => adjustGoalProgress(goal.id, -1)}
                          title="Decrease progress (-1)"
                          aria-label="Decrease progress"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className={styles.stepperBtn}
                          onClick={() => adjustGoalProgress(goal.id, 1)}
                          title="Increase progress (+1)"
                          aria-label="Increase progress"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Linked Tasks Section */}
                <div className={styles.linkedTasksSection}>
                  <div className={styles.linkedTasksHeader}>
                    <span>Linked Tasks ({links.length})</span>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => setLinkingGoalId(linkingGoalId === goal.id ? null : goal.id)}
                    >
                      {linkingGoalId === goal.id ? 'Close' : '+ Link Task'}
                    </button>
                  </div>

                  {/* Task picker dropdown if linking */}
                  {linkingGoalId === goal.id && (
                    <div style={{ margin: '4px 0' }}>
                      <select
                        className={styles.formInput}
                        style={{ width: '100%', fontSize: '11px', padding: '4px 8px' }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            linkTask(goal.id, e.target.value);
                            setLinkingGoalId(null);
                          }
                        }}
                      >
                        <option value="">Select a task to link...</option>
                        {availableTasksToLink.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {links.length > 0 && (
                    <div className={styles.linkList}>
                      {links.map((link) => {
                        const task = tasksById[link.resource_id];
                        if (!task) return null;
                        return (
                          <div key={link.resource_id} className={styles.linkItem}>
                            <span
                              style={{
                                textDecoration: task.is_completed === 1 ? 'line-through' : 'none',
                                color: task.is_completed === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {task.is_completed === 1 ? '✓ ' : '○ '}
                              {task.title}
                            </span>
                            <button
                              type="button"
                              className={styles.unlinkBtn}
                              onClick={() => unlinkTask(goal.id, link.resource_id)}
                              title="Unlink task"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className={styles.cardFooter}>
                  <span>
                    {goal.target_date ? `🎯 Target: ${goal.target_date}` : 'No target date'}
                  </span>

                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => handleOpenEdit(goal)}
                      title="Edit goal"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => incrementStreak(goal.id)}
                      title="Add +1 to streak"
                    >
                      +🔥 Streak
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => handleDeleteGoal(goal)}
                      title="Delete goal"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Goal Modal */}
      {isModalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => {
            setIsModalOpen(false);
            setEditingGoal(null);
          }}
        >
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Goal Title</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Read 20 books this year"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description (Optional)</label>
                <textarea
                  className={styles.formInput}
                  rows={2}
                  placeholder="Why this goal matters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Goal Type</label>
                <select
                  className={styles.formInput}
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value as 'habit' | 'milestone' | 'outcome')}
                >
                  <option value="milestone">Milestone (Target achievement)</option>
                  <option value="habit">Habit (Regular repetition & streak)</option>
                  <option value="outcome">Outcome (Measurable result)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Target Completion Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Value</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min={1}
                    step={1}
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Current Progress Value</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    min={0}
                    step={1}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingGoal(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.createBtn}>
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
          </div>
        )}
      </div>

      {/* Undo Toast Container */}
      {lastToastAction && (
        <div className={styles.toastWrap}>
          <Toast
            id="goal-undo-toast"
            message={lastToastAction.description}
            variant="undo"
            actionLabel="Undo"
            onAction={async () => {
              await undo();
              clearToast();
            }}
            onDismiss={() => clearToast()}
            duration={5000}
          />
        </div>
      )}
    </div>
  );
}

export default GoalsView;
