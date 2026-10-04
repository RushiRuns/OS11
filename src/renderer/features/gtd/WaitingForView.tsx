import React, { useState, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { useWaitingForTasks, useTaskStore } from '../../stores/taskStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
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
  };

  const handleEditClick = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({ x: rect.left, y: rect.bottom + 8 });
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
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>⏳</span> Waiting For
          </h1>
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
                  {overdueTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`${styles.waitingCard} ${styles.waitingCardOverdue} ${
                        task.id === selectedTaskId ? styles.waitingCardSelected : ''
                      }`}
                      onClick={() => onSelectTask?.(task)}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.cardTitleArea}>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={false}
                              onChange={() => toggleComplete(task.id)}
                              ariaLabel="Complete task"
                            />
                          </div>
                          <span className={styles.cardTitle}>{task.title}</span>
                        </div>
                      </div>

                      <div className={styles.waitingDetails}>
                        <span>Waiting on:</span>
                        <span className={styles.waitingOnText}>{task.waiting_on}</span>
                        <span className={`${styles.followUpDate} ${styles.followUpOverdue}`}>
                          Overdue ({task.follow_up_date})
                        </span>
                      </div>

                      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => clearWaiting(task.id)}
                          title="Received response — clear waiting state"
                        >
                          ✓ Followed Up
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleSnooze(task, 2)}
                        >
                          +2 Days
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleSnooze(task, 7)}
                        >
                          +1 Week
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={(e) => handleEditClick(e, task)}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  ))}
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
                  {upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`${styles.waitingCard} ${
                        task.id === selectedTaskId ? styles.waitingCardSelected : ''
                      }`}
                      onClick={() => onSelectTask?.(task)}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.cardTitleArea}>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={false}
                              onChange={() => toggleComplete(task.id)}
                              ariaLabel="Complete task"
                            />
                          </div>
                          <span className={styles.cardTitle}>{task.title}</span>
                        </div>
                      </div>

                      <div className={styles.waitingDetails}>
                        <span>Waiting on:</span>
                        <span className={styles.waitingOnText}>{task.waiting_on}</span>
                        <span className={styles.followUpDate}>
                          Follow-up: {task.follow_up_date}
                        </span>
                      </div>

                      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => clearWaiting(task.id)}
                        >
                          ✓ Followed Up
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleSnooze(task, 2)}
                        >
                          +2 Days
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleSnooze(task, 7)}
                        >
                          +1 Week
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={(e) => handleEditClick(e, task)}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  ))}
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
                  {unscheduledTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`${styles.waitingCard} ${
                        task.id === selectedTaskId ? styles.waitingCardSelected : ''
                      }`}
                      onClick={() => onSelectTask?.(task)}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.cardTitleArea}>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={false}
                              onChange={() => toggleComplete(task.id)}
                              ariaLabel="Complete task"
                            />
                          </div>
                          <span className={styles.cardTitle}>{task.title}</span>
                        </div>
                      </div>

                      <div className={styles.waitingDetails}>
                        <span>Waiting on:</span>
                        <span className={styles.waitingOnText}>{task.waiting_on}</span>
                      </div>

                      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => clearWaiting(task.id)}
                        >
                          ✓ Followed Up
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={() => handleSnooze(task, 2)}
                        >
                          Set Date (+2d)
                        </button>
                        <button
                          type="button"
                          className={styles.btnAction}
                          onClick={(e) => handleEditClick(e, task)}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}

export default WaitingForView;
