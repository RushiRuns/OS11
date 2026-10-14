import React, { useState, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { useWaitingForTasks, useTaskStore } from '../../stores/taskStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { Toast } from '../../components/Toast/Toast.js';
import { WaitingPopover } from './WaitingPopover.js';
import { useViewSearch } from '../../hooks/useViewSearch.js';
import { ViewSearch } from '../search/ViewSearch.js';
import { ViewSearchContext } from '../search/ViewSearchContext.js';
import { SearchCollapse } from '../search/SearchCollapse.js';
import { HighlightMark } from '../search/HighlightMark.js';
import styles from './WaitingForView.module.css';

interface WaitingForViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function WaitingForView({
  onSelectTask,
  selectedTaskId,
}: WaitingForViewProps): React.ReactElement {
  const tasks = useWaitingForTasks();
  const { toggleComplete, clearWaiting, setWaiting } = useTaskStore();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenTaskDetail = (taskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (target && onSelectTask) {
      onSelectTask(target);
    }
  };

  const search = useViewSearch({
    tasks,
    viewKey: 'smart_waiting_for',
    viewName: 'Waiting For',
    onOpenTaskDetail: handleOpenTaskDetail,
  });

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { overdueTasks, upcomingTasks, unscheduledTasks } = useMemo(() => {
    const overdue: Task[] = [];
    const upcoming: Task[] = [];
    const unscheduled: Task[] = [];

    for (const t of tasks) {
      if (!t.follow_up_date) {
        unscheduled.push(t);
      } else if (t.follow_up_date < todayStr) {
        overdue.push(t);
      } else {
        upcoming.push(t);
      }
    }

    return { overdueTasks: overdue, upcomingTasks: upcoming, unscheduledTasks: unscheduled };
  }, [tasks, todayStr]);

  const handleSnooze = async (task: Task, days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const nextDate = d.toISOString().split('T')[0];
    await setWaiting({
      taskId: task.id,
      waitingOn: task.waiting_on || '',
      followUpDate: nextDate,
    });
    setToastMessage(`Snoozed follow-up to ${nextDate}`);
  };

  const handleFollowedUp = async (task: Task) => {
    await clearWaiting(task.id);
    setToastMessage(`Marked "${task.title}" as followed up`);
  };

  const handleEditClick = (task: Task, pos?: { x: number; y: number }) => {
    setPopoverPos(pos ?? { x: window.innerWidth / 2 - 140, y: window.innerHeight / 3 });
    setEditingTask(task);
  };

  const handleSaveWaiting = async (waitingOn: string, followUpDate?: string | null) => {
    if (editingTask) {
      await setWaiting({
        taskId: editingTask.id,
        waitingOn,
        followUpDate: followUpDate || null,
      });
      setEditingTask(null);
      setToastMessage('Updated follow-up details');
    }
  };

  const renderCard = (task: Task, isOverdue = false) => {
    const menuItems: (DropdownMenuItemConfig | 'separator')[] = [
      {
        id: 'snooze-2d',
        label: '+2 Days',
        onClick: () => handleSnooze(task, 2),
      },
      {
        id: 'snooze-7d',
        label: '+1 Week',
        onClick: () => handleSnooze(task, 7),
      },
      'separator',
      {
        id: 'edit-waiting',
        label: 'Edit Follow-up...',
        onClick: () => handleEditClick(task),
      },
      {
        id: 'clear-waiting',
        label: 'Clear Waiting State',
        danger: true,
        onClick: () => clearWaiting(task.id),
      },
    ];

    return (
      <SearchCollapse key={task.id} collapsed={!search.isRowVisible(task.id)}>
        <div
          className={`${styles.feelCard} ${isOverdue ? styles.feelCardOverdue : ''} ${
            task.id === selectedTaskId ? styles.feelCardSelected : ''
          }`}
          onClick={() => onSelectTask?.(task)}
        >
          <div className={styles.feelLeft}>
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={false}
                onChange={() => toggleComplete(task.id)}
                ariaLabel={`Complete task: ${task.title}`}
              />
            </div>
            <span className={styles.feelTitle} title={task.title}>
              <HighlightMark text={task.title} tokens={search.tokens} />
            </span>
          </div>

          <div className={styles.feelMeta}>
            {task.waiting_on && (
              <span className={styles.waitingChip} title={`Waiting on: ${task.waiting_on}`}>
                <span className={styles.waitingChipPrefix}>@</span>
                {task.waiting_on}
              </span>
            )}
            {task.follow_up_date && (
              <span
                className={`${styles.followUpBadge} ${isOverdue ? styles.followUpOverdue : ''}`}
                title={`Follow-up date: ${task.follow_up_date}`}
              >
                {isOverdue ? `Overdue (${task.follow_up_date})` : task.follow_up_date}
              </span>
            )}
          </div>

          <div className={styles.feelActions} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.followUpBtn}
              onClick={() => handleFollowedUp(task)}
              title="Received response — clear waiting state"
              aria-label="✓ Followed Up"
            >
              ✓ Followed Up
            </button>

            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className={styles.moreBtn}
                  aria-label="More actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  •••
                </button>
              }
              items={menuItems}
              align="end"
            />
          </div>
        </div>
      </SearchCollapse>
    );
  };

  return (
    <ViewSearchContext.Provider value={search}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Waiting For</h1>
            <span className={styles.badge}>{tasks.length}</span>
            {overdueTasks.length > 0 && (
              <span className={`${styles.badge} ${styles.badgeOverdue}`}>
                {overdueTasks.length} Overdue
              </span>
            )}
          </div>
          <ViewSearch searchState={search} onOpenDetail={handleOpenTaskDetail} />
        </header>

        <div className={styles.scrollArea}>
          {search.isFiltering && search.matchCount === 0 ? (
            <div className={styles.emptySearchState} data-testid="empty-search-state">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.emptySearchIcon}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div className={styles.emptySearchTitle}>
                No tasks match &ldquo;{search.query}&rdquo;
              </div>
              <div className={styles.emptySearchSubtitle}>
                in Waiting For
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon="⏳"
              title="Nothing Waiting"
              description="When you delegate a task or wait for a reply, mark it Waiting For to track follow-ups."
            />
          ) : (
            <>
              {/* Overdue Section */}
              {overdueTasks.length > 0 &&
                (!search.isFiltering || overdueTasks.some((t) => search.isRowVisible(t.id))) && (
                  <section className={styles.groupSection}>
                    <div className={`${styles.groupHeader} ${styles.groupHeaderOverdue}`}>
                      <span>
                        ⚠️ Overdue Follow-ups (
                        {search.isFiltering
                          ? overdueTasks.filter((t) => search.isRowVisible(t.id)).length
                          : overdueTasks.length}
                        )
                      </span>
                    </div>
                    <div className={styles.cardList}>
                      {overdueTasks.map((task) => renderCard(task, true))}
                    </div>
                  </section>
                )}

              {/* Upcoming Section */}
              {upcomingTasks.length > 0 &&
                (!search.isFiltering || upcomingTasks.some((t) => search.isRowVisible(t.id))) && (
                  <section className={styles.groupSection}>
                    <div className={styles.groupHeader}>
                      <span>
                        Upcoming Follow-ups (
                        {search.isFiltering
                          ? upcomingTasks.filter((t) => search.isRowVisible(t.id)).length
                          : upcomingTasks.length}
                        )
                      </span>
                    </div>
                    <div className={styles.cardList}>
                      {upcomingTasks.map((task) => renderCard(task, false))}
                    </div>
                  </section>
                )}

              {/* Unscheduled Section */}
              {unscheduledTasks.length > 0 &&
                (!search.isFiltering || unscheduledTasks.some((t) => search.isRowVisible(t.id))) && (
                  <section className={styles.groupSection}>
                    <div className={styles.groupHeader}>
                      <span>
                        No Follow-up Date (
                        {search.isFiltering
                          ? unscheduledTasks.filter((t) => search.isRowVisible(t.id)).length
                          : unscheduledTasks.length}
                        )
                      </span>
                    </div>
                    <div className={styles.cardList}>
                      {unscheduledTasks.map((task) => renderCard(task, false))}
                    </div>
                  </section>
                )}
            </>
          )}
        </div>

        {editingTask && (
          <WaitingPopover
            initialWaitingOn={editingTask.waiting_on}
            initialFollowUpDate={editingTask.follow_up_date}
            position={popoverPos}
            onSave={handleSaveWaiting}
            onCancel={() => setEditingTask(null)}
          />
        )}

        {toastMessage && (
          <div className={styles.toastWrap}>
            <Toast
              id="waiting-for-toast"
              message={toastMessage}
              variant="success"
              onDismiss={() => setToastMessage(null)}
              duration={3000}
            />
          </div>
        )}
      </div>
    </ViewSearchContext.Provider>
  );
}

export default WaitingForView;
