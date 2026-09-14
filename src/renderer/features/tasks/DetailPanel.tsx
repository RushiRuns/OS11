import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { useTaskStore, useSubtasks } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useGoalStore } from '../../stores/goalStore.js';
import { TagPicker } from '../tags/TagPicker.js';
import { RecurrencePicker } from './RecurrencePicker.js';
import { ReminderEditor } from './ReminderEditor.js';
import { AttachmentStrip } from '../attachments/AttachmentStrip.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { humanReadableRRule } from '../../../shared/utils/recurrence.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task, TaskHistoryRecord } from '@shared/types/index.js';
import styles from './DetailPanel.module.css';

export interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export function DetailPanel({ task, onClose }: DetailPanelProps): React.ReactElement {
  const { updateTask, toggleComplete, completeTask, createTask } = useTaskStore();
  const shouldReduceMotion = useReducedMotion();

  const [title, setTitle] = useState(task?.title ?? '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isRecurrencePickerOpen, setIsRecurrencePickerOpen] = useState(false);
  const [history, setHistory] = useState<TaskHistoryRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const subtasks = useSubtasks(task?.id ?? '');
  const taskTags = useTagStore((state) => (task ? state.getTagsForTask(task.id) : []));
  const { loadTagsForTask, removeTagFromTask } = useTagStore();

  const allTasks = useTaskStore((state) => state.tasksById);
  const { dependenciesByTaskId, loadDependenciesForTask, addDependency, removeDependency } =
    useProjectStore();
  const [selectedDepId, setSelectedDepId] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  const taskDependencies = task ? (dependenciesByTaskId[task.id] ?? []) : [];

  const { goalsById, linksByGoalId, linkTask, unlinkTask } = useGoalStore();
  const linkedGoal = React.useMemo(() => {
    if (!task) return null;
    for (const [goalId, links] of Object.entries(linksByGoalId)) {
      if (links.some((l) => l.resource_id === task.id)) {
        return goalsById[goalId] ?? null;
      }
    }
    return null;
  }, [linksByGoalId, goalsById, task]);

  // TipTap Rich Text Editor for Notes
  const editor = useEditor({
    extensions: [StarterKit],
    content: task?.notes ?? '',
    onBlur: ({ editor: currentEditor }) => {
      if (!task) return;
      const html = currentEditor.getHTML();
      const sanitized = DOMPurify.sanitize(html);
      if (sanitized !== task.notes) {
        updateTask({ id: task.id, notes: sanitized });
      }
    },
  });

  // Sync state on task change
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      loadTagsForTask(task.id);
      loadDependenciesForTask(task.id);
      setSelectedDepId('');
      setDepError(null);
      if (editor && editor.getHTML() !== (task.notes ?? '')) {
        editor.commands.setContent(task.notes ?? '');
      }

      // Fetch version history
      ipc
        .invoke<TaskHistoryRecord[]>(IPC.TASKS.GET_HISTORY, task.id)
        .then((records) => {
          if (records) setHistory(records);
        })
        .catch(() => {
          setHistory([]);
        });
    }
  }, [task, editor, loadTagsForTask, loadDependenciesForTask]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!task) {
    return (
      <aside className={styles.panelContainer} aria-label="Task Detail Panel">
        <EmptyState
          title="No Task Selected"
          description="Select a task from the list to view its details."
        />
      </aside>
    );
  }

  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== task.title) {
      updateTask({ id: task.id, title: title.trim() });
    } else {
      setTitle(task.title);
    }
  };

  const handleAddSubtask = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      await createTask({
        title: newSubtaskTitle.trim(),
        list_id: task.list_id,
        project_id: task.project_id,
        parent_task_id: task.id,
      });
      setNewSubtaskTitle('');
    }
  };

  const isMyDay = Boolean(task.my_day_date);

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!task) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const filePath = (file as unknown as { path?: string }).path;
          if (filePath) {
            try {
              await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, { taskId: task.id, sourcePath: filePath });
            } catch (err) {
              console.error('Failed to upload pasted image', err);
            }
          }
        }
      }
    }
  };

  return (
    <motion.aside
      className={styles.panelContainer}
      aria-label="Task Detail Panel"
      onPaste={handlePaste}
      initial={shouldReduceMotion ? false : { x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { x: 320, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }} // Framer Motion Site #2
    >
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Task Details</span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <div className={styles.content}>
        {/* Title Input */}
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          placeholder="Task title..."
        />

        {/* Quick Metadata Controls */}
        <div className={styles.metaGrid}>
          {/* Due Date & Time */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Due Date</span>
            <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
              <input
                type="date"
                className={styles.metaInput}
                value={task.due_date ?? ''}
                onChange={(e) =>
                  updateTask({
                    id: task.id,
                    due_date: e.target.value || null,
                  })
                }
              />
              <input
                type="time"
                className={styles.metaInput}
                style={{ maxWidth: '110px' }}
                value={task.due_time ?? ''}
                onChange={(e) =>
                  updateTask({
                    id: task.id,
                    due_time: e.target.value || null,
                  })
                }
                title="Due time"
                aria-label="Due time"
              />
            </div>
          </div>

          {/* Repeat / Recurrence */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Repeat</span>
            <button
              type="button"
              className={`${styles.metaBtn} ${task.recurrence_rule ? styles.metaBtnActive : ''}`}
              onClick={() => setIsRecurrencePickerOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textAlign: 'left' }}
            >
              <span>🔁</span>
              <span>
                {task.recurrence_rule
                  ? humanReadableRRule(task.recurrence_rule)
                  : 'Does not repeat'}
              </span>
            </button>
          </div>

          {/* Priority */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Priority</span>
            <select
              className={styles.metaInput}
              value={task.priority}
              onChange={(e) =>
                updateTask({
                  id: task.id,
                  priority: Number(e.target.value),
                })
              }
            >
              <option value="0">None (P0)</option>
              <option value="1">Low (P1)</option>
              <option value="2">Medium (P2)</option>
              <option value="3">High (P3)</option>
              <option value="4">Critical (P4)</option>
            </select>
          </div>

          {/* Star & My Day Toggles */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Quick Actions</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`${styles.metaBtn} ${task.is_starred === 1 ? styles.metaBtnActive : ''}`}
                onClick={() =>
                  updateTask({
                    id: task.id,
                    is_starred: task.is_starred === 1 ? 0 : 1,
                  })
                }
              >
                ★ {task.is_starred === 1 ? 'Starred' : 'Star'}
              </button>

              <button
                type="button"
                className={`${styles.metaBtn} ${isMyDay ? styles.metaBtnActive : ''}`}
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  updateTask({
                    id: task.id,
                    my_day_date: isMyDay ? null : today,
                  });
                }}
              >
                ☀️ {isMyDay ? 'In My Day' : 'Add to My Day'}
              </button>

              <button
                type="button"
                className={`${styles.metaBtn} ${task.is_habit === 1 ? styles.metaBtnActive : ''}`}
                onClick={() =>
                  updateTask({
                    id: task.id,
                    is_habit: task.is_habit === 1 ? 0 : 1,
                  })
                }
              >
                🔁 {task.is_habit === 1 ? 'Habit' : 'Mark Habit'}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Tags</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {taskTags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.08))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: tag.color ?? 'var(--tag-gray)',
                    }}
                  />
                  <span>#{tag.name}</span>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'var(--text-tertiary, #94a3b8)',
                      fontSize: '12px',
                      lineHeight: 1,
                    }}
                    onClick={() => removeTagFromTask(task.id, tag.id)}
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className={styles.metaBtn}
                onClick={() => setIsTagPickerOpen(true)}
              >
                + Tag
              </button>
            </div>
          </div>

          {/* Goal Link */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Goal</span>
            <select
              className={styles.metaInput}
              value={linkedGoal?.id || ''}
              onChange={(e) => {
                const nextGoalId = e.target.value;
                if (linkedGoal) {
                  unlinkTask(linkedGoal.id, task.id);
                }
                if (nextGoalId) {
                  linkTask(nextGoalId, task.id);
                }
              }}
            >
              <option value="">None (No Goal)</option>
              {Object.values(goalsById).map((g) => (
                <option key={g.id} value={g.id}>
                  🎯 {g.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subtasks Section */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>
            Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.is_completed === 1).length}/${subtasks.length})`}
          </span>

          <div className={styles.subtasksList}>
            {subtasks.map((sub) => (
              <div key={sub.id} className={styles.subtaskRow}>
                <div>
                  <Checkbox
                    checked={sub.is_completed === 1}
                    onChange={() => toggleComplete(sub.id)}
                  />
                </div>
                <span
                  className={`${styles.subtaskTitle} ${
                    sub.is_completed === 1 ? styles.subtaskCompleted : ''
                  }`}
                >
                  {sub.title}
                </span>
              </div>
            ))}

            <input
              type="text"
              className={styles.subtaskInput}
              placeholder="Add a subtask (Press Enter)..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={handleAddSubtask}
            />
          </div>
        </div>

        {/* Task Dependencies Section (Phase 10) */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>
            Depends On {taskDependencies.length > 0 && `(${taskDependencies.length})`}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {taskDependencies.map((depId) => {
              const depTask = allTasks[depId];
              const isDepDone = depTask?.is_completed === 1;

              return (
                <div
                  key={depId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-hover)',
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      textDecoration: isDepDone ? 'line-through' : 'none',
                      color: isDepDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    }}
                  >
                    {depTask ? depTask.title : `Task (${depId})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDependency(task.id, depId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-tertiary)',
                      fontSize: '12px',
                    }}
                    title="Remove dependency"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add Dependency Selector */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select
                style={{
                  flex: 1,
                  fontSize: '11px',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                value={selectedDepId}
                onChange={(e) => setSelectedDepId(e.target.value)}
              >
                <option value="">Select task this depends on...</option>
                {Object.values(allTasks)
                  .filter(
                    (t) =>
                      t.id !== task.id &&
                      !taskDependencies.includes(t.id) &&
                      t.is_trashed === 0
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className={styles.metaBtn}
                disabled={!selectedDepId}
                onClick={async () => {
                  setDepError(null);
                  try {
                    await addDependency(task.id, selectedDepId);
                    setSelectedDepId('');
                  } catch (err: unknown) {
                    setDepError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                + Add
              </button>
            </div>

            {depError && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                {depError}
              </span>
            )}
          </div>
        </div>

        {/* Reminders Section (Phase 11) */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>Reminders</span>
          <ReminderEditor
            taskId={task.id}
            dueDate={task.due_date}
            dueTime={task.due_time}
          />
        </div>

        {/* Attachments Section (Phase 15) */}
        <div className={styles.sectionBlock}>
          <AttachmentStrip taskId={task.id} />
        </div>

        {/* Rich Notes Section (TipTap) */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>Notes</span>
          <div className={styles.editorWrapper}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Version History Section (Phase 17) */}
        <div className={styles.sectionBlock}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          >
            <span className={styles.sectionHeader} style={{ margin: 0 }}>
              Version History {history.length > 0 && `(${history.length})`}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {isHistoryOpen ? 'Hide ▲' : 'Show ▼'}
            </span>
          </div>

          {isHistoryOpen && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No edit history recorded yet.
                </span>
              ) : (
                history.map((record) => {
                  const dateStr = new Date(record.changed_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const diffEntries = Object.entries(record.changed_fields);

                  const formatVal = (v: unknown) =>
                    v === null || v === undefined
                      ? 'None'
                      : typeof v === 'object'
                        ? JSON.stringify(v)
                        : String(v);

                  return (
                    <div
                      key={record.id}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--surface-raised)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 'var(--weight-semibold)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                          }}
                        >
                          {dateStr}
                        </span>
                        <button
                          type="button"
                          disabled={isRestoring}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'var(--weight-medium)',
                            padding: 0,
                          }}
                          onClick={async () => {
                            if (!confirm('Restore task to values from this edit?')) return;
                            setIsRestoring(true);
                            try {
                              const updated = await ipc.invoke<Task>(
                                IPC.TASKS.RESTORE_VERSION,
                                record.id
                              );
                              if (updated) {
                                updateTask(updated);
                                const updatedHistory = await ipc.invoke<TaskHistoryRecord[]>(
                                  IPC.TASKS.GET_HISTORY,
                                  task.id
                                );
                                if (updatedHistory) setHistory(updatedHistory);
                              }
                            } catch (e: unknown) {
                              alert(`Restore error: ${e instanceof Error ? e.message : String(e)}`);
                            } finally {
                              setIsRestoring(false);
                            }
                          }}
                        >
                          Restore
                        </button>
                      </div>
                      {diffEntries.map(([field, diff]) => (
                        <div
                          key={field}
                          style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.4 }}
                        >
                          <strong style={{ color: 'var(--text-primary)' }}>{field}</strong>:{' '}
                          <span style={{ textDecoration: 'line-through' }}>{formatVal(diff.from)}</span>{' '}
                          &rarr; {formatVal(diff.to)}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {isTagPickerOpen && task && (
        <TagPicker
          taskId={task.id}
          selectedTagIds={taskTags.map((t) => t.id)}
          onClose={() => setIsTagPickerOpen(false)}
        />
      )}

      {isRecurrencePickerOpen && task && (
        <RecurrencePicker
          isOpen={isRecurrencePickerOpen}
          onClose={() => setIsRecurrencePickerOpen(false)}
          currentRule={task.recurrence_rule}
          currentBasis={task.recurrence_basis}
          onSave={(rule, basis) => {
            updateTask({
              id: task.id,
              recurrence_rule: rule,
              recurrence_basis: basis,
            });
          }}
          onSkipOccurrence={() => {
            completeTask(task.id, { skipRecurrence: true });
          }}
        />
      )}
    </motion.aside>
  );
}

export default DetailPanel;
