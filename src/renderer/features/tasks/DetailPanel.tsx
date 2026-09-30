import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { useTaskStore, useSubtasks } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useListStore } from '../../stores/listStore.js';
import { useGoalStore } from '../../stores/goalStore.js';
import { TagPicker } from '../tags/TagPicker.js';
import { RecurrencePicker } from './RecurrencePicker.js';
import { ReminderEditor } from './ReminderEditor.js';
import { AttachmentStrip } from '../attachments/AttachmentStrip.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { Button } from '../../components/Button/Button.js';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar.js';
import { Tooltip } from '../../components/Tooltip/Tooltip.js';
import type { DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';

const DropdownMenu = React.lazy(
  () => import('../../components/primitives/DropdownMenu/DropdownMenu.js')
);
const DatePicker = React.lazy(() => import('../../components/DatePicker/DatePicker.js'));
import { humanReadableRRule } from '../../../shared/utils/recurrence.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task, TaskHistoryRecord } from '@shared/types/index.js';
import { getTagShapeClass } from '@shared/utils/tag-shape.js';
import styles from './DetailPanel.module.css';

export interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

const PRIORITY_CONFIG = [
  { value: 0, label: 'None (P0)', color: 'var(--text-tertiary)' },
  { value: 1, label: 'Low (P1)', color: 'var(--priority-low)' },
  { value: 2, label: 'Medium (P2)', color: 'var(--priority-medium)' },
  { value: 3, label: 'High (P3)', color: 'var(--priority-high)' },
  { value: 4, label: 'Critical (P4)', color: 'var(--priority-critical)' },
] as const;

export function DetailPanel({ task, onClose }: DetailPanelProps): React.ReactElement {
  const { updateTask, toggleComplete, completeTask, createTask, deleteTask, duplicateTask } =
    useTaskStore();
  const shouldReduceMotion = useReducedMotion();

  // Always bind directly to the latest state in the store by task ID
  // This completely eliminates any stale prop issues (such as priority dropdown lag)
  const storeTask = useTaskStore((state) => (task?.id ? state.tasksById[task.id] : null));
  const currentTask = storeTask ?? task;

  const [title, setTitle] = useState(currentTask?.title ?? '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isRecurrencePickerOpen, setIsRecurrencePickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPos, setDatePickerPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [history, setHistory] = useState<TaskHistoryRecord[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const prevTaskIdRef = useRef<string | null>(null);
  const isTitleFocusedRef = useRef(false);

  const subtasks = useSubtasks(currentTask?.id ?? '');
  const taskTags = useTagStore((state) => (currentTask ? state.getTagsForTask(currentTask.id) : []));
  const { loadTagsForTask, removeTagFromTask } = useTagStore();

  const allTasks = useTaskStore((state) => state.tasksById);
  const { dependenciesByTaskId, loadDependenciesForTask, addDependency, removeDependency } =
    useProjectStore();
  const projectsById = useProjectStore((state) => state.projectsById);
  const listsById = useListStore((state) => state.listsById);

  const [selectedDepId, setSelectedDepId] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  const taskDependencies = currentTask ? dependenciesByTaskId[currentTask.id] ?? [] : [];

  const { goalsById, linksByGoalId, linkTask, unlinkTask } = useGoalStore();
  const linkedGoal = useMemo(() => {
    if (!currentTask) return null;
    for (const [goalId, links] of Object.entries(linksByGoalId)) {
      if (links.some((l) => l.resource_id === currentTask.id)) {
        return goalsById[goalId] ?? null;
      }
    }
    return null;
  }, [linksByGoalId, goalsById, currentTask]);

  // TipTap Rich Text Editor for Notes
  const editor = useEditor({
    extensions: [StarterKit],
    content: currentTask?.notes ?? '',
    onBlur: ({ editor: currentEditor }) => {
      if (!currentTask) return;
      const html = currentEditor.getHTML();
      const sanitized = DOMPurify.sanitize(html);
      if (sanitized !== currentTask.notes) {
        updateTask({ id: currentTask.id, notes: sanitized });
      }
    },
  });

  // Sync state whenever active task changes
  useEffect(() => {
    if (!currentTask) return;

    if (prevTaskIdRef.current !== currentTask.id) {
      setTitle(currentTask.title);
      prevTaskIdRef.current = currentTask.id;
      loadTagsForTask(currentTask.id);
      loadDependenciesForTask(currentTask.id);
      setSelectedDepId('');
      setDepError(null);

      if (editor && editor.getHTML() !== (currentTask.notes ?? '')) {
        editor.commands.setContent(currentTask.notes ?? '');
      }

      // Fetch version history
      ipc
        .invoke<TaskHistoryRecord[]>(IPC.TASKS.GET_HISTORY, currentTask.id)
        .then((records) => {
          if (records) setHistory(records);
        })
        .catch(() => {
          setHistory([]);
        });
    } else if (!isTitleFocusedRef.current && currentTask.title !== title) {
      // Sync external title change when not actively focused
      setTitle(currentTask.title);
    }
  }, [currentTask, editor, loadTagsForTask, loadDependenciesForTask, title]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDatePickerOpen) {
          setIsDatePickerOpen(false);
          return;
        }
        if (isTagPickerOpen) {
          setIsTagPickerOpen(false);
          return;
        }
        if (isRecurrencePickerOpen) {
          setIsRecurrencePickerOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isDatePickerOpen, isTagPickerOpen, isRecurrencePickerOpen]);

  // Breadcrumb information (Project or List name)
  const breadcrumbName = useMemo(() => {
    if (!currentTask) return '📋 Inbox';
    if (currentTask.project_id && projectsById[currentTask.project_id]) {
      return `📁 ${projectsById[currentTask.project_id].name}`;
    }
    if (currentTask.list_id && listsById[currentTask.list_id]) {
      const l = listsById[currentTask.list_id];
      return `${l.icon ?? '📋'} ${l.name}`;
    }
    return '📋 Inbox';
  }, [currentTask, projectsById, listsById]);

  // Due date status formatting
  const dueDateInfo = useMemo(() => {
    if (!currentTask?.due_date) return null;

    const dateStr = currentTask.due_date.split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let label = dateStr;
    let isToday = false;
    let isOverdue = false;

    if (dateStr === todayStr) {
      label = 'Today';
      isToday = true;
    } else if (dateStr === tomorrowStr) {
      label = 'Tomorrow';
    } else {
      const d = new Date(dateStr + 'T00:00:00');
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (currentTask.due_time && currentTask.all_day !== 1) {
      const timeParts = currentTask.due_time.split(':');
      let hours = parseInt(timeParts[0], 10);
      const minutes = timeParts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      label += `, ${hours}:${minutes} ${ampm}`;
    }

    if (currentTask.is_completed !== 1) {
      if (dateStr < todayStr) {
        isOverdue = true;
      } else if (dateStr === todayStr && currentTask.due_time && currentTask.all_day !== 1) {
        const fullDue = new Date(`${dateStr}T${currentTask.due_time}`).getTime();
        if (fullDue < Date.now()) {
          isOverdue = true;
        }
      }
    }

    return { label, isToday, isOverdue };
  }, [currentTask?.due_date, currentTask?.due_time, currentTask?.all_day, currentTask?.is_completed]);

  if (!currentTask) {
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
    isTitleFocusedRef.current = false;
    if (title.trim() && title.trim() !== currentTask.title) {
      updateTask({ id: currentTask.id, title: title.trim() });
    } else {
      setTitle(currentTask.title);
    }
  };

  const handleAddSubtask = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      await createTask({
        title: newSubtaskTitle.trim(),
        list_id: currentTask.list_id,
        project_id: currentTask.project_id,
        parent_task_id: currentTask.id,
      });
      setNewSubtaskTitle('');
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!currentTask) return;
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
              await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, { taskId: currentTask.id, sourcePath: filePath });
            } catch (err) {
              console.error('Failed to upload pasted image', err);
            }
          }
        }
      }
    }
  };

  const isMyDay = Boolean(currentTask.my_day_date);
  const completedSubtasksCount = subtasks.filter((s) => s.is_completed === 1).length;
  const subtaskProgress =
    subtasks.length > 0 ? (completedSubtasksCount / subtasks.length) * 100 : 0;

  const currentPriorityConfig =
    PRIORITY_CONFIG.find((p) => p.value === currentTask.priority) ?? PRIORITY_CONFIG[0];

  // Priority Dropdown items
  const priorityMenuItems: (DropdownMenuItemConfig | 'separator')[] = PRIORITY_CONFIG.map((opt) => ({
    id: `p-${opt.value}`,
    label: opt.label,
    icon: (
      <span
        className={`${styles.priorityDot} ${opt.value === 4 ? styles.priorityCriticalPulse : ''}`}
        style={{ backgroundColor: opt.color }}
      />
    ),
    onClick: () => {
      updateTask({
        id: currentTask.id,
        priority: opt.value,
      });
    },
  }));

  // More actions dropdown items
  const moreActionsItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'toggle-my-day',
      label: isMyDay ? 'Remove from My Day' : 'Add to My Day',
      icon: <span>☀️</span>,
      onClick: () => {
        const today = new Date().toISOString().split('T')[0];
        updateTask({
          id: currentTask.id,
          my_day_date: isMyDay ? null : today,
        });
      },
    },
    {
      id: 'toggle-habit',
      label: currentTask.is_habit === 1 ? 'Unmark as Habit' : 'Mark as Habit',
      icon: <span>🔁</span>,
      onClick: () => {
        updateTask({
          id: currentTask.id,
          is_habit: currentTask.is_habit === 1 ? 0 : 1,
        });
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate Task',
      icon: <span>📋</span>,
      onClick: async () => {
        await duplicateTask(currentTask.id);
      },
    },
    'separator',
    {
      id: 'delete',
      label: 'Delete Task',
      icon: <span>🗑️</span>,
      danger: true,
      onClick: async () => {
        if (confirm('Delete this task?')) {
          await deleteTask(currentTask.id);
          onClose();
        }
      },
    },
  ];

  return (
    <motion.aside
      className={styles.panelContainer}
      aria-label="Task Detail Panel"
      onPaste={handlePaste}
      initial={shouldReduceMotion ? false : { x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { x: 30, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Top Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumbBadge} title={breadcrumbName}>
          <span>{breadcrumbName}</span>
        </div>

        <div className={styles.headerActions}>
          {/* Star Toggle */}
          <Tooltip content={currentTask.is_starred === 1 ? 'Unstar task' : 'Star task'}>
            <motion.button
              type="button"
              className={`${styles.actionBtn} ${currentTask.is_starred === 1 ? styles.starBtnActive : ''}`}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              onClick={() =>
                updateTask({
                  id: currentTask.id,
                  is_starred: currentTask.is_starred === 1 ? 0 : 1,
                })
              }
              aria-label="Toggle star"
            >
              ★
            </motion.button>
          </Tooltip>

          {/* More Actions Menu */}
          <React.Suspense
            fallback={
              <button type="button" className={styles.actionBtn} aria-label="More actions">
                •••
              </button>
            }
          >
            <DropdownMenu
              trigger={
                <button type="button" className={styles.actionBtn} aria-label="More actions">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </button>
              }
              items={moreActionsItems}
              align="end"
            />
          </React.Suspense>

          {/* Close Panel Button */}
          <Tooltip content="Close (Esc)">
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onClose}
              aria-label="Close detail panel"
            >
              ✕
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.content}>
        {/* Title & Completion Hero */}
        <div className={styles.heroSection}>
          <div className={styles.checkboxWrapper}>
            <Checkbox
              checked={currentTask.is_completed === 1}
              onChange={() => toggleComplete(currentTask.id)}
              ariaLabel="Complete task"
            />
          </div>

          <div className={styles.titleArea}>
            <input
              type="text"
              className={`${styles.titleInput} ${
                currentTask.is_completed === 1 ? styles.titleCompleted : ''
              }`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => {
                isTitleFocusedRef.current = true;
              }}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLElement).blur();
              }}
              placeholder="Task title..."
            />

            {currentTask.is_completed === 1 && (
              <span className={styles.statusIndicator}>
                <span>✓ Completed</span>
              </span>
            )}
          </div>
        </div>

        {/* Properties Matrix (Linear / Notion Style) */}
        <div className={styles.propertiesCard}>
          {/* Priority Row */}
          <div className={styles.propertyRow}>
            <span className={styles.propertyLabel}>
              <span style={{ fontSize: '13px' }}>🚩</span> Priority
            </span>
            <div className={styles.propertyControl}>
              <React.Suspense
                fallback={
                  <button type="button" className={styles.priorityPill}>
                    <span
                      className={styles.priorityDot}
                      style={{ backgroundColor: currentPriorityConfig.color }}
                    />
                    <span>{currentPriorityConfig.label}</span>
                  </button>
                }
              >
                <DropdownMenu
                  trigger={
                    <button
                      type="button"
                      className={`${styles.priorityPill} ${
                        currentTask.priority === 4 ? styles.priorityCriticalGlow : ''
                      }`}
                      aria-label="Change priority"
                    >
                      <span
                        className={`${styles.priorityDot} ${
                          currentTask.priority === 4 ? styles.priorityCriticalPulse : ''
                        }`}
                        style={{ backgroundColor: currentPriorityConfig.color }}
                      />
                      <span>{currentPriorityConfig.label}</span>
                      <span className={styles.chevron}>▾</span>
                    </button>
                  }
                  items={priorityMenuItems}
                  align="end"
                />
              </React.Suspense>
            </div>
          </div>

          {/* Due Date & Time Row */}
          <div className={styles.propertyRow}>
            <span className={styles.propertyLabel}>
              <span style={{ fontSize: '13px' }}>📅</span> Due Date
            </span>
            <div className={styles.propertyControl}>
              <button
                type="button"
                className={`${styles.datePill} ${
                  dueDateInfo?.isOverdue
                    ? styles.dateOverdue
                    : dueDateInfo?.isToday
                      ? styles.dateToday
                      : ''
                }`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDatePickerPos({ x: Math.max(10, rect.left - 260), y: rect.bottom + 8 });
                  setIsDatePickerOpen(true);
                }}
              >
                <span>{dueDateInfo ? dueDateInfo.label : 'Set due date'}</span>
                {dueDateInfo && (
                  <span
                    className={styles.clearMiniBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask({
                        id: currentTask.id,
                        due_date: null,
                        due_time: null,
                        all_day: 0,
                      });
                    }}
                    title="Clear due date"
                    role="button"
                    aria-label="Clear due date"
                  >
                    ✕
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Repeat / Recurrence Row */}
          <div className={styles.propertyRow}>
            <span className={styles.propertyLabel}>
              <span style={{ fontSize: '13px' }}>🔁</span> Repeat
            </span>
            <div className={styles.propertyControl}>
              <button
                type="button"
                className={styles.propertyPill}
                onClick={() => setIsRecurrencePickerOpen(true)}
              >
                <span>
                  {currentTask.recurrence_rule
                    ? humanReadableRRule(currentTask.recurrence_rule)
                    : 'Does not repeat'}
                </span>
                {currentTask.recurrence_rule && (
                  <span
                    className={styles.clearMiniBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask({
                        id: currentTask.id,
                        recurrence_rule: null,
                        recurrence_basis: null,
                      });
                    }}
                    title="Remove recurrence"
                    role="button"
                    aria-label="Remove recurrence"
                  >
                    ✕
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Goal Link Row */}
          <div className={styles.propertyRow}>
            <span className={styles.propertyLabel}>
              <span style={{ fontSize: '13px' }}>🎯</span> Goal
            </span>
            <div className={styles.propertyControl}>
              <select
                className={styles.propertySelect}
                value={linkedGoal?.id || ''}
                onChange={(e) => {
                  const nextGoalId = e.target.value;
                  if (linkedGoal) {
                    unlinkTask(linkedGoal.id, currentTask.id);
                  }
                  if (nextGoalId) {
                    linkTask(nextGoalId, currentTask.id);
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

          {/* Tags Row */}
          <div className={styles.propertyRow}>
            <span className={styles.propertyLabel}>
              <span style={{ fontSize: '13px' }}>🏷️</span> Tags
            </span>
            <div className={styles.propertyControl}>
              <div className={styles.tagsList}>
                {taskTags.map((tag) => (
                  <span key={tag.id} className={styles.tagChip}>
                    <span
                      className={`${getTagShapeClass(tag.id || tag.name)} ${styles.tagDot}`}
                      style={{ background: tag.color ?? 'var(--tag-gray)' }}
                      aria-hidden="true"
                    />
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      className={styles.tagRemoveBtn}
                      onClick={() => removeTagFromTask(currentTask.id, tag.id)}
                      title="Remove tag"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className={styles.addTagBtn}
                  onClick={() => setIsTagPickerOpen(true)}
                >
                  + Tag
                </button>
              </div>
            </div>
          </div>

          {/* Quick Toggles Row (Star, My Day, Habit) */}
          <div className={styles.quickTogglesRow}>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              className={`${styles.quickToggleChip} ${
                currentTask.is_starred === 1 ? styles.quickToggleStarActive : ''
              }`}
              onClick={() =>
                updateTask({
                  id: currentTask.id,
                  is_starred: currentTask.is_starred === 1 ? 0 : 1,
                })
              }
            >
              <span>★</span>
              <span>{currentTask.is_starred === 1 ? 'Starred' : 'Star'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              className={`${styles.quickToggleChip} ${isMyDay ? styles.quickToggleDayActive : ''}`}
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                updateTask({
                  id: currentTask.id,
                  my_day_date: isMyDay ? null : today,
                });
              }}
            >
              <span>☀️</span>
              <span>{isMyDay ? 'In My Day' : 'Add to My Day'}</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              className={`${styles.quickToggleChip} ${
                currentTask.is_habit === 1 ? styles.quickToggleHabitActive : ''
              }`}
              onClick={() =>
                updateTask({
                  id: currentTask.id,
                  is_habit: currentTask.is_habit === 1 ? 0 : 1,
                })
              }
            >
              <span>🔁</span>
              <span>{currentTask.is_habit === 1 ? 'Habit' : 'Habit'}</span>
            </motion.button>
          </div>
        </div>

        {/* Subtasks Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionTitle}>
              <span>📋</span> Subtasks {subtasks.length > 0 && `(${completedSubtasksCount}/${subtasks.length})`}
            </span>
            {subtasks.length > 0 && (
              <div className={styles.subtaskProgressWrapper}>
                <ProgressBar progress={subtaskProgress} size="thin" />
              </div>
            )}
          </div>

          <div className={styles.subtasksList}>
            <AnimatePresence initial={false}>
              {subtasks.map((sub) => (
                <motion.div
                  key={sub.id}
                  className={styles.subtaskRow}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden', padding: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Checkbox
                    checked={sub.is_completed === 1}
                    onChange={() => toggleComplete(sub.id)}
                    ariaLabel="Toggle subtask completion"
                  />
                  <span
                    className={`${styles.subtaskTitle} ${
                      sub.is_completed === 1 ? styles.subtaskCompleted : ''
                    }`}
                  >
                    {sub.title}
                  </span>
                  <button
                    type="button"
                    className={styles.subtaskDeleteBtn}
                    onClick={() => deleteTask(sub.id)}
                    title="Delete subtask"
                    aria-label="Delete subtask"
                  >
                    ✕
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className={styles.subtaskInputRow}>
              <input
                type="text"
                className={styles.subtaskInput}
                placeholder="Add subtask (Press Enter)..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleAddSubtask}
              />
              {newSubtaskTitle.trim() && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (newSubtaskTitle.trim()) {
                      await createTask({
                        title: newSubtaskTitle.trim(),
                        list_id: currentTask.list_id,
                        project_id: currentTask.project_id,
                        parent_task_id: currentTask.id,
                      });
                      setNewSubtaskTitle('');
                    }
                  }}
                >
                  Add
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Task Dependencies Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionTitle}>
              <span>🔗</span> Depends On {taskDependencies.length > 0 && `(${taskDependencies.length})`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {taskDependencies.map((depId) => {
              const depTask = allTasks[depId];
              const isDepDone = depTask?.is_completed === 1;

              return (
                <div key={depId} className={styles.depItem}>
                  <span
                    style={{
                      textDecoration: isDepDone ? 'line-through' : 'none',
                      color: isDepDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    }}
                  >
                    {isDepDone ? '✓ ' : '• '} {depTask ? depTask.title : `Task (${depId})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDependency(currentTask.id, depId)}
                    className={styles.clearMiniBtn}
                    title="Remove dependency"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <div className={styles.depAddRow}>
              <select
                className={styles.propertySelect}
                style={{ flex: 1, maxWidth: 'none' }}
                value={selectedDepId}
                onChange={(e) => setSelectedDepId(e.target.value)}
              >
                <option value="">Select prerequisite task...</option>
                {Object.values(allTasks)
                  .filter(
                    (t) =>
                      t.id !== currentTask.id &&
                      !taskDependencies.includes(t.id) &&
                      t.is_trashed === 0
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                disabled={!selectedDepId}
                onClick={async () => {
                  setDepError(null);
                  try {
                    await addDependency(currentTask.id, selectedDepId);
                    setSelectedDepId('');
                  } catch (err: unknown) {
                    setDepError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                + Add
              </Button>
            </div>

            {depError && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{depError}</span>
            )}
          </div>
        </div>

        {/* Reminders Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionTitle}>
              <span>⏰</span> Reminders
            </span>
          </div>
          <ReminderEditor
            taskId={currentTask.id}
            dueDate={currentTask.due_date}
            dueTime={currentTask.due_time}
          />
        </div>

        {/* Attachments Section */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionTitle}>
              <span>📎</span> Attachments
            </span>
          </div>
          <AttachmentStrip taskId={currentTask.id} />
        </div>

        {/* Rich Notes Section (TipTap) */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionTitle}>
              <span>📝</span> Notes
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Markdown enabled</span>
          </div>
          <div className={styles.editorWrapper}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Version History Accordion */}
        <div className={styles.sectionCard}>
          <div className={styles.historyHeader} onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
            <span className={styles.sectionTitle}>
              <span>🕒</span> Version History {history.length > 0 && `(${history.length})`}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
              {isHistoryOpen ? 'Hide ▲' : 'Show ▼'}
            </span>
          </div>

          <AnimatePresence>
            {isHistoryOpen && (
              <motion.div
                className={styles.historyList}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
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
                      <div key={record.id} className={styles.historyCard}>
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
                                    currentTask.id
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
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: '11px',
                              lineHeight: 1.4,
                            }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Area with Timestamps & Delete button */}
        <div className={styles.footer}>
          <div className={styles.timestamps}>
            <span>Created {new Date(currentTask.created_at).toLocaleDateString()}</span>
            {currentTask.updated_at && (
              <span>Updated {new Date(currentTask.updated_at).toLocaleDateString()}</span>
            )}
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm('Delete this task?')) {
                await deleteTask(currentTask.id);
                onClose();
              }
            }}
          >
            Delete Task
          </Button>
        </div>
      </div>

      {/* Date Picker Popover */}
      {isDatePickerOpen && (
        <React.Suspense fallback={null}>
          <DatePicker
            initialDate={currentTask.due_date}
            initialTime={currentTask.due_time}
            initialAllDay={currentTask.all_day === 1}
            position={datePickerPos}
            onSelect={(date, time, allDay) => {
              updateTask({
                id: currentTask.id,
                due_date: date,
                due_time: time,
                all_day: allDay ? 1 : 0,
              });
              setIsDatePickerOpen(false);
            }}
            onClose={() => setIsDatePickerOpen(false)}
          />
        </React.Suspense>
      )}

      {/* Tag Picker Modal */}
      {isTagPickerOpen && (
        <TagPicker
          taskId={currentTask.id}
          selectedTagIds={taskTags.map((t) => t.id)}
          onClose={() => setIsTagPickerOpen(false)}
        />
      )}

      {/* Recurrence Picker Modal */}
      {isRecurrencePickerOpen && (
        <RecurrencePicker
          isOpen={isRecurrencePickerOpen}
          onClose={() => setIsRecurrencePickerOpen(false)}
          currentRule={currentTask.recurrence_rule}
          currentBasis={currentTask.recurrence_basis}
          onSave={(rule, basis) => {
            updateTask({
              id: currentTask.id,
              recurrence_rule: rule,
              recurrence_basis: basis,
            });
          }}
          onSkipOccurrence={() => {
            completeTask(currentTask.id, { skipRecurrence: true });
          }}
        />
      )}
    </motion.aside>
  );
}

export default DetailPanel;
