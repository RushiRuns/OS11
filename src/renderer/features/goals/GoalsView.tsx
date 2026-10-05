import React, { useState, useEffect, useMemo } from 'react';
import { useGoalStore } from '../../stores/goalStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { Toast } from '../../components/Toast/Toast.js';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { HabitTracker } from './HabitTracker.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload } from '../../../shared/types/index.js';
import styles from './GoalsView.module.css';

export type GoalFilterTab = 'active' | 'completed' | 'archived' | 'all';

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
    setGoalStatus,
    archiveGoal,
    restoreGoal,
  } = useGoalStore();

  const { pushAction, undo, lastToastAction, clearToast } = useUndoRedo();
  const tasksById = useTaskStore((state) => state.tasksById);
  const projectsById = useProjectStore((state) => state.projectsById);

  const [statusFilter, setStatusFilter] = useState<GoalFilterTab>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);

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
  const [parentGoalId, setParentGoalId] = useState<string>('');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const allGoalsList = useMemo(() => Object.values(goalsById), [goalsById]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    allGoalsList.forEach((g) => {
      if (g.category && g.category.trim()) {
        cats.add(g.category.trim());
      }
    });
    return Array.from(cats).sort();
  }, [allGoalsList]);

  const activeCount = useMemo(
    () => allGoalsList.filter((g) => (g.status ?? 'active') === 'active' || g.status === 'paused').length,
    [allGoalsList]
  );
  const completedCount = useMemo(
    () => allGoalsList.filter((g) => g.status === 'completed').length,
    [allGoalsList]
  );
  const archivedCount = useMemo(
    () => allGoalsList.filter((g) => g.status === 'archived').length,
    [allGoalsList]
  );
  const allCount = allGoalsList.length;

  const filteredGoals = useMemo(() => {
    return allGoalsList
      .filter((g) => {
        const s = g.status ?? 'active';
        if (statusFilter === 'active' && !(s === 'active' || s === 'paused')) return false;
        if (statusFilter === 'completed' && s !== 'completed') return false;
        if (statusFilter === 'archived' && s !== 'archived') return false;
        if (categoryFilter !== 'all' && (g.category ?? '') !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { active: 1, paused: 2, completed: 3, archived: 4 };
        const orderDiff = (statusOrder[a.status ?? 'active'] ?? 1) - (statusOrder[b.status ?? 'active'] ?? 1);
        if (orderDiff !== 0) return orderDiff;
        if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
        if (a.target_date) return -1;
        if (b.target_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [allGoalsList, statusFilter, categoryFilter]);

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
    setParentGoalId('');
    setCategory('');
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
    setParentGoalId(goal.parent_goal_id ?? '');
    setCategory(goal.category ?? '');
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
        parent_goal_id: parentGoalId.trim() || null,
        category: category.trim() || null,
      };
      await updateGoal(editingGoal.id, payload);
    } else {
      const payload: CreateGoalPayload = {
        title: title.trim(),
        description: description.trim() || null,
        goal_type: goalType,
        status: 'active',
        target_date: targetDate || null,
        target_value: tVal,
        current_value: cVal,
        parent_goal_id: parentGoalId.trim() || null,
        category: category.trim() || null,
      };
      await createGoal(payload);
    }

    setIsModalOpen(false);
    setEditingGoal(null);
  };

  const handleMarkCompleted = async (goal: Goal) => {
    await setGoalStatus(goal.id, 'completed');
    setCelebratingGoal(goal);
  };

  const handleReopenGoal = async (goal: Goal) => {
    await setGoalStatus(goal.id, 'active');
  };

  const handleTogglePause = async (goal: Goal) => {
    const next = goal.status === 'paused' ? 'active' : 'paused';
    await setGoalStatus(goal.id, next);
  };

  const handleToggleArchive = async (goal: Goal) => {
    if (goal.status === 'archived') {
      await setGoalStatus(goal.id, 'active');
    } else {
      await archiveGoal(goal.id);
    }
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
    return useGoalStore.getState().computeProgress(goal.id, tasksById, projectsById);
  };

  const availableTasksToLink = useMemo(() => {
    if (!linkingGoalId) return [];
    const existing = new Set(
      (linksByGoalId[linkingGoalId] ?? [])
        .filter((l) => l.resource_type === 'task')
        .map((l) => l.resource_id)
    );
    return Object.values(tasksById).filter((t) => !existing.has(t.id) && t.is_trashed === 0);
  }, [linkingGoalId, linksByGoalId, tasksById]);

  const availableProjectsToLink = useMemo(() => {
    if (!linkingGoalId) return [];
    const existing = new Set(
      (linksByGoalId[linkingGoalId] ?? [])
        .filter((l) => l.resource_type === 'project')
        .map((l) => l.resource_id)
    );
    return Object.values(projectsById).filter((p) => !existing.has(p.id) && p.status !== 'archived');
  }, [linkingGoalId, linksByGoalId, projectsById]);

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

      {/* Status Filter Segmented Control */}
      <div className={styles.filterBar}>
        <div className={styles.segmentedControl} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'active'}
            className={`${styles.filterBtn} ${statusFilter === 'active' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            <span>Active</span>
            <span className={styles.countBadge}>{activeCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'completed'}
            className={`${styles.filterBtn} ${statusFilter === 'completed' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            <span>Completed</span>
            <span className={styles.countBadge}>{completedCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'archived'}
            className={`${styles.filterBtn} ${statusFilter === 'archived' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('archived')}
          >
            <span>Archived</span>
            <span className={styles.countBadge}>{archivedCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'all'}
            className={`${styles.filterBtn} ${statusFilter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>All</span>
            <span className={styles.countBadge}>{allCount}</span>
          </button>
        </div>

        {allCategories.length > 0 && (
          <div className={styles.categoryFilterWrap}>
            <select
              className={styles.categoryFilterSelect}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter goals by category"
            >
              <option value="all">🏷️ All Categories ({allCategories.length})</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  🏷️ {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <EmptyState
          icon={statusFilter === 'completed' ? '🏆' : statusFilter === 'archived' ? '📦' : '🎯'}
          title={
            statusFilter === 'completed'
              ? 'No Completed Goals Yet'
              : statusFilter === 'archived'
                ? 'No Archived Goals'
                : 'No Active Goals'
          }
          description={
            statusFilter === 'completed'
              ? 'Keep tracking and progressing. When a goal hits 100%, mark it complete to celebrate here!'
              : statusFilter === 'archived'
                ? 'Goals you no longer actively pursue can be archived to keep your active workspace clutter-free.'
                : 'Create your first goal to link tasks and track your journey toward meaningful milestones.'
          }
          action={
            statusFilter === 'active' || statusFilter === 'all' ? (
              <button
                type="button"
                className={styles.createBtn}
                onClick={handleOpenCreate}
              >
                + Create First Goal
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.goalsGrid}>
          {filteredGoals.map((goal) => {
            const progress = computeGoalProgress(goal);
            const links = linksByGoalId[goal.id] ?? [];

            const typeBadgeClass =
              goal.goal_type === 'habit'
                ? styles.badgeHabit
                : goal.goal_type === 'outcome'
                  ? styles.badgeOutcome
                  : styles.badgeMilestone;

            const cardClass = [
              styles.goalCard,
              goal.status === 'completed' ? styles.goalCardCompleted : '',
              goal.status === 'paused' ? styles.goalCardPaused : '',
              goal.status === 'archived' ? styles.goalCardArchived : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={goal.id} className={cardClass}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={`${styles.goalTypeBadge} ${typeBadgeClass}`}>
                        {goal.goal_type}
                      </span>
                      {goal.category && (
                        <span className={styles.categoryBadge} title={`Category: ${goal.category}`}>
                          🏷️ {goal.category}
                        </span>
                      )}
                      {goal.status === 'completed' && (
                        <span className={`${styles.goalTypeBadge} ${styles.badgeCompleted}`}>
                          ✓ Completed
                        </span>
                      )}
                      {goal.status === 'paused' && (
                        <span className={`${styles.goalTypeBadge} ${styles.badgePaused}`}>
                          ⏸ Paused
                        </span>
                      )}
                      {goal.status === 'archived' && (
                        <span className={`${styles.goalTypeBadge} ${styles.badgeArchived}`}>
                          📦 Archived
                        </span>
                      )}
                    </div>
                    {goal.parent_goal_id && goalsById[goal.parent_goal_id] && (
                      <div className={styles.parentGoalTag}>
                        <span>↳ Sub-goal of:</span>
                        <strong>{goalsById[goal.parent_goal_id].title}</strong>
                      </div>
                    )}
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
                    label={links.length > 0 ? `${links.length} linked resources (${progress}%)` : `${goal.current_value} / ${goal.target_value} (${progress}%)`}
                  />

                  {links.length === 0 && goal.status !== 'archived' && (
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

                {/* Sub-goals Section */}
                {(() => {
                  const subGoals = useGoalStore.getState().getSubGoals(goal.id);
                  if (subGoals.length === 0) return null;
                  return (
                    <div className={styles.subGoalsSection}>
                      <span className={styles.subGoalsHeader}>Sub-goals / OKRs ({subGoals.length})</span>
                      <div className={styles.subGoalsList}>
                        {subGoals.map((sub) => {
                          const subProg = useGoalStore.getState().computeProgress(sub.id, tasksById, projectsById);
                          return (
                            <div key={sub.id} className={styles.subGoalItem}>
                              <div className={styles.subGoalTitleRow}>
                                <span className={styles.subGoalBullet}>▸</span>
                                <span className={styles.subGoalTitle}>{sub.title}</span>
                                <span className={styles.subGoalPercent}>{subProg}%</span>
                              </div>
                              <div className={styles.subGoalProgressTrack}>
                                <div className={styles.subGoalProgressBar} style={{ width: `${subProg}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Linked Resources Section */}
                <div className={styles.linkedTasksSection}>
                  <div className={styles.linkedTasksHeader}>
                    <span>Linked Resources ({links.length})</span>
                    {goal.status !== 'archived' && (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => setLinkingGoalId(linkingGoalId === goal.id ? null : goal.id)}
                      >
                        {linkingGoalId === goal.id ? 'Close' : '+ Link Resource'}
                      </button>
                    )}
                  </div>

                  {/* Resource picker dropdown if linking */}
                  {linkingGoalId === goal.id && (
                    <div style={{ margin: '4px 0' }}>
                      <select
                        className={styles.formInput}
                        style={{ width: '100%', fontSize: '11px', padding: '4px 8px' }}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const [type, id] = e.target.value.split(':') as ['task' | 'project', string];
                            linkTask(goal.id, id, type);
                            setLinkingGoalId(null);
                          }
                        }}
                      >
                        <option value="">Select a project or task to link...</option>
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
                    </div>
                  )}

                  {links.length > 0 && (
                    <div className={styles.linkList}>
                      {links.map((link) => {
                        if (link.resource_type === 'project') {
                          const project = projectsById[link.resource_id];
                          if (!project) return null;
                          return (
                            <div key={`project-${link.resource_id}`} className={styles.linkItem}>
                              <span
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                📁 {project.name}
                              </span>
                              {goal.status !== 'archived' && (
                                <button
                                  type="button"
                                  className={styles.unlinkBtn}
                                  onClick={() => unlinkTask(goal.id, link.resource_id, 'project')}
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
                            {goal.status !== 'archived' && (
                              <button
                                type="button"
                                className={styles.unlinkBtn}
                                onClick={() => unlinkTask(goal.id, link.resource_id, 'task')}
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

                {/* Footer Controls */}
                <div className={styles.cardFooter}>
                  <span>
                    {goal.status === 'completed' && goal.completed_at
                      ? `🏆 Completed: ${new Date(goal.completed_at).toLocaleDateString()}`
                      : goal.target_date
                        ? `🎯 Target: ${goal.target_date}`
                        : 'No target date'}
                  </span>

                  <div className={styles.cardActions}>
                    {goal.status !== 'archived' && (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => handleOpenEdit(goal)}
                        title="Edit goal"
                      >
                        ✏️ Edit
                      </button>
                    )}

                    {/* Completion / Reopen action */}
                    {goal.status === 'completed' ? (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => handleReopenGoal(goal)}
                        title="Reopen goal as active"
                      >
                        ↺ Reopen
                      </button>
                    ) : goal.status !== 'archived' ? (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => handleMarkCompleted(goal)}
                        title="Mark goal as completed"
                        style={progress >= 100 ? { borderColor: '#10b981', color: '#10b981', fontWeight: 'bold' } : undefined}
                      >
                        {progress >= 100 ? '🎉 Complete' : '✓ Complete'}
                      </button>
                    ) : null}

                    {/* Pause / Resume for active/paused */}
                    {(goal.status === 'active' || goal.status === 'paused') && (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => handleTogglePause(goal)}
                        title={goal.status === 'paused' ? 'Resume goal' : 'Pause goal'}
                      >
                        {goal.status === 'paused' ? '▶ Resume' : '⏸ Pause'}
                      </button>
                    )}

                    {/* Archive / Unarchive */}
                    <button
                      type="button"
                      className={styles.cardBtn}
                      onClick={() => handleToggleArchive(goal)}
                      title={goal.status === 'archived' ? 'Unarchive (restore to active)' : 'Archive goal'}
                    >
                      {goal.status === 'archived' ? '↺ Unarchive' : '📦 Archive'}
                    </button>

                    {/* Streak for active goals */}
                    {(goal.status === 'active' || !goal.status) && (
                      <button
                        type="button"
                        className={styles.cardBtn}
                        onClick={() => incrementStreak(goal.id)}
                        title="Add +1 to streak"
                      >
                        +🔥
                      </button>
                    )}

                    {/* Delete */}
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

              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Category / Domain</label>
                  <input
                    type="text"
                    list="goal-category-presets"
                    className={styles.formInput}
                    placeholder="e.g. Work, Health, Finance..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                  <datalist id="goal-category-presets">
                    <option value="Work" />
                    <option value="Personal" />
                    <option value="Health" />
                    <option value="Finance" />
                    <option value="Learning" />
                    <option value="Creative" />
                  </datalist>
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Parent Goal (Sub-goal / OKR)</label>
                  <select
                    className={styles.formInput}
                    value={parentGoalId}
                    onChange={(e) => setParentGoalId(e.target.value)}
                  >
                    <option value="">None (Top-level Goal)</option>
                    {allGoalsList
                      .filter((g) => !editingGoal || (g.id !== editingGoal.id && g.parent_goal_id !== editingGoal.id))
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          🎯 {g.title}
                        </option>
                      ))}
                  </select>
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

      {/* Milestone Celebration Modal */}
      {celebratingGoal && (
        <div className={styles.celebrationBackdrop} onClick={() => setCelebratingGoal(null)}>
          <div className={styles.celebrationBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.celebrationTrophy}>🏆</div>
            <h2 className={styles.celebrationTitle}>Goal Accomplished!</h2>
            <h3 className={styles.celebrationGoalTitle}>{celebratingGoal.title}</h3>
            <p className={styles.celebrationSubtitle}>
              Outstanding work! You set a meaningful target, stayed consistent, and reached the finish line.
            </p>

            <div className={styles.celebrationStatsRow}>
              <div className={styles.celebrationStatCard}>
                <span className={styles.celebrationStatVal}>
                  {celebratingGoal.target_value}
                </span>
                <span className={styles.celebrationStatLbl}>Target Reached</span>
              </div>
              <div className={styles.celebrationStatCard}>
                <span className={styles.celebrationStatVal}>
                  {celebratingGoal.streak_count}🔥
                </span>
                <span className={styles.celebrationStatLbl}>Streak Record</span>
              </div>
            </div>

            <button
              type="button"
              className={styles.celebrationDismissBtn}
              onClick={() => setCelebratingGoal(null)}
            >
              Awesome! Celebrate & Continue →
            </button>
          </div>
        </div>
      )}

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
