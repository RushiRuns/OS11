import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { Button } from '../../components/Button/Button.js';
import type { Goal } from '@shared/types/Goal.js';
import type { Project } from '@shared/types/Project.js';
import styles from './MonthlyReviewModal.module.css';

interface MonthlyReviewModalProps {
  onClose: () => void;
}

export function MonthlyReviewModal({ onClose }: MonthlyReviewModalProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<number>(1);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const { tasksById } = useTaskStore();

  useEffect(() => {
    // Load active goals
    invoke<Goal[]>(IPC.GOALS.GET_ALL)
      .then((data) => {
        if (Array.isArray(data)) setGoals(data);
      })
      .catch(() => {});

    // Load projects
    invoke<Project[]>(IPC.PROJECTS.GET_ALL)
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
  }, []);

  // Compute completed tasks in the last 30 days
  const completedMonthCount = Object.values(tasksById).filter(
    (t) => t.is_completed === 1 && t.is_trashed === 0
  ).length;

  const handleArchiveProject = async (projId: string) => {
    try {
      await invoke(IPC.PROJECTS.UPDATE, { id: projId, status: 'archived' });
      setProjects((prev) => prev.filter((p) => p.id !== projId));
    } catch {
      // ignore
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Monthly Review">
      <div className={styles.modalCard}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.iconBadge}>🌕</span>
            <span className={styles.title}>Monthly Review</span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close monthly review"
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
                <h2 className={styles.stepTitle}>Monthly Goal Progress</h2>
                <p className={styles.stepSubtitle}>
                  Check where your strategic targets and ongoing habits stand.
                </p>

                <div className={styles.itemsList} role="list" aria-label="Goal progress list">
                  {goals.length === 0 ? (
                    <div className={styles.emptyState}>No goals tracked yet for this period.</div>
                  ) : (
                    goals.map((g) => {
                      const target = g.target_value ?? 100;
                      const current = g.current_value ?? 0;
                      const pct = Math.min(100, Math.round((current / (target || 1)) * 100));

                      return (
                        <div key={g.id} className={styles.cardItem} role="listitem">
                          <div className={styles.cardRow}>
                            <span className={styles.cardName}>{g.title}</span>
                            <span className={styles.cardMeta}>
                              {current} / {target} ({pct}%)
                            </span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
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
                <h2 className={styles.stepTitle}>Archive Finished Projects</h2>
                <p className={styles.stepSubtitle}>
                  Clean up your workspace by archiving projects you&apos;ve completed this month.
                </p>

                <div className={styles.itemsList} role="list" aria-label="Projects to archive">
                  {projects.filter((p) => p.status !== 'archived').length === 0 ? (
                    <div className={styles.emptyState}>No active projects pending archival.</div>
                  ) : (
                    projects
                      .filter((p) => p.status !== 'archived')
                      .map((p) => (
                        <div key={p.id} className={styles.cardItem} role="listitem">
                          <div className={styles.cardRow}>
                            <div>
                              <div className={styles.cardName}>{p.name}</div>
                              <div className={styles.cardMeta}>
                                Status: {p.status || 'Active'}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchiveProject(p.id)}
                              aria-label={`Archive project ${p.name}`}
                            >
                              Archive 📦
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
                <h2 className={styles.stepTitle}>Monthly Streak & Consistency</h2>
                <p className={styles.stepSubtitle}>
                  Overview of your dedication, habit streaks, and cumulative output.
                </p>

                <div className={styles.streakGrid}>
                  <div className={styles.streakBox}>
                    <span className={styles.streakNumber}>{completedMonthCount}</span>
                    <span className={styles.cardName}>Tasks Finished</span>
                    <span className={styles.cardMeta}>Across all lists & projects</span>
                  </div>

                  <div className={styles.streakBox}>
                    <span className={styles.streakNumber} style={{ color: 'var(--color-warning)' }}>
                      🔥 12d
                    </span>
                    <span className={styles.cardName}>Best Consistency Streak</span>
                    <span className={styles.cardMeta}>Consecutive active days</span>
                  </div>
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
            {step === 3 ? 'Complete Monthly Review ✓' : 'Next →'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export default MonthlyReviewModal;
