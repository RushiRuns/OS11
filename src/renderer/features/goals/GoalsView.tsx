import React, { useState, useEffect, useMemo } from 'react';
import type { Objective } from '@shared/types/index.js';
import { useOkrStore } from '../../stores/okrStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useViewSearch } from '../../hooks/useViewSearch.js';
import { ViewSearchContext } from '../search/ViewSearchContext.js';
import { ViewSearch } from '../search/ViewSearch.js';
import { GoalRow } from './GoalRow.js';
import { GoalDetail } from './GoalDetail.js';
import { CreateGoalModal } from './CreateGoalModal.js';
import { CheckInSheet } from './CheckInSheet.js';
import { HabitTracker } from './HabitTracker.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import styles from './GoalsView.module.css';

export function GoalsView(): React.ReactElement {
  const isHabitsEnabled = useModuleStore((state) => state.isEnabled('habit_tracker'));
  const [activeTab, setActiveTab] = useState<'goals' | 'habits'>('goals');
  const effectiveTab = isHabitsEnabled && activeTab === 'habits' ? 'habits' : 'goals';

  const objectivesById = useOkrStore((s) => s.objectivesById);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);
  const loadAll = useOkrStore((s) => s.loadAll);

  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [checkInObjective, setCheckInObjective] = useState<Objective | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const allObjectives = useMemo(() => Object.values(objectivesById), [objectivesById]);

  // Search items setup
  const searchTasks = useMemo(
    () => allObjectives.map((o) => ({ id: o.id, title: o.title })),
    [allObjectives]
  );

  const getChildren = useMemo(() => {
    return (objectiveId: string) =>
      Object.values(keyResultsById)
        .filter((kr) => kr.objective_id === objectiveId)
        .map((kr) => ({ id: kr.id, title: kr.title }));
  }, [keyResultsById]);

  const search = useViewSearch({
    tasks: searchTasks,
    getChildren,
    viewKey: 'goals-view',
    viewName: 'Goals',
    enabled: effectiveTab === 'goals' && !selectedObjectiveId,
    onOpenTaskDetail: (id) => setSelectedObjectiveId(id),
  });

  const visibleObjectives = useMemo(() => {
    if (!search.query.trim()) return allObjectives;
    return allObjectives.filter((o) => search.isRowVisible(o.id));
  }, [allObjectives, search]);

  const activeGoals = useMemo(
    () => visibleObjectives.filter((o) => o.status === 'active' || o.status === 'paused'),
    [visibleObjectives]
  );

  const completedGoals = useMemo(
    () => visibleObjectives.filter((o) => o.status === 'completed'),
    [visibleObjectives]
  );

  const archivedGoals = useMemo(
    () => visibleObjectives.filter((o) => o.status === 'archived'),
    [visibleObjectives]
  );

  // Keyboard shortcut 'c' to create a goal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.key === 'c' || e.key === 'C') && !isInput && !e.metaKey && !e.ctrlKey && !isCreateOpen && !selectedObjectiveId) {
        e.preventDefault();
        setIsCreateOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateOpen, selectedObjectiveId]);

  // If a goal is selected, render GoalDetail full pane
  if (selectedObjectiveId) {
    return (
      <div className={styles.pageContainer}>
        <GoalDetail
          objectiveId={selectedObjectiveId}
          onBack={() => setSelectedObjectiveId(null)}
        />
      </div>
    );
  }

  return (
    <ViewSearchContext.Provider value={search}>
      <div className={styles.pageContainer}>
        {/* Top Tab Bar if Habits is enabled */}
        {isHabitsEnabled && (
          <div className={styles.topTabBar}>
            <div className={styles.tabList}>
              <button
                type="button"
                className={`${styles.tabItem} ${effectiveTab === 'goals' ? styles.tabItemActive : ''}`}
                onClick={() => setActiveTab('goals')}
              >
                Goals
              </button>
              <button
                type="button"
                className={`${styles.tabItem} ${effectiveTab === 'habits' ? styles.tabItemActive : ''}`}
                onClick={() => setActiveTab('habits')}
              >
                Habits
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {effectiveTab === 'habits' ? (
            <HabitTracker />
          ) : (
            <div className={styles.container}>
              {/* Header */}
              <div className={styles.header}>
                <div className={styles.titleArea}>
                  <h1 className={styles.title}>Goals</h1>
                </div>

                <div className={styles.headerControls}>
                  <ViewSearch searchState={search} />
                  <button
                    type="button"
                    className={styles.createBtnQuiet}
                    onClick={() => setIsCreateOpen(true)}
                  >
                    New goal
                  </button>
                </div>
              </div>

              {/* Active Goals Section */}
              <div className={styles.section}>
                {activeGoals.length > 0 ? (
                  <div className={styles.goalList}>
                    {activeGoals.map((obj) => (
                      <GoalRow
                        key={obj.id}
                        objective={obj}
                        onClick={() => setSelectedObjectiveId(obj.id)}
                        onCheckInClick={() => setCheckInObjective(obj)}
                      />
                    ))}
                  </div>
                ) : !search.query.trim() ? (
                  <EmptyState
                    title="No goals yet"
                    description="Set one for this quarter, then add two or three key results."
                    action={
                      <button
                        type="button"
                        className={styles.createBtnQuiet}
                        onClick={() => setIsCreateOpen(true)}
                      >
                        New goal
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No matching goals"
                    description="Try a different search term."
                  />
                )}
              </div>

              {/* Completed Goals Section (Collapsible) */}
              {completedGoals.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <button
                      type="button"
                      className={styles.sectionToggleBtn}
                      onClick={() => setShowCompleted((v) => !v)}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform var(--motion-fast) var(--ease-out)',
                        }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      Completed
                      <span className={styles.countBadge}>({completedGoals.length})</span>
                    </button>
                  </div>

                  {showCompleted && (
                    <div className={styles.goalList}>
                      {completedGoals.map((obj) => (
                        <GoalRow
                          key={obj.id}
                          objective={obj}
                          onClick={() => setSelectedObjectiveId(obj.id)}
                          onCheckInClick={() => setCheckInObjective(obj)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Archived Goals Section (Collapsible) */}
              {archivedGoals.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <button
                      type="button"
                      className={styles.sectionToggleBtn}
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: showArchived ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform var(--motion-fast) var(--ease-out)',
                        }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      Archived
                      <span className={styles.countBadge}>({archivedGoals.length})</span>
                    </button>
                  </div>

                  {showArchived && (
                    <div className={styles.goalList}>
                      {archivedGoals.map((obj) => (
                        <GoalRow
                          key={obj.id}
                          objective={obj}
                          onClick={() => setSelectedObjectiveId(obj.id)}
                          onCheckInClick={() => setCheckInObjective(obj)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Create Goal Modal */}
        <CreateGoalModal
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreated={(newObj) => setSelectedObjectiveId(newObj.id)}
        />

        {/* Check-In Sheet */}
        {checkInObjective && (
          <CheckInSheet
            objective={checkInObjective}
            open={!!checkInObjective}
            onOpenChange={(open) => {
              if (!open) setCheckInObjective(null);
            }}
          />
        )}
      </div>
    </ViewSearchContext.Provider>
  );
}

export default GoalsView;
