import React, { useState, useEffect, useMemo } from 'react';
import { useGoalStore } from '../../stores/goalStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { HabitTracker } from './HabitTracker.js';
import type { Goal, CreateGoalPayload } from '../../../shared/types/index.js';
import styles from './GoalsView.module.css';

export function GoalsView(): React.ReactElement {
  const isHabitsEnabled = useModuleStore((s) => s.modulesByName['habit_tracker'] ?? false);
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');

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

    if (goal.target_value && goal.target_value > 0) {
      return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
    }

    return 0;
  };

  const renderGoalsContent = () => (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>Goals & Milestones</h1>
          <p className={styles.subtitle}>
            Connect your daily tasks to higher-level outcomes and track execution progress
          </p>
        </div>

        <button
          type="button"
          className={styles.createBtn}
          onClick={() => setIsCreateOpen(true)}
        >
          <span>+</span>
          <span>New Goal</span>
        </button>
      </div>

      {/* Friday Weekly Review Banner */}
      {showWeeklyReview && (
        <div className={styles.reviewBanner}>
          <div className={styles.reviewLeft}>
            <span className={styles.reviewIcon}>🎯</span>
            <div>
              <div className={styles.reviewTitle}>Friday Weekly Goal Check-In</div>
              <div className={styles.reviewDesc}>
                Review your goals, update streaks, and plan milestones for next week.
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
          title="No Goals Created"
          description="Create milestones and outcomes to organize and tie your work to long-term objectives."
          action={
            <button
              type="button"
              className={styles.createBtn}
              onClick={() => setIsCreateOpen(true)}
            >
              Create First Goal
            </button>
          }
        />
      ) : (
        <div className={styles.goalsGrid}>
          {goals.map((goal) => {
            const progress = computeGoalProgress(goal);
            const links = linksByGoalId[goal.id] ?? [];
            const isLinking = linkingGoalId === goal.id;

            return (
              <div key={goal.id} className={styles.goalCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <span
                      className={`${styles.goalTypeBadge} ${
                        goal.goal_type === 'habit'
                          ? styles.badgeHabit
                          : goal.goal_type === 'outcome'
                            ? styles.badgeOutcome
                            : styles.badgeMilestone
                      }`}
                    >
                      {goal.goal_type}
                    </span>
                    <h3 className={styles.goalTitle}>{goal.title}</h3>
                  </div>

                  {goal.streak_count > 0 && (
                    <div className={styles.streakBadge} title={`${goal.streak_count}-day streak`}>
                      <span>🔥</span>
                      <span>{goal.streak_count}d</span>
                    </div>
                  )}
                </div>

                {goal.description && <p className={styles.goalDesc}>{goal.description}</p>}

                {/* Progress Bar */}
                <ProgressBar progress={progress} label="Progress" />

                {/* Linked Tasks Section */}
                <div className={styles.linkedTasksSection}>
                  <div className={styles.linkedTasksHeader}>
                    <span>Linked Tasks ({links.length})</span>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => setLinkingGoalId(isLinking ? null : goal.id)}
                    >
                      {isLinking ? 'Done' : '+ Link Task'}
                    </button>
                  </div>

                  {isLinking && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <select
                        className={styles.formInput}
                        style={{ fontSize: 'var(--text-xs)' }}
                        onChange={(e) => {
                          if (e.target.value) {
                            linkTask(goal.id, e.target.value, 'task');
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select a task to link...
                        </option>
                        {Object.values(tasksById)
                          .filter((t) => !links.some((l) => l.resource_id === t.id))
                          .map((t) => (
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
                        return (
                          <div key={`${link.goal_id}-${link.resource_id}`} className={styles.linkItem}>
                            <span
                              style={{
                                textDecoration: task?.is_completed === 1 ? 'line-through' : 'none',
                                color:
                                  task?.is_completed === 1
                                    ? 'var(--text-tertiary)'
                                    : 'var(--text-primary)',
                              }}
                            >
                              {task ? task.title : 'Unknown Task'}
                            </span>
                            <button
                              type="button"
                              className={styles.unlinkBtn}
                              onClick={() => unlinkTask(goal.id, link.resource_id)}
                              title="Unlink"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className={styles.cardFooter}>
                  <span>{goal.target_date ? `Target: ${goal.target_date}` : 'No target date'}</span>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => incrementStreak(goal.id)}
                      title="Log Progress (+1 Streak)"
                    >
                      +1 Streak
                    </button>
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => deleteGoal(goal.id)}
                      title="Delete Goal"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className={styles.modalBackdrop} onClick={() => setIsCreateOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create New Goal</h2>
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Title</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Launch OS11 MVP"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Ship full desktop app features"
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
                  <option value="milestone">Milestone (Project step)</option>
                  <option value="outcome">Outcome (Measurable result)</option>
                  <option value="habit">Habit (Ongoing routine)</option>
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

  if (!isHabitsEnabled) {
    return renderGoalsContent();
  }

  return (
    <div className={styles.pageRoot}>
      <div className={styles.topTabBar}>
        <div className={styles.tabList} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'goals'}
            className={`${styles.tabItem} ${activeTab === 'goals' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            <span>🎯</span>
            <span>Goals</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'habits'}
            className={`${styles.tabItem} ${activeTab === 'habits' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab('habits')}
          >
            <span>🔁</span>
            <span>Habits</span>
          </button>
        </div>
      </div>

      <div className={styles.pageContent}>
        {activeTab === 'goals' ? renderGoalsContent() : <HabitTracker />}
      </div>
    </div>
  );
}

export default GoalsView;
