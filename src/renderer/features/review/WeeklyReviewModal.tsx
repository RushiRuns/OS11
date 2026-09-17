import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore.js';
import { Button } from '../../components/Button/Button.js';
import styles from './WeeklyReviewModal.module.css';

interface WeeklyReviewModalProps {
  onClose: () => void;
}

export function WeeklyReviewModal({ onClose }: WeeklyReviewModalProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<number>(1);
  const { tasksById, updateTask, deleteTask } = useTaskStore();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Completed tasks in the last 7 days
  const completedThisWeek = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) => t.is_completed === 1 && t.is_trashed === 0 && (t.completed_at ? t.completed_at >= sevenDaysAgo : true)
    );
  }, [tasksById, sevenDaysAgo]);

  // Stale incomplete tasks older than 14 days
  const staleTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) => t.is_completed === 0 && t.is_trashed === 0 && t.created_at < fourteenDaysAgo
    );
  }, [tasksById, fourteenDaysAgo]);

  // Upcoming incomplete tasks needing priority planning
  const upcomingTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => t.is_completed === 0 && t.is_trashed === 0)
      .slice(0, 8);
  }, [tasksById]);

  const handleRescheduleNextWeek = (id: string) => {
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    updateTask({ id, due_date: nextWeek });
  };

  const handleTrashTask = (id: string) => {
    deleteTask(id);
  };

  const handleSetPriority = (id: string, priority: number) => {
    updateTask({ id, priority });
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Weekly Review">
      <div className={styles.modalCard}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.iconBadge}>📅</span>
            <span className={styles.title}>Weekly Review</span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close weekly review"
          >
            ✕
          </button>
        </header>

        {/* Dynamic Content */}
        <div className={styles.content}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={shouldReduceMotion ? { opacity: 0 } : { x: 30, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { x: -30, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className={styles.stepTitle}>Celebrate your progress</h2>
                <p className={styles.stepSubtitle}>
                  Here is what you accomplished over the past 7 days.
                </p>

                <div className={styles.statBanner}>
                  <div className={styles.statNumber}>{completedThisWeek.length}</div>
                  <div className={styles.statText}>
                    tasks completed this week. Solid momentum!
                  </div>
                </div>

                <div className={styles.taskList} role="list" aria-label="Completed tasks this week">
                  {completedThisWeek.length === 0 ? (
                    <div className={styles.emptyState}>No completed tasks recorded this week.</div>
                  ) : (
                    completedThisWeek.slice(0, 10).map((t) => (
                      <div key={t.id} className={styles.taskItem} role="listitem">
                        <span>✓ {t.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={shouldReduceMotion ? { opacity: 0 } : { x: 30, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { x: -30, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className={styles.stepTitle}>Triage stale tasks</h2>
                <p className={styles.stepSubtitle}>
                  Tasks that haven&apos;t moved in over two weeks. Keep, reschedule, or clear them out.
                </p>

                <div className={styles.taskList} role="list" aria-label="Stale tasks">
                  {staleTasks.length === 0 ? (
                    <div className={styles.emptyState}>No stale tasks found. Your backlog is fresh!</div>
                  ) : (
                    staleTasks.map((t) => (
                      <div key={t.id} className={styles.taskItem} role="listitem">
                        <span>{t.title}</span>
                        <div className={styles.taskItemActions}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRescheduleNextWeek(t.id)}
                            aria-label={`Reschedule ${t.title} to next week`}
                          >
                            +7 Days
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTrashTask(t.id)}
                            aria-label={`Trash ${t.title}`}
                          >
                            Trash 🗑️
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={shouldReduceMotion ? { opacity: 0 } : { x: 30, opacity: 0 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { x: -30, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className={styles.stepTitle}>Plan next week&apos;s priorities</h2>
                <p className={styles.stepSubtitle}>
                  Set clear focus for upcoming tasks before your week begins.
                </p>

                <div className={styles.taskList} role="list" aria-label="Upcoming priority planning">
                  {upcomingTasks.map((t) => (
                    <div key={t.id} className={styles.taskItem} role="listitem">
                      <span>{t.title}</span>
                      <div className={styles.priorityGroup}>
                        {[
                          { val: 0, label: 'None' },
                          { val: 1, label: 'Low' },
                          { val: 2, label: 'Med' },
                          { val: 3, label: 'High' },
                        ].map((p) => (
                          <button
                            key={p.val}
                            type="button"
                            className={`${styles.priorityBtn} ${
                              t.priority === p.val ? styles.priorityBtnActive : ''
                            }`}
                            onClick={() => handleSetPriority(t.id, p.val)}
                            aria-label={`Set priority ${p.label} for ${t.title}`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (step < 3) {
                setStep((s) => s + 1);
              } else {
                onClose();
              }
            }}
          >
            {step === 3 ? 'Finish Review ✓' : 'Next →'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export default WeeklyReviewModal;
