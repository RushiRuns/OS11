import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGoalStore } from '../../stores/goalStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { Toast } from '../../components/Toast/Toast.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { HabitTracker } from './HabitTracker.js';
import { GoalCard } from './GoalCard.js';
import { GoalContextMenu, type GoalContextMenuPosition } from './GoalContextMenu.js';
import { GoalAnalyticsBanner } from './GoalAnalyticsBanner.js';
import { GoalHistoryModal } from './GoalHistoryModal.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload, GoalSortOption } from '../../../shared/types/index.js';
import styles from './GoalsView.module.css';

export type GoalFilterTab = 'active' | 'completed' | 'archived' | 'all';

export function GoalsView(): React.ReactElement {
  const isHabitsEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');
  const effectiveTab = isHabitsEnabled && activeTab === 'habits' ? 'habits' : 'goals';

  const {
    goalsById,
    linksByGoalId,
    progressLogsByGoalId,
    loadGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    duplicateGoal,
    linkTask,
    unlinkTask,
    incrementStreak,
    checkInHabit,
    getStreakStatus,
    getDeadlineInfo,
    computeAnalyticsSummary,
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'habit' | 'milestone' | 'outcome'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<GoalSortOption>('target_date_asc');
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [celebratingGoal, setCelebratingGoal] = useState<Goal | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contextMenuGoal, setContextMenuGoal] = useState<Goal | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<GoalContextMenuPosition | null>(null);
  const [historyModalGoal, setHistoryModalGoal] = useState<Goal | null>(null);
  const [isReviewDismissed, setIsReviewDismissed] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Keyboard Shortcuts (/ for search, C for create goal, Esc to dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === '/' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && !isInput && !e.metaKey && !e.ctrlKey && !isModalOpen) {
        e.preventDefault();
        handleOpenCreate();
        return;
      }

      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        }
        if (contextMenuGoal) {
          setContextMenuGoal(null);
          setContextMenuPos(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, contextMenuGoal, isModalOpen]);

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

  const computeGoalProgress = (goal: Goal): number => {
    return useGoalStore.getState().computeProgress(goal.id, tasksById, projectsById);
  };

  const analyticsSummary = useMemo(() => {
    return computeAnalyticsSummary(tasksById, projectsById);
  }, [computeAnalyticsSummary, tasksById, projectsById, allGoalsList]);

  const filteredGoals = useMemo(() => {
    return allGoalsList
      .filter((g) => {
        const s = g.status ?? 'active';
        if (statusFilter === 'active' && !(s === 'active' || s === 'paused')) return false;
        if (statusFilter === 'completed' && s !== 'completed') return false;
        if (statusFilter === 'archived' && s !== 'archived') return false;
        if (categoryFilter !== 'all' && (g.category ?? '') !== categoryFilter) return false;
        if (typeFilter !== 'all' && (g.goal_type ?? 'milestone') !== typeFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = (g.title ?? '').toLowerCase().includes(q);
          const descMatch = (g.description ?? '').toLowerCase().includes(q);
          const catMatch = (g.category ?? '').toLowerCase().includes(q);
          if (!titleMatch && !descMatch && !catMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Status sort precedence first
        const statusOrder: Record<string, number> = { active: 1, paused: 2, completed: 3, archived: 4 };
        const orderDiff = (statusOrder[a.status ?? 'active'] ?? 1) - (statusOrder[b.status ?? 'active'] ?? 1);
        if (orderDiff !== 0) return orderDiff;

        switch (sortBy) {
          case 'target_date_asc': {
            if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
            if (a.target_date) return -1;
            if (b.target_date) return 1;
            return b.created_at.localeCompare(a.created_at);
          }
          case 'target_date_desc': {
            if (a.target_date && b.target_date) return b.target_date.localeCompare(a.target_date);
            if (a.target_date) return -1;
            if (b.target_date) return 1;
            return b.created_at.localeCompare(a.created_at);
          }
          case 'progress_desc': {
            const diff = computeGoalProgress(b) - computeGoalProgress(a);
            if (diff !== 0) return diff;
            return b.created_at.localeCompare(a.created_at);
          }
          case 'progress_asc': {
            const diff = computeGoalProgress(a) - computeGoalProgress(b);
            if (diff !== 0) return diff;
            return b.created_at.localeCompare(a.created_at);
          }
          case 'streak_desc': {
            const diff = (b.streak_count ?? 0) - (a.streak_count ?? 0);
            if (diff !== 0) return diff;
            return (b.longest_streak ?? 0) - (a.longest_streak ?? 0);
          }
          case 'title_asc': {
            return a.title.localeCompare(b.title);
          }
          case 'created_desc':
          default: {
            return b.created_at.localeCompare(a.created_at);
          }
        }
      });
  }, [allGoalsList, statusFilter, categoryFilter, typeFilter, searchQuery, sortBy, tasksById, projectsById]);

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

  const handleDuplicateGoal = async (goal: Goal) => {
    const duplicated = await duplicateGoal(goal.id);
    if (duplicated) {
      pushAction({
        description: `Duplicated "${goal.title}"`,
        undoFn: async () => {
          await deleteGoal(duplicated.id);
        },
        redoFn: async () => {
          await restoreGoal(duplicated);
        },
      });
    }
  };


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

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Keyword Search */}
                <div className={styles.searchFilterWrap}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search goals... (/)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search goals"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className={styles.searchClearBtn}
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className={`${styles.analyticsToggleBtn} ${showAnalytics ? styles.analyticsToggleBtnActive : ''}`}
                  onClick={() => setShowAnalytics((prev) => !prev)}
                  aria-expanded={showAnalytics}
                  title="Toggle Analytics Dashboard"
                >
                  📊 {showAnalytics ? 'Hide Analytics' : 'Analytics'}
                </button>
                <button
                  type="button"
                  className={styles.createBtn}
                  onClick={handleOpenCreate}
                >
                  + Create Goal
                </button>
              </div>
            </div>

            {/* Goal Analytics Banner */}
            {showAnalytics && (
              <GoalAnalyticsBanner
                summary={analyticsSummary}
                onSelectCategoryFilter={(cat) => setCategoryFilter(cat)}
                onFilterOverdue={() => {
                  setStatusFilter('active');
                  setSortBy('target_date_asc');
                }}
              />
            )}

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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sort By Dropdown */}
          <div className={styles.typeFilterWrap}>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as GoalSortOption)}
              aria-label="Sort goals"
            >
              <option value="target_date_asc">📅 Target: Soonest</option>
              <option value="target_date_desc">📅 Target: Furthest</option>
              <option value="progress_desc">📈 Progress: High → Low</option>
              <option value="progress_asc">📉 Progress: Low → High</option>
              <option value="streak_desc">🔥 Streak: Highest</option>
              <option value="title_asc">🔤 Title: A → Z</option>
              <option value="created_desc">🕒 Created: Newest</option>
            </select>
          </div>

          <div className={styles.typeFilterWrap}>
            <select
              className={styles.typeFilterSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'habit' | 'milestone' | 'outcome')}
              aria-label="Filter goals by type"
            >
              <option value="all">🎯 All Types</option>
              <option value="habit">🔥 Habits</option>
              <option value="milestone">🏁 Milestones</option>
              <option value="outcome">🌟 Outcomes</option>
            </select>
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
            const subGoals = useGoalStore.getState().getSubGoals(goal.id);
            const isHabit = goal.goal_type === 'habit';
            const streakStatus = isHabit ? getStreakStatus(goal.id) : null;
            const deadlineInfo = getDeadlineInfo(goal);
            const parentGoalTitle = goal.parent_goal_id ? goalsById[goal.parent_goal_id]?.title : undefined;

            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                progress={progress}
                links={links}
                subGoals={subGoals}
                isHabit={isHabit}
                streakStatus={streakStatus}
                deadlineInfo={deadlineInfo}
                parentGoalTitle={parentGoalTitle}
                tasksById={tasksById}
                projectsById={projectsById}
                onOpenContextMenu={(g, pos) => {
                  setContextMenuGoal(g);
                  setContextMenuPos(pos);
                }}
                onCheckInHabit={(g) => checkInHabit(g.id)}
                onIncrementStreak={(g) => incrementStreak(g.id)}
                onAdjustProgress={(id, delta) => adjustGoalProgress(id, delta)}
                onMarkCompleted={(g) => handleMarkCompleted(g)}
                onReopenGoal={(g) => handleReopenGoal(g)}
                onToggleArchive={(g) => handleToggleArchive(g)}
                onOpenEdit={(g) => handleOpenEdit(g)}
                onLinkResource={(id, resId, resType) => linkTask(id, resId, resType)}
                onUnlinkResource={(id, resId, resType) => unlinkTask(id, resId, resType)}
              />
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

      {/* Right-click Context Menu */}
      {contextMenuGoal && (
        <GoalContextMenu
          goal={contextMenuGoal}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
          }}
          onEdit={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleOpenEdit(g);
          }}
          onDuplicate={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleDuplicateGoal(g);
          }}
          onToggleComplete={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            if (g.status === 'completed') {
              handleReopenGoal(g);
            } else {
              handleMarkCompleted(g);
            }
          }}
          onTogglePause={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleTogglePause(g);
          }}
          onToggleArchive={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleToggleArchive(g);
          }}
          onLinkResource={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleOpenEdit(g);
          }}
          onViewHistory={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            setHistoryModalGoal(g);
          }}
          onDelete={(g) => {
            setContextMenuGoal(null);
            setContextMenuPos(null);
            handleDeleteGoal(g);
          }}
        />
      )}

      {/* Progress History Modal */}
      {historyModalGoal && (
        <GoalHistoryModal
          goal={historyModalGoal}
          logs={progressLogsByGoalId[historyModalGoal.id] ?? []}
          currentProgress={computeGoalProgress(historyModalGoal)}
          onClose={() => setHistoryModalGoal(null)}
        />
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
