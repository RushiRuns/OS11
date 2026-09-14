import React, { useState, useEffect, useMemo } from 'react';
import { useGoalStore } from '../../stores/goalStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { Goal, CreateGoalPayload } from '../../../shared/types/index.js';
import styles from './GoalsView.module.css';

export function GoalsView(): React.ReactElement {
  const {
    goalsById,
    linksByGoalId,
    loadGoals,
    createGoal,
    deleteGoal,
    linkTask,
    unlinkTask,
    incrementStreak,
  } = useGoalStore();

  const tasksById = useTaskStore((state) => state.tasksById);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const [isReviewDismissed, setIsReviewDismissed] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<'habit' | 'milestone' | 'outcome'>('milestone');
  const [targetDate, setTargetDate] = useState('');

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload: CreateGoalPayload = {
      title: title.trim(),
      description: description.trim() || null,
      goal_type: goalType,
      target_date: targetDate || null,
      target_value: 100,
      current_value: 0,
    };

    await createGoal(payload);
    setTitle('');
    setDescription('');
    setGoalType('milestone');
    setTargetDate('');
    setIsCreateOpen(false);
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
          onClick={() => setIsCreateOpen(true)}
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
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={() => setIsReviewDismissed(true)}
          >
            Dismiss
          </button>
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
              onClick={() => setIsCreateOpen(true)}
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

                {/* Progress Bar */}
                <div>
                  <ProgressBar
                    progress={progress}
                    showLabel
                    label={links.length > 0 ? `${links.length} linked tasks` : 'Progress'}
                  />
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
                      onClick={() => incrementStreak(goal.id)}
                      title="Add +1 to streak"
                    >
                      +🔥 Streak
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => deleteGoal(goal.id)}
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

      {/* Create Goal Modal */}
      {isCreateOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsCreateOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create New Goal</h2>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.createBtn}>
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsView;
