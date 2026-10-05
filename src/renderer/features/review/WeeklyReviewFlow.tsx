import React, { useState, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { Button } from '../../components/Button/Button.js';
import { isStalled } from '@shared/utils/project-health.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { getIsoWeek } from './ReviewManager.js';
import type { Task, Project } from '@shared/types/index.js';
import { showPrompt } from '../../components/PromptDialog/PromptDialog.js';
import styles from './WeeklyReviewFlow.module.css';

export interface WeeklyReviewFlowProps {
  onFinish?: () => void;
}

type ReviewStep = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { id: 1, label: '1. Clear Inbox' },
  { id: 2, label: '2. Stalled Projects' },
  { id: 3, label: '3. Waiting For' },
  { id: 4, label: '4. Someday / Maybe' },
  { id: 5, label: '5. Celebrate & Wrap Up' },
];

export function WeeklyReviewFlow({ onFinish }: WeeklyReviewFlowProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<ReviewStep>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const { tasksById, updateTask, deleteTask, toggleComplete, createTask } = useTaskStore();
  const { projectsById, updateProject, archiveProject } = useProjectStore();
  const setActiveListId = useAppStore((state) => state.setActiveListId);

  const [somedayBatchOffset, setSomedayBatchOffset] = useState<number>(0);
  const [newActionTitleByProject, setNewActionTitleByProject] = useState<Record<string, string>>({});

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const markStepDone = (stepNum: number) => {
    if (!completedSteps.includes(stepNum)) {
      setCompletedSteps((prev) => [...prev, stepNum]);
    }
  };

  const handleNext = () => {
    markStepDone(currentStep);
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as ReviewStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as ReviewStep);
    }
  };

  const handleExit = () => {
    if (onFinish) {
      onFinish();
    } else {
      setActiveListId('smart_my_day');
    }
  };

  const handleCompleteReview = async () => {
    markStepDone(5);
    try {
      await invoke(IPC.SETTINGS.SET, {
        key: 'last_weekly_review_week',
        value: getIsoWeek(),
      });
    } catch {
      // ignore
    }
    handleExit();
  };

  // Step 1: Inbox tasks
  const inboxTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) =>
        t.is_completed === 0 &&
        t.is_trashed === 0 &&
        !t.area_id &&
        !t.project_id &&
        !t.parent_task_id &&
        !t.due_date &&
        !t.bucket &&
        !t.waiting_since
    );
  }, [tasksById]);

  // Step 2: Stalled Projects
  const allTasks = useMemo(() => Object.values(tasksById), [tasksById]);
  const stalledProjects = useMemo(() => {
    return Object.values(projectsById).filter((p) => isStalled(p, allTasks));
  }, [projectsById, allTasks]);

  // Step 3: Waiting For tasks
  const waitingTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) => t.is_completed === 0 && t.is_trashed === 0 && Boolean(t.waiting_since)
    );
  }, [tasksById]);

  // Step 4: Someday Tasks Batch
  const allSomedayTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => t.is_completed === 0 && t.is_trashed === 0 && t.bucket === 'someday')
      .sort((a, b) => {
        if (!a.reviewed_at && b.reviewed_at) return -1;
        if (a.reviewed_at && !b.reviewed_at) return 1;
        if (a.reviewed_at && b.reviewed_at) {
          return a.reviewed_at.localeCompare(b.reviewed_at);
        }
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
  }, [tasksById]);

  const somedayBatch = useMemo(() => {
    return allSomedayTasks.slice(somedayBatchOffset, somedayBatchOffset + 5);
  }, [allSomedayTasks, somedayBatchOffset]);

  const hasMoreSomeday = somedayBatchOffset + 5 < allSomedayTasks.length;

  // Step 5: Completed this week
  const completedThisWeek = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) =>
        t.is_completed === 1 &&
        t.is_trashed === 0 &&
        (t.completed_at ? t.completed_at >= sevenDaysAgo : true)
    );
  }, [tasksById, sevenDaysAgo]);

  // Actions for Step 1: Inbox Triage
  const handleAssignBucket = async (taskId: string, bucket: string | null, due_date?: string | null) => {
    try {
      if (bucket) {
        await invoke(IPC.TASKS.SET_BUCKET, { taskId, bucket });
      } else if (due_date) {
        await invoke(IPC.TASKS.SET_DATE, { taskId, due_date });
      }
      useTaskStore.getState().loadTasks();
    } catch {
      if (bucket) {
        updateTask({ id: taskId, bucket: bucket as any, due_date: due_date ?? null });
      } else if (due_date) {
        updateTask({ id: taskId, due_date });
      }
    }
  };

  const handleMakeWaiting = async (taskId: string) => {
    const contact = await showPrompt({
      title: 'Waiting For',
      message: 'Who are you waiting on?',
      placeholder: 'e.g. Sarah for approval',
    });
    if (contact === null) return;
    try {
      await invoke(IPC.TASKS.SET_WAITING, {
        taskId,
        waiting_on: contact.trim() || undefined,
        waiting_since: todayStr,
      });
      useTaskStore.getState().loadTasks();
    } catch {
      updateTask({ id: taskId, waiting_on: contact.trim() || null, waiting_since: todayStr });
    }
  };

  // Actions for Step 2: Stalled Projects
  const handleAddNextActionToProject = async (project: Project) => {
    const title = newActionTitleByProject[project.id]?.trim();
    if (!title) return;
    await createTask({
      title,
      project_id: project.id,
      area_id: project.area_id ?? undefined,
      bucket: 'anytime',
    });
    setNewActionTitleByProject((prev) => ({ ...prev, [project.id]: '' }));
  };

  const handleParkProjectInSomeday = async (project: Project) => {
    await updateProject(project.id, {
      is_someday: 1,
      status: 'parked',
    });
  };

  // Actions for Step 3: Waiting For
  const handleFollowUpToday = async (task: Task) => {
    try {
      await invoke(IPC.TASKS.SET_WAITING, {
        taskId: task.id,
        follow_up_date: todayStr,
      });
      useTaskStore.getState().loadTasks();
    } catch {
      updateTask({ id: task.id, follow_up_date: todayStr });
    }
  };

  // Actions for Step 4: Someday Batch
  const handleActivateSomedayTask = async (task: Task) => {
    await handleAssignBucket(task.id, 'anytime');
  };

  const handleKeepInSomeday = async (task: Task) => {
    const now = new Date().toISOString();
    try {
      await invoke(IPC.REVIEW.MARK_REVIEWED, { taskId: task.id, reviewedAt: now });
    } catch {
      updateTask({ id: task.id, reviewed_at: now });
    }
  };

  return (
    <div className={styles.container} aria-label="Weekly Review Flow">
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.titleArea}>
          <span className={styles.titleIcon}>📅</span>
          <h1 className={styles.titleHeading}>Weekly Review</h1>
        </div>

        <button
          type="button"
          className={styles.exitBtn}
          onClick={handleExit}
          aria-label="Exit weekly review"
        >
          <span>✕</span>
          <span>Exit Review</span>
        </button>
      </header>

      {/* Stepper Bar */}
      <nav className={styles.stepperBar} aria-label="Review Steps">
        {STEPS.map((s) => {
          const isActive = currentStep === s.id;
          const isDone = completedSteps.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.stepTab} ${isActive ? styles.stepTabActive : ''} ${
                isDone ? styles.stepTabCompleted : ''
              }`}
              onClick={() => setCurrentStep(s.id as ReviewStep)}
            >
              <span className={styles.stepNumber}>{isDone ? '✓' : s.id}</span>
              <span>{s.label.split('. ')[1]}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Step Content */}
      <div className={styles.scrollContent}>
        {/* Step 1: Clear Inbox */}
        {currentStep === 1 && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>Step 1: Clear the Inbox</h2>
              <p className={styles.stepSubtitle}>
                Get your inbox to zero. Quickly assign items to a schedule or GTD bucket.
              </p>
            </div>

            {inboxTasks.length === 0 ? (
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>🎉</span>
                <div>
                  <div className={styles.successTitle}>Inbox Zero!</div>
                  <div className={styles.successText}>
                    All inbox items have been processed and organized.
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.cardList}>
                {inboxTasks.map((t) => (
                  <div key={t.id} className={styles.cardItem}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>{t.title}</span>
                    </div>

                    <div className={styles.cardActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignBucket(t.id, null, todayStr)}
                      >
                        ☀️ Today
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignBucket(t.id, null, tomorrowStr)}
                      >
                        📅 Tomorrow
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignBucket(t.id, 'anytime')}
                      >
                        ⚡ Anytime
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignBucket(t.id, 'someday')}
                      >
                        📦 Someday
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMakeWaiting(t.id)}
                      >
                        ⏳ Waiting
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteTask(t.id)}
                        aria-label={`Trash ${t.title}`}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Stalled Projects */}
        {currentStep === 2 && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>Step 2: Review Stalled Projects</h2>
              <p className={styles.stepSubtitle}>
                Every active project needs a clear next action. Add an action now or park it in Someday.
              </p>
            </div>

            {stalledProjects.length === 0 ? (
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>✨</span>
                <div>
                  <div className={styles.successTitle}>All Projects are Moving!</div>
                  <div className={styles.successText}>
                    Every active project currently has at least one active next action scheduled.
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.cardList}>
                {stalledProjects.map((p) => (
                  <div key={p.id} className={styles.cardItem}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleWrap}>
                        <span>{p.icon || '📁'}</span>
                        <span className={styles.cardTitle}>{p.name}</span>
                        <span className={styles.stalledWarningBadge}>⚠️ No next action</span>
                      </div>
                      <div className={styles.cardActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleParkProjectInSomeday(p)}
                        >
                          📦 Park in Someday
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => archiveProject(p.id)}
                        >
                          Archive
                        </Button>
                      </div>
                    </div>

                    <div className={styles.inlineAddWrap}>
                      <input
                        type="text"
                        placeholder="Define next action for this project..."
                        className={styles.inlineInput}
                        value={newActionTitleByProject[p.id] || ''}
                        onChange={(e) =>
                          setNewActionTitleByProject((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNextActionToProject(p);
                          }
                        }}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!newActionTitleByProject[p.id]?.trim()}
                        onClick={() => handleAddNextActionToProject(p)}
                      >
                        + Add Action
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Waiting For */}
        {currentStep === 3 && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>Step 3: Review Waiting For</h2>
              <p className={styles.stepSubtitle}>
                Follow up on delegated tasks, pending replies, and vendor deliverables.
              </p>
            </div>

            {waitingTasks.length === 0 ? (
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>👍</span>
                <div>
                  <div className={styles.successTitle}>Clean Waiting For list!</div>
                  <div className={styles.successText}>
                    You have no pending items or blocked actions waiting on others.
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.cardList}>
                {waitingTasks.map((t) => (
                  <div key={t.id} className={styles.cardItem}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitleWrap}>
                        <span className={styles.cardTitle}>{t.title}</span>
                        {t.waiting_on && (
                          <span className={styles.metaBadge}>Waiting on: {t.waiting_on}</span>
                        )}
                        {t.follow_up_date && (
                          <span className={styles.metaBadge}>Follow up: {t.follow_up_date}</span>
                        )}
                      </div>
                      <div className={styles.cardActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFollowUpToday(t)}
                        >
                          🔔 Follow up today
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleComplete(t.id)}
                        >
                          ✓ Received / Done
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteTask(t.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Someday / Maybe Batch */}
        {currentStep === 4 && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>Step 4: Review Someday / Maybe</h2>
              <p className={styles.stepSubtitle}>
                Reviewing 5 ideas at a time keeps your review light and prevents fatigue.
              </p>
            </div>

            {somedayBatch.length === 0 ? (
              <div className={styles.successBanner}>
                <span className={styles.successIcon}>💡</span>
                <div>
                  <div className={styles.successTitle}>No Someday Tasks to Review</div>
                  <div className={styles.successText}>
                    Your someday list is empty or all items were recently reviewed.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.cardList}>
                  {somedayBatch.map((t) => (
                    <div key={t.id} className={styles.cardItem}>
                      <div className={styles.cardHeader}>
                        <div className={styles.cardTitleWrap}>
                          <span className={styles.cardTitle}>{t.title}</span>
                          {t.reviewed_at && (
                            <span className={styles.metaBadge}>
                              Reviewed: {t.reviewed_at.split('T')[0]}
                            </span>
                          )}
                        </div>
                        <div className={styles.cardActions}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleActivateSomedayTask(t)}
                          >
                            🚀 Activate (Anytime)
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleKeepInSomeday(t)}
                          >
                            📦 Keep in Someday
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => deleteTask(t.id)}
                          >
                            Drop
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMoreSomeday && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSomedayBatchOffset((prev) => prev + 5)}
                    >
                      ↻ Review 5 More ({allSomedayTasks.length - somedayBatchOffset - 5} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 5: Celebrate & Wrap Up */}
        {currentStep === 5 && (
          <div>
            <div className={styles.stepHeader}>
              <h2 className={styles.stepTitle}>Step 5: Celebrate & Wrap Up</h2>
              <p className={styles.stepSubtitle}>
                Take a moment to recognize what you accomplished this week.
              </p>
            </div>

            <div className={styles.celebrateCard}>
              <div className={styles.celebrateCount}>{completedThisWeek.length}</div>
              <div className={styles.celebrateLabel}>Tasks Completed in the Past 7 Days!</div>
              <div className={styles.celebrateSub}>
                Consistent execution and trusted GTD reviews keep your workload manageable and your mind clear.
              </div>
            </div>

            {completedThisWeek.length > 0 && (
              <div className={styles.cardList}>
                {completedThisWeek.slice(0, 15).map((t) => (
                  <div key={t.id} className={styles.cardItem} style={{ padding: 'var(--space-2) var(--space-4)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      ✓ {t.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <footer className={styles.navFooter}>
        {currentStep > 1 ? (
          <Button variant="ghost" size="md" onClick={handleBack}>
            ← Back
          </Button>
        ) : (
          <div />
        )}

        <div className={styles.navRight}>
          {currentStep < 5 ? (
            <Button variant="primary" size="md" onClick={handleNext}>
              Next Step →
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleCompleteReview}>
              Finish Review ✓
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default WeeklyReviewFlow;
