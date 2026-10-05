import React, { useState, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { useWaitingForTasks, useTaskStore } from '../../stores/taskStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { Toast } from '../../components/Toast/Toast.js';
import { WaitingPopover } from './WaitingPopover.js';
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
      <div
        key={task.id}
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
          <span className={styles.feelTitle} title={task.title}>{task.title}</span>
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
    );
  };

  return (
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
      </header>

      <div className={styles.scrollArea}>
        {tasks.length === 0 ? (
          <EmptyState
            icon="⏳"
            title="Nothing Waiting"
            description="When you delegate a task or wait for a reply, mark it Waiting For to track follow-ups."
          />
        ) : (
          <>
            {/* Overdue Section */}
            {overdueTasks.length > 0 && (
              <section className={styles.groupSection}>
                <div className={`${styles.groupHeader} ${styles.groupHeaderOverdue}`}>
                  <span>⚠️ Overdue Follow-ups ({overdueTasks.length})</span>
                </div>
                <div className={styles.cardList}>
                  {overdueTasks.map((task) => renderCard(task, true))}
                </div>
              </section>
            )}

            {/* Upcoming Section */}
            {upcomingTasks.length > 0 && (
              <section className={styles.groupSection}>
                <div className={styles.groupHeader}>
                  <span>Upcoming Follow-ups ({upcomingTasks.length})</span>
                </div>
                <div className={styles.cardList}>
                  {upcomingTasks.map((task) => renderCard(task, false))}
                </div>
              </section>
            )}

            {/* Unscheduled Section */}
            {unscheduledTasks.length > 0 && (
              <section className={styles.groupSection}>
                <div className={styles.groupHeader}>
                  <span>No Follow-up Date ({unscheduledTasks.length})</span>
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
  );
}

export default WaitingForView;
