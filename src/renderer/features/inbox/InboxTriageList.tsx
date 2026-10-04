import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useUndoRedoStore } from '../../hooks/useUndoRedo.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
import { Toast } from '../../components/Toast/Toast.js';
import styles from './InboxTriageList.module.css';

export interface InboxTriageListProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function InboxTriageList({
  onSelectTask,
  selectedTaskId,
}: InboxTriageListProps): React.ReactElement {
  const tasksById = useTaskStore((state) => state.tasksById);
  const {
    toggleComplete,
    deleteTask,
    updateTask,
    setDate,
    setBucket,
    setWaiting,
    restoreSchedulingState,
  } = useTaskStore();

  const projects = useProjectStore((state) =>
    Object.values(state.projectsById).filter((p) => p.status !== 'archived')
  );
  const isEnabled = useModuleStore((state) => state.isEnabled);

  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [waitingTaskId, setWaitingTaskId] = useState<string | null>(null);
  const [waitingOnInput, setWaitingOnInput] = useState('');
  const [followUpDateInput, setFollowUpDateInput] = useState('');
  const [projectPickerTaskId, setProjectPickerTaskId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Untriaged Inbox tasks: incomplete, not trashed, in inbox / root without project or area
  const inboxTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter(
        (t) =>
          t.is_completed === 0 &&
          t.is_trashed === 0 &&
          ((t.area_id === null && t.project_id === null) || t.list_id === 'list_inbox')
      )
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }, [tasksById]);

  // Keep index within bounds
  useEffect(() => {
    if (inboxTasks.length === 0) {
      setActiveTaskIndex(0);
    } else if (activeTaskIndex >= inboxTasks.length) {
      setActiveTaskIndex(inboxTasks.length - 1);
    }
  }, [inboxTasks.length, activeTaskIndex]);

  const activeTask = inboxTasks[activeTaskIndex] || null;

  const showUndoToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const handleTriageToday = useCallback(
    async (task: Task) => {
      const today = new Date().toISOString().split('T')[0];
      const snapshot = { ...task };
      await updateTask({ id: task.id, my_day_date: today });
      useUndoRedoStore.getState().pushAction({
        description: `Moved "${task.title}" to Today`,
        undoFn: async () => {
          await updateTask({ id: task.id, my_day_date: snapshot.my_day_date });
        },
        redoFn: async () => {
          await updateTask({ id: task.id, my_day_date: today });
        },
      });
      showUndoToast(`Moved "${task.title}" to Today`);
    },
    [updateTask, showUndoToast]
  );

  const handleTriageTomorrow = useCallback(
    async (task: Task) => {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      const tmrwStr = tmrw.toISOString().split('T')[0];
      const snapshot = { ...task };
      await setDate({ taskId: task.id, dueDate: tmrwStr, dueTime: null, allDay: true });
      useUndoRedoStore.getState().pushAction({
        description: `Scheduled "${task.title}" for Tomorrow`,
        undoFn: async () => {
          await restoreSchedulingState(task.id, snapshot);
        },
        redoFn: async () => {
          await setDate({ taskId: task.id, dueDate: tmrwStr, dueTime: null, allDay: true });
        },
      });
      showUndoToast(`Scheduled "${task.title}" for Tomorrow`);
    },
    [setDate, restoreSchedulingState, showUndoToast]
  );

  const handleTriageNextWeek = useCallback(
    async (task: Task) => {
      const nextMon = new Date();
      nextMon.setDate(nextMon.getDate() + ((1 + 7 - nextMon.getDay()) % 7 || 7));
      const nextMonStr = nextMon.toISOString().split('T')[0];
      const snapshot = { ...task };
      await setDate({ taskId: task.id, dueDate: nextMonStr, dueTime: null, allDay: true });
      useUndoRedoStore.getState().pushAction({
        description: `Scheduled "${task.title}" for Next Week`,
        undoFn: async () => {
          await restoreSchedulingState(task.id, snapshot);
        },
        redoFn: async () => {
          await setDate({ taskId: task.id, dueDate: nextMonStr, dueTime: null, allDay: true });
        },
      });
      showUndoToast(`Scheduled "${task.title}" for Next Week`);
    },
    [setDate, restoreSchedulingState, showUndoToast]
  );

  const handleTriageAnytime = useCallback(
    async (task: Task) => {
      const snapshot = { ...task };
      await setBucket(task.id, 'anytime');
      useUndoRedoStore.getState().pushAction({
        description: `Moved "${task.title}" to Anytime`,
        undoFn: async () => {
          await restoreSchedulingState(task.id, snapshot);
        },
        redoFn: async () => {
          await setBucket(task.id, 'anytime');
        },
      });
      showUndoToast(`Moved "${task.title}" to Anytime`);
    },
    [setBucket, restoreSchedulingState, showUndoToast]
  );

  const handleTriageSomeday = useCallback(
    async (task: Task) => {
      const snapshot = { ...task };
      await setBucket(task.id, 'someday');
      useUndoRedoStore.getState().pushAction({
        description: `Moved "${task.title}" to Someday`,
        undoFn: async () => {
          await restoreSchedulingState(task.id, snapshot);
        },
        redoFn: async () => {
          await setBucket(task.id, 'someday');
        },
      });
      showUndoToast(`Moved "${task.title}" to Someday`);
    },
    [setBucket, restoreSchedulingState, showUndoToast]
  );

  const handleSaveWaiting = useCallback(
    async (task: Task) => {
      if (!waitingOnInput.trim()) return;
      const snapshot = { ...task };
      await setWaiting({
        taskId: task.id,
        waitingOn: waitingOnInput.trim(),
        followUpDate: followUpDateInput || null,
      });
      useUndoRedoStore.getState().pushAction({
        description: `Marked "${task.title}" Waiting on ${waitingOnInput.trim()}`,
        undoFn: async () => {
          await restoreSchedulingState(task.id, snapshot);
        },
        redoFn: async () => {
          await setWaiting({
            taskId: task.id,
            waitingOn: waitingOnInput.trim(),
            followUpDate: followUpDateInput || null,
          });
        },
      });
      showUndoToast(`Marked "${task.title}" Waiting`);
      setWaitingTaskId(null);
      setWaitingOnInput('');
      setFollowUpDateInput('');
    },
    [waitingOnInput, followUpDateInput, setWaiting, restoreSchedulingState, showUndoToast]
  );

  const handleMoveToProject = useCallback(
    async (task: Task, projectId: string) => {
      const proj = projects.find((p) => p.id === projectId);
      const prevProject = task.project_id;
      const prevArea = task.area_id;
      await updateTask({
        id: task.id,
        project_id: projectId,
        area_id: proj?.area_id ?? null,
      });
      useUndoRedoStore.getState().pushAction({
        description: `Moved "${task.title}" to ${proj?.name || 'Project'}`,
        undoFn: async () => {
          await updateTask({ id: task.id, project_id: prevProject, area_id: prevArea });
        },
        redoFn: async () => {
          await updateTask({
            id: task.id,
            project_id: projectId,
            area_id: proj?.area_id ?? null,
          });
        },
      });
      showUndoToast(`Moved to ${proj?.name || 'Project'}`);
      setProjectPickerTaskId(null);
    },
    [projects, updateTask, showUndoToast]
  );

  const handleDelete = useCallback(
    async (task: Task) => {
      await deleteTask(task.id);
      showUndoToast(`Deleted "${task.title}"`);
    },
    [deleteTask, showUndoToast]
  );

  // Keyboard navigation & triage shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setActiveTaskIndex((prev) => Math.min(prev + 1, Math.max(0, inboxTasks.length - 1)));
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setActiveTaskIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (!activeTask) return;

      if (e.key === '1' || e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleTriageToday(activeTask);
      } else if (e.key === '2') {
        e.preventDefault();
        handleTriageTomorrow(activeTask);
      } else if (e.key === '3') {
        e.preventDefault();
        handleTriageNextWeek(activeTask);
      } else if ((e.key === '4' || e.key.toLowerCase() === 'a') && isEnabled('anytime')) {
        e.preventDefault();
        handleTriageAnytime(activeTask);
      } else if ((e.key === '5' || e.key.toLowerCase() === 's') && isEnabled('someday')) {
        e.preventDefault();
        handleTriageSomeday(activeTask);
      } else if (e.key.toLowerCase() === 'w' && isEnabled('waiting_for')) {
        e.preventDefault();
        setWaitingTaskId(activeTask.id);
        setWaitingOnInput('');
        setFollowUpDateInput('');
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleComplete(activeTask.id);
        showUndoToast(`Completed "${activeTask.title}"`);
      } else if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleDelete(activeTask);
      } else if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
        e.preventDefault();
        onSelectTask?.(activeTask);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTask,
    inboxTasks.length,
    isEnabled,
    handleTriageToday,
    handleTriageTomorrow,
    handleTriageNextWeek,
    handleTriageAnytime,
    handleTriageSomeday,
    handleDelete,
    toggleComplete,
    showUndoToast,
    onSelectTask,
  ]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>
              <span>📥</span> Inbox
            </h1>
            <span className={styles.badge}>{inboxTasks.length} to clarify</span>
          </div>
        </div>

        {/* Cheat sheet */}
        <div className={styles.cheatSheet}>
          <span>
            <kbd className={styles.cheatKey}>1/t</kbd> Today
          </span>
          <span>
            <kbd className={styles.cheatKey}>2</kbd> Tomorrow
          </span>
          <span>
            <kbd className={styles.cheatKey}>3</kbd> Next week
          </span>
          {isEnabled('anytime') && (
            <span>
              <kbd className={styles.cheatKey}>4/a</kbd> Anytime
            </span>
          )}
          {isEnabled('someday') && (
            <span>
              <kbd className={styles.cheatKey}>5/s</kbd> Someday
            </span>
          )}
          {isEnabled('waiting_for') && (
            <span>
              <kbd className={styles.cheatKey}>w</kbd> Waiting
            </span>
          )}
          <span>
            <kbd className={styles.cheatKey}>c</kbd> Complete
          </span>
          <span>
            <kbd className={styles.cheatKey}>x</kbd> Delete
          </span>
          <span>
            <kbd className={styles.cheatKey}>e</kbd> Clarify
          </span>
        </div>
      </header>

      {/* Quick Add Bar */}
      <div className={styles.quickAddWrapper}>
        <QuickAddBar placeholder="Capture a thought to inbox..." />
      </div>

      {/* Triage Items List */}
      <div className={styles.scrollArea}>
        {inboxTasks.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="Inbox Zero"
            description="All captured items have been clarified and triaged."
          />
        ) : (
          inboxTasks.map((task, index) => {
            const isSelected =
              task.id === selectedTaskId || (index === activeTaskIndex && !selectedTaskId);
            const isWaitingEditing = waitingTaskId === task.id;
            const isProjectPicking = projectPickerTaskId === task.id;

            return (
              <div
                key={task.id}
                className={`${styles.triageCard} ${isSelected ? styles.triageCardSelected : ''}`}
                onClick={() => {
                  setActiveTaskIndex(index);
                  onSelectTask?.(task);
                }}
              >
                {/* Top Row: checkbox, title, meta */}
                <div className={styles.cardTopRow}>
                  <div
                    className={styles.checkboxWrap}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={false}
                      onChange={() => {
                        toggleComplete(task.id);
                        showUndoToast(`Completed "${task.title}"`);
                      }}
                      ariaLabel="Complete task"
                    />
                  </div>

                  <span className={styles.cardTitle}>{task.title}</span>

                  <div className={styles.cardMeta}>
                    {task.notes && <span title="Has notes">📝</span>}
                    {task.created_at && (
                      <span>{new Date(task.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Inline Waiting Form */}
                {isWaitingEditing && (
                  <div
                    className={styles.inlineInputForm}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      className={styles.textInput}
                      placeholder="Waiting on whom or what?"
                      value={waitingOnInput}
                      onChange={(e) => setWaitingOnInput(e.target.value)}
                      autoFocus
                      maxLength={120}
                    />
                    <input
                      type="date"
                      className={styles.textInput}
                      style={{ width: 'auto' }}
                      value={followUpDateInput}
                      onChange={(e) => setFollowUpDateInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleSaveWaiting(task)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => setWaitingTaskId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Inline Project Picker */}
                {isProjectPicking && (
                  <div
                    className={styles.inlineInputForm}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      className={styles.selectInput}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleMoveToProject(task, e.target.value);
                        }
                      }}
                    >
                      <option value="" disabled>
                        Select a project...
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.icon || '📁'} {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => setProjectPickerTaskId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div
                  className={styles.actionsRow}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleTriageToday(task)}
                    title="Move to Today [1/t]"
                  >
                    <span>☀️</span> Today
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleTriageTomorrow(task)}
                    title="Schedule for Tomorrow [2]"
                  >
                    <span>🌅</span> Tomorrow
                  </button>

                  {isEnabled('anytime') && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleTriageAnytime(task)}
                      title="Move to Anytime [4/a]"
                    >
                      <span>⚡</span> Anytime
                    </button>
                  )}

                  {isEnabled('someday') && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleTriageSomeday(task)}
                      title="Move to Someday [5/s]"
                    >
                      <span>📦</span> Someday
                    </button>
                  )}

                  {isEnabled('waiting_for') && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        setWaitingTaskId(task.id);
                        setWaitingOnInput('');
                        setFollowUpDateInput('');
                      }}
                      title="Mark Waiting For... [w]"
                    >
                      <span>⏳</span> Waiting
                    </button>
                  )}

                  {projects.length > 0 && (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => setProjectPickerTaskId(task.id)}
                      title="Move to project"
                    >
                      <span>📁</span> Project
                    </button>
                  )}

                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => handleDelete(task)}
                    title="Delete task [x]"
                  >
                    <span>🗑️</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Undo Toast */}
      {toastMessage && (
        <div className={styles.toastWrapper}>
          <Toast
            id="inbox-triage-toast"
            message={toastMessage}
            variant="undo"
            actionLabel="Undo"
            onAction={() => {
              useUndoRedoStore.getState().undo();
              setToastMessage(null);
            }}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}
    </div>
  );
}

export default InboxTriageList;
