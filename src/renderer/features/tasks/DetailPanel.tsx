import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import * as RadixPopover from '@radix-ui/react-popover';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import * as RadixTooltip from '@radix-ui/react-tooltip';

import { useTaskStore, useSubtasks } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useGoalStore } from '../../stores/goalStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { useAttachmentStore } from '../../stores/attachmentStore.js';
import { TagPicker } from '../tags/TagPicker.js';
import { RecurrencePicker } from './RecurrencePicker.js';
import { AttachmentStrip, type AttachmentStripHandle } from '../attachments/AttachmentStrip.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { getRadixPortalContainer } from '../../components/primitives/portal.js';
import { humanReadableRRule } from '../../../shared/utils/recurrence.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task, TaskHistoryRecord } from '@shared/types/index.js';
import { getTagShapeClass } from '@shared/utils/tag-shape.js';
import { capitalizeFirstLetter } from '@shared/utils/index.js';
import {
  fieldsWithValue,
  hiddenFields,
  type OptionalField,
} from './detailFields.js';
import styles from './DetailPanel.module.css';

const DatePicker = React.lazy(() => import('../../components/DatePicker/DatePicker.js'));

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

/* --- Line SVG Icons (var(--size-icon), single-colour line in currentColor) --- */
function CloseIconSvg() {
  return (
    <svg className={styles.closeIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FolderIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FlagIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function CalendarIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function BellIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TagIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function RepeatIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function TargetIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function HourglassIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

function HabitIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function LinkIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function AttachmentIconSvg() {
  return (
    <svg className={styles.labelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function PlusIconSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIconSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TrashIconSvg({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function DetailPanel({ task, onClose }: DetailPanelProps): React.ReactElement {
  const {
    updateTask,
    toggleComplete,
    createTask,
    deleteTask,
    setDate,
    setBucket,
    setWaiting,
    clearWaiting,
  } = useTaskStore();
  const shouldReduceMotion = useReducedMotion();

  // Always bind directly to latest state in store by task ID
  const storeTask = useTaskStore((state) => (task?.id ? state.tasksById[task.id] : null));
  const currentTask = storeTask ?? task;

  const isFirstMountRef = useRef(true);
  useEffect(() => {
    // Switch to 'switch' after initial entrance animation
    const timer = setTimeout(() => {
      isFirstMountRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const [title, setTitle] = useState(currentTask?.title ?? '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [isRecurrencePickerOpen, setIsRecurrencePickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPos, setDatePickerPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [isPriorityPopoverOpen, setIsPriorityPopoverOpen] = useState(false);
  const [isGoalPopoverOpen, setIsGoalPopoverOpen] = useState(false);
  const [isReminderPopoverOpen, setIsReminderPopoverOpen] = useState(false);
  const [isAddPropertyMenuOpen, setIsAddPropertyMenuOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TaskHistoryRecord[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSectionPopoverOpen, setIsSectionPopoverOpen] = useState(false);

  const projectViewId = currentTask?.project_id ? `project:${currentTask.project_id}` : null;
  const hookActiveCustomGroupId = useViewGroupStore((state) =>
    projectViewId ? state.getActiveCustomGroup(projectViewId) : null
  );
  const activeCustomGroupId = typeof window === 'undefined'
    ? (projectViewId ? useViewGroupStore.getState().getActiveCustomGroup(projectViewId) : null)
    : hookActiveCustomGroupId;

  const hookCustomGroups = useCustomGroupStore((state) => state.groups);
  const customGroups = typeof window === 'undefined' ? useCustomGroupStore.getState().groups : hookCustomGroups;

  const hookTaskCustomValues = useCustomGroupStore((state) => state.taskValues);
  const taskCustomValues = typeof window === 'undefined' ? useCustomGroupStore.getState().taskValues : hookTaskCustomValues;

  const hookCustomOverrides = useCustomGroupStore((state) => state.overrides);
  const customOverrides = typeof window === 'undefined' ? useCustomGroupStore.getState().overrides : hookCustomOverrides;
  const activeCustomGroup = customGroups.find((g) => g.id === activeCustomGroupId);

  const currentSectionId = currentTask ? taskCustomValues[currentTask.id] || null : null;
  const currentCustomSectionName = useMemo(() => {
    if (!currentSectionId || !activeCustomGroup) return 'Unsorted';
    const sec = activeCustomGroup.sections?.find((s) => s.id === currentSectionId);
    if (!sec) return 'Unsorted';
    const override = customOverrides.find((o) => o.section_id === sec.id);
    return override?.name_override ?? sec.name;
  }, [currentSectionId, activeCustomGroup, customOverrides]);

  const availableCustomSections = useMemo(() => {
    if (!activeCustomGroup?.sections) return [];
    return activeCustomGroup.sections.filter((s) => {
      const isHidden = customOverrides.some((o) => o.section_id === s.id && o.is_hidden === 1);
      return !isHidden || s.id === currentSectionId;
    });
  }, [activeCustomGroup, customOverrides, currentSectionId]);

  // Drag over panel detection for attachment drop overlay
  const [dragDepth, setDragDepth] = useState(0);

  // Prerequisite dependency picker state
  const [selectedDepId, setSelectedDepId] = useState('');
  const [depError, setDepError] = useState<string | null>(null);

  // Reminders state
  interface ReminderItem {
    id: string;
    remind_at: string;
  }
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [reminderCustomDate, setReminderCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reminderCustomTime, setReminderCustomTime] = useState('09:00');

  const attachmentStripRef = useRef<AttachmentStripHandle>(null);
  const storedAttachmentCount = useAttachmentStore(
    (s) => (currentTask?.id ? s.countsByTaskId[currentTask.id] : 0) ?? 0
  );
  const [attachmentsCount, setAttachmentsCount] = useState(storedAttachmentCount);

  const prevTaskIdRef = useRef<string | null>(null);
  const isTitleFocusedRef = useRef(false);

  const subtasks = useSubtasks(currentTask?.id ?? '');
  const taskTags = useTagStore((state) => (currentTask ? state.getTagsForTask(currentTask.id) : []));
  const { loadTagsForTask, removeTagFromTask } = useTagStore();

  const allTasks = useTaskStore((state) => state.tasksById);
  const { dependenciesByTaskId, loadDependenciesForTask, addDependency, removeDependency } =
    useProjectStore();

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

  // Load reminders for task
  const loadReminders = useCallback(async (taskId: string) => {
    try {
      const data = await ipc.invoke<ReminderItem[]>(IPC.REMINDERS.GET_BY_TASK, taskId);
      if (Array.isArray(data)) {
        setReminders(data);
      }
    } catch {
      setReminders([]);
    }
  }, []);

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
      loadReminders(currentTask.id);
      setSelectedDepId('');
      setDepError(null);
      setIsHistoryOpen(false);

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
      setTitle(currentTask.title);
    }
  }, [currentTask, editor, loadTagsForTask, loadDependenciesForTask, loadReminders, title]);

  // Keyboard navigation & Esc hierarchy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;

        if (isSectionPopoverOpen) {
          setIsSectionPopoverOpen(false);
          return;
        }
        if (isPriorityPopoverOpen) {
          setIsPriorityPopoverOpen(false);
          return;
        }
        if (isGoalPopoverOpen) {
          setIsGoalPopoverOpen(false);
          return;
        }
        if (isReminderPopoverOpen) {
          setIsReminderPopoverOpen(false);
          return;
        }
        if (isAddPropertyMenuOpen) {
          setIsAddPropertyMenuOpen(false);
          return;
        }
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
  }, [
    onClose,
    isPriorityPopoverOpen,
    isGoalPopoverOpen,
    isReminderPopoverOpen,
    isAddPropertyMenuOpen,
    isDatePickerOpen,
    isTagPickerOpen,
    isRecurrencePickerOpen,
  ]);

  /* --- On-Demand Fields Engine --- */
  const currentFieldValues = useMemo(
    () =>
      fieldsWithValue(currentTask, {
        hasGoal: Boolean(linkedGoal),
        hasDependencies: taskDependencies.length > 0,
        hasAttachments: attachmentsCount > 0,
      }),
    [currentTask, linkedGoal, taskDependencies.length, attachmentsCount]
  );

  const [sticky, setSticky] = useState<Set<OptionalField>>(() => currentFieldValues);

  // Synchronously reset sticky state when task id changes
  const prevTaskIdForStickyRef = useRef(currentTask?.id);
  if (currentTask && prevTaskIdForStickyRef.current !== currentTask.id) {
    prevTaskIdForStickyRef.current = currentTask.id;
    setSticky(currentFieldValues);
  }

  // Keep newly populated fields sticky so clearing value doesn't hide them mid-edit
  useEffect(() => {
    if (currentFieldValues.size > 0) {
      setSticky((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const f of currentFieldValues) {
          if (!next.has(f)) {
            next.add(f);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [currentFieldValues]);

  const visibleFields = useMemo(() => {
    return new Set<OptionalField>([...sticky, ...currentFieldValues]);
  }, [sticky, currentFieldValues]);

  const hiddenOptionalFields = useMemo(() => hiddenFields(visibleFields), [visibleFields]);

  // Due date formatting
  const dueDateInfo = useMemo(() => {
    if (!currentTask?.due_date) return null;

    const dateStr = currentTask.due_date.split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let label = dateStr;
    let isOverdue = false;

    if (dateStr === todayStr) {
      label = 'Today';
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

    return { label, isOverdue };
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
    const cleanTitle = title.trim();
    if (cleanTitle && cleanTitle !== currentTask.title) {
      updateTask({ id: currentTask.id, title: cleanTitle });
    } else {
      setTitle(currentTask.title);
    }
  };

  const handleAddSubtask = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      await createTask({
        title: newSubtaskTitle.trim(),
        area_id: currentTask.area_id,
        project_id: currentTask.project_id,
        list_id: currentTask.list_id,
        section_id: currentTask.section_id,
        my_day_date: currentTask.my_day_date,
        parent_task_id: currentTask.id,
      });
      setNewSubtaskTitle('');
    }
  };

  // Drag overlay events on the panel
  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      setDragDepth((prev) => prev + 1);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      setDragDepth((prev) => Math.max(0, prev - 1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    setDragDepth(0);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = (file as unknown as { path?: string }).path;
      if (filePath) {
        try {
          await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, {
            taskId: currentTask.id,
            sourcePath: filePath,
          });
        } catch (err) {
          console.error('Failed to upload dropped file', err);
        }
      }
    }

    setSticky((prev) => new Set([...prev, 'attachments']));
    attachmentStripRef.current?.refresh();
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
              await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, {
                taskId: currentTask.id,
                sourcePath: filePath,
              });
              setSticky((prev) => new Set([...prev, 'attachments']));
              attachmentStripRef.current?.refresh();
            } catch (err) {
              console.error('Failed to upload pasted image', err);
            }
          }
        }
      }
    }
  };

  const handleSelectOptionalField = (field: OptionalField) => {
    setSticky((prev) => new Set([...prev, field]));
    // Open the field's picker after grow transition
    setTimeout(() => {
      switch (field) {
        case 'repeat':
          setIsRecurrencePickerOpen(true);
          break;
        case 'goal':
          setIsGoalPopoverOpen(true);
          break;
        case 'waitingFor': {
          const person = prompt('Waiting on whom or what?');
          if (person && person.trim()) {
            setWaiting({ taskId: currentTask.id, waitingOn: person.trim() });
          }
          break;
        }
        case 'habit':
          updateTask({ id: currentTask.id, is_habit: 1 });
          break;
        case 'attachments':
          attachmentStripRef.current?.pickAndUpload();
          break;
        default:
          break;
      }
    }, 240);
  };

  const currentPriorityConfig =
    PRIORITY_CONFIG.find((p) => p.value === currentTask.priority) ?? PRIORITY_CONFIG[0];

  const portalContainer = getRadixPortalContainer();

  return (
    <motion.aside
      className={styles.panelContainer}
      aria-label="Task Detail Panel"
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      initial={shouldReduceMotion ? false : { x: 30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { x: 30, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Drag Overlay */}
      {dragDepth > 0 && (
        <div className={styles.dropOverlay}>
          <span>Drop to attach</span>
        </div>
      )}

      <div
        key={currentTask.id}
        className={styles.body}
        data-entrance={isFirstMountRef.current ? 'open' : 'switch'}
      >
        {/* Block 0: Header with Close Icon only */}
        <div className={`${styles.headerRow} ${styles.block}`} style={{ '--i': 0 } as React.CSSProperties}>
          <RadixTooltip.Provider delayDuration={300}>
            <RadixTooltip.Root>
              <RadixTooltip.Trigger asChild>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={onClose}
                  aria-label="Close task details"
                >
                  <CloseIconSvg />
                </button>
              </RadixTooltip.Trigger>
              <RadixTooltip.Portal container={portalContainer}>
                <RadixTooltip.Content
                  className={styles.glassContent}
                  side="bottom"
                  sideOffset={4}
                >
                  <span className={styles.tooltipText}>
                    Close (Esc)
                  </span>
                </RadixTooltip.Content>
              </RadixTooltip.Portal>
            </RadixTooltip.Root>
          </RadixTooltip.Provider>
        </div>

        {/* Block 1: Title with Checkbox */}
        <div className={`${styles.titleBlock} ${styles.block}`} style={{ '--i': 0 } as React.CSSProperties}>
          <div className={styles.checkboxWrapper}>
            <Checkbox
              checked={currentTask.is_completed === 1}
              onChange={() => toggleComplete(currentTask.id)}
              ariaLabel="Complete task"
            />
          </div>
          <textarea
            rows={1}
            className={`${styles.titleTextarea} ${
              currentTask.is_completed === 1 ? styles.titleCompleted : ''
            }`}
            value={title}
            onChange={(e) => setTitle(e.target.value.replace(/[\r\n]+/g, ' '))}
            onFocus={() => {
              isTitleFocusedRef.current = true;
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLElement).blur();
              }
            }}
            placeholder="Task title..."
            aria-label="Task title"
          />
        </div>

        {/* Block 2: Properties Block */}
        <div className={`${styles.propertiesBlock} ${styles.block}`} style={{ '--i': 1 } as React.CSSProperties}>
          {/* Priority Row (Always) */}
          <RadixPopover.Root open={isPriorityPopoverOpen} onOpenChange={setIsPriorityPopoverOpen}>
            <RadixPopover.Trigger asChild>
              <div
                className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
                role="button"
                tabIndex={0}
                aria-label="Priority"
              >
                <div className={styles.propertyLabel}>
                  <FlagIconSvg />
                  <span>Priority</span>
                </div>
                <div className={styles.propertyValue}>
                  <span
                    className={`${styles.priorityDot} ${styles['priorityDot' + currentTask.priority]} ${
                      currentTask.priority === 4 ? styles.priorityCriticalPulse : ''
                    }`}
                  />
                  <span>{currentPriorityConfig.label}</span>
                </div>
              </div>
            </RadixPopover.Trigger>
            <RadixPopover.Portal container={portalContainer}>
              <RadixPopover.Content
                className={styles.glassContent}
                align="start"
                side="bottom"
                sideOffset={4}
              >
                {PRIORITY_CONFIG.map((opt) => (
                  <div
                    key={opt.value}
                    className={styles.glassItem}
                    onClick={() => {
                      updateTask({ id: currentTask.id, priority: opt.value });
                      setIsPriorityPopoverOpen(false);
                    }}
                    role="option"
                    aria-selected={currentTask.priority === opt.value}
                  >
                    <span
                      className={`${styles.priorityDot} ${styles['priorityDot' + opt.value]}`}
                    />
                    <span>{opt.label}</span>
                    {currentTask.priority === opt.value && (
                      <span className={styles.glassItemCheck}>✓</span>
                    )}
                  </div>
                ))}
              </RadixPopover.Content>
            </RadixPopover.Portal>
          </RadixPopover.Root>

          {/* When Row (Always) */}
          <div
            className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setDatePickerPos({ x: Math.max(10, rect.left), y: rect.bottom + 6 });
              setIsDatePickerOpen(true);
            }}
            role="button"
            tabIndex={0}
            aria-label="When"
          >
            <div className={styles.propertyLabel}>
              <CalendarIconSvg />
              <span>When</span>
            </div>
            <div className={styles.propertyValue}>
              {currentTask.bucket ? (
                <span className={styles.propertyValue}>
                  {currentTask.bucket === 'anytime' ? 'Anytime' : 'Someday'}
                </span>
              ) : dueDateInfo ? (
                <span
                  className={`${styles.propertyValue} ${
                    dueDateInfo.isOverdue ? styles.valueOverdue : ''
                  }`}
                >
                  {dueDateInfo.label}
                </span>
              ) : (
                <span className={`${styles.propertyValue} ${styles.valueEmpty}`}>
                  Set date
                </span>
              )}
            </div>
          </div>

          {/* Reminders Row (Always) */}
          <div className={styles.propertyRow}>
            <div className={styles.propertyLabel}>
              <BellIconSvg />
              <span>Reminders</span>
            </div>
            <div className={styles.propertyValue}>
              <div className={styles.chipsContainer}>
                {reminders.map((r) => {
                  const d = new Date(r.remind_at);
                  const label = d.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  });
                  return (
                    <span key={r.id} className={`${styles.chip} ${styles.chipEnter}`}>
                      <span className={styles.chipText}>{label}</span>
                      <button
                        type="button"
                        className={styles.chipRemoveBtn}
                        onClick={async () => {
                          try {
                            await ipc.invoke(IPC.REMINDERS.DELETE, r.id);
                            loadReminders(currentTask.id);
                          } catch (err) {
                            console.error('Delete reminder failed', err);
                          }
                        }}
                        aria-label={`Remove reminder ${label}`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}

                <RadixPopover.Root open={isReminderPopoverOpen} onOpenChange={setIsReminderPopoverOpen}>
                  <RadixPopover.Trigger asChild>
                    <button type="button" className={styles.addChipBtn} aria-label="Add reminder">
                      + Add
                    </button>
                  </RadixPopover.Trigger>
                  <RadixPopover.Portal container={portalContainer}>
                    <RadixPopover.Content
                      className={styles.glassContent}
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <div className={styles.reminderPopoverBody}>
                        {/* Presets */}
                        <div
                          className={styles.glassItem}
                          onClick={async () => {
                            const now = Date.now();
                            const target = new Date(now + 60 * 60 * 1000).toISOString();
                            await ipc.invoke(IPC.REMINDERS.SET, {
                              task_id: currentTask.id,
                              remind_at: target,
                            });
                            await loadReminders(currentTask.id);
                            setIsReminderPopoverOpen(false);
                          }}
                        >
                          <span>1 hour before</span>
                        </div>
                        <div
                          className={styles.glassItem}
                          onClick={async () => {
                            const now = Date.now();
                            const target = new Date(now + 24 * 60 * 60 * 1000).toISOString();
                            await ipc.invoke(IPC.REMINDERS.SET, {
                              task_id: currentTask.id,
                              remind_at: target,
                            });
                            await loadReminders(currentTask.id);
                            setIsReminderPopoverOpen(false);
                          }}
                        >
                          <span>1 day before</span>
                        </div>

                        <div className={styles.reminderInputsRow}>
                          <input
                            type="date"
                            className={styles.reminderInput}
                            value={reminderCustomDate}
                            onChange={(e) => setReminderCustomDate(e.target.value)}
                            aria-label="Reminder date"
                          />
                          <input
                            type="time"
                            className={styles.reminderInput}
                            value={reminderCustomTime}
                            onChange={(e) => setReminderCustomTime(e.target.value)}
                            aria-label="Reminder time"
                          />
                        </div>
                        <button
                          type="button"
                          className={styles.reminderAddBtn}
                          onClick={async () => {
                            if (!reminderCustomDate || !reminderCustomTime) return;
                            const iso = new Date(`${reminderCustomDate}T${reminderCustomTime}:00`).toISOString();
                            await ipc.invoke(IPC.REMINDERS.SET, {
                              task_id: currentTask.id,
                              remind_at: iso,
                            });
                            await loadReminders(currentTask.id);
                            setIsReminderPopoverOpen(false);
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </RadixPopover.Content>
                  </RadixPopover.Portal>
                </RadixPopover.Root>
              </div>
            </div>
          </div>

          {/* Tags Row (Always) */}
          <div className={styles.propertyRow}>
            <div className={styles.propertyLabel}>
              <TagIconSvg />
              <span>Tags</span>
            </div>
            <div className={styles.propertyValue}>
              <div className={styles.chipsContainer}>
                {taskTags.map((tag) => (
                  <span key={tag.id} className={`${styles.chip} ${styles.chipEnter}`}>
                    <span
                      className={`${getTagShapeClass(tag.id || tag.name)} ${styles.tagShapeDot}`}
                      aria-hidden="true"
                    />
                    <span className={styles.chipText}>#{tag.name}</span>
                    <button
                      type="button"
                      className={styles.chipRemoveBtn}
                      onClick={() => removeTagFromTask(currentTask.id, tag.id)}
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className={styles.addChipBtn}
                  onClick={() => setIsTagPickerOpen(true)}
                  aria-label="Add tag"
                >
                  + Tag
                </button>
              </div>
            </div>
          </div>

          {/* Custom Group Section Row (Shown on-demand when task is top-level and project has active custom group) */}
          {!currentTask.parent_task_id && activeCustomGroup && (
            <RadixPopover.Root open={isSectionPopoverOpen} onOpenChange={setIsSectionPopoverOpen}>
              <RadixPopover.Trigger asChild>
                <div
                  className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
                  role="button"
                  tabIndex={0}
                  aria-label={activeCustomGroup.name}
                >
                  <div className={styles.propertyLabel}>
                    <FolderIconSvg />
                    <span>{activeCustomGroup.name}</span>
                  </div>
                  <div className={styles.propertyValue}>
                    <span>{currentCustomSectionName}</span>
                  </div>
                </div>
              </RadixPopover.Trigger>
              <RadixPopover.Portal container={portalContainer}>
                <RadixPopover.Content
                  className={styles.glassContent}
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <div
                    className={styles.glassItem}
                    onClick={async () => {
                      await useCustomGroupStore.getState().moveTasks([currentTask.id], null);
                      setIsSectionPopoverOpen(false);
                    }}
                    role="option"
                    aria-selected={!currentSectionId}
                  >
                    <span>Unsorted</span>
                    {!currentSectionId && <span className={styles.glassItemCheck}>✓</span>}
                  </div>

                  {availableCustomSections.map((sec) => {
                    const isSelected = currentSectionId === sec.id;
                    const override = customOverrides.find((o) => o.section_id === sec.id);
                    const secName = override?.name_override ?? sec.name;

                    return (
                      <div
                        key={sec.id}
                        className={styles.glassItem}
                        onClick={async () => {
                          await useCustomGroupStore.getState().moveTasks([currentTask.id], sec.id);
                          setIsSectionPopoverOpen(false);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <span>{secName}</span>
                        {isSelected && <span className={styles.glassItemCheck}>✓</span>}
                      </div>
                    );
                  })}
                </RadixPopover.Content>
              </RadixPopover.Portal>
            </RadixPopover.Root>
          )}

          {/* On-Demand Rows (Fixed order: Repeat, Goal, Waiting For, Habit, Depends On) */}

          {/* Repeat Row */}
          {visibleFields.has('repeat') && (
            <div
              className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
              onClick={() => setIsRecurrencePickerOpen(true)}
              role="button"
              tabIndex={0}
              aria-label="Repeat"
            >
              <div className={styles.propertyLabel}>
                <RepeatIconSvg />
                <span>Repeat</span>
              </div>
              <div className={styles.propertyValue}>
                {currentTask.recurrence_rule ? (
                  <span>{humanReadableRRule(currentTask.recurrence_rule)}</span>
                ) : (
                  <span className={styles.valueEmpty}>Does not repeat</span>
                )}
              </div>
            </div>
          )}

          {/* Goal Row */}
          {visibleFields.has('goal') && (
            <RadixPopover.Root open={isGoalPopoverOpen} onOpenChange={setIsGoalPopoverOpen}>
              <RadixPopover.Trigger asChild>
                <div
                  className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Goal"
                >
                  <div className={styles.propertyLabel}>
                    <TargetIconSvg />
                    <span>Goal</span>
                  </div>
                  <div className={styles.propertyValue}>
                    {linkedGoal ? (
                      <span>{linkedGoal.title}</span>
                    ) : (
                      <span className={styles.valueEmpty}>None (No Goal)</span>
                    )}
                  </div>
                </div>
              </RadixPopover.Trigger>
              <RadixPopover.Portal container={portalContainer}>
                <RadixPopover.Content
                  className={`${styles.glassContent} ${styles.goalDropdownContent}`}
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <div
                    className={styles.glassItem}
                    onClick={() => {
                      if (linkedGoal) unlinkTask(linkedGoal.id, currentTask.id);
                      setIsGoalPopoverOpen(false);
                    }}
                  >
                    <span>None (No Goal)</span>
                    {!linkedGoal && <span className={styles.glassItemCheck}>✓</span>}
                  </div>
                  {Object.values(goalsById)
                    .filter((g) => g.status !== 'archived' || g.id === linkedGoal?.id)
                    .map((g) => (
                      <div
                        key={g.id}
                        className={styles.glassItem}
                        onClick={() => {
                          if (linkedGoal) unlinkTask(linkedGoal.id, currentTask.id);
                          linkTask(g.id, currentTask.id);
                          setIsGoalPopoverOpen(false);
                        }}
                      >
                        <span className={styles.chipText}>
                          {g.title}
                          {g.category ? ` [${g.category}]` : ''}
                        </span>
                        {linkedGoal?.id === g.id && <span className={styles.glassItemCheck}>✓</span>}
                      </div>
                    ))}
                </RadixPopover.Content>
              </RadixPopover.Portal>
            </RadixPopover.Root>
          )}

          {/* Waiting For Row */}
          {visibleFields.has('waitingFor') && (
            <div
              className={`${styles.propertyRow} ${styles.propertyRowTrigger}`}
              onClick={async () => {
                if (currentTask.waiting_on) {
                  if (confirm(`Clear waiting status (${currentTask.waiting_on})?`)) {
                    await clearWaiting(currentTask.id);
                  }
                } else {
                  const person = prompt('Waiting on whom or what?');
                  if (person && person.trim()) {
                    await setWaiting({ taskId: currentTask.id, waitingOn: person.trim() });
                  }
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Waiting For"
            >
              <div className={styles.propertyLabel}>
                <HourglassIconSvg />
                <span>Waiting For</span>
              </div>
              <div className={styles.propertyValue}>
                {currentTask.waiting_on ? (
                  <span>
                    {currentTask.waiting_on}
                    {currentTask.follow_up_date && ` (Until ${currentTask.follow_up_date})`}
                  </span>
                ) : (
                  <span className={styles.valueEmpty}>Mark waiting</span>
                )}
              </div>
            </div>
          )}

          {/* Habit Row */}
          {visibleFields.has('habit') && (
            <div className={styles.propertyRow}>
              <div className={styles.propertyLabel}>
                <HabitIconSvg />
                <span>Habit</span>
              </div>
              <div className={styles.propertyValue}>
                <button
                  type="button"
                  className={`${styles.habitToggleBtn} ${
                    currentTask.is_habit === 1 ? styles.habitActive : ''
                  }`}
                  onClick={() =>
                    updateTask({
                      id: currentTask.id,
                      is_habit: currentTask.is_habit === 1 ? 0 : 1,
                    })
                  }
                  aria-label="Toggle habit"
                >
                  <span>{currentTask.is_habit === 1 ? 'Habit On' : 'Habit Off'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Depends On Row */}
          {visibleFields.has('dependsOn') && (
            <div className={styles.propertyRow}>
              <div className={styles.propertyLabel}>
                <LinkIconSvg />
                <span>Depends On</span>
              </div>
              <div className={styles.propertyValue}>
                <div className={styles.chipsContainer}>
                  {taskDependencies.map((depId) => {
                    const depTask = allTasks[depId];
                    return (
                      <span key={depId} className={`${styles.chip} ${styles.chipEnter}`}>
                        <span className={styles.chipText}>
                          {depTask ? depTask.title : `Task (${depId})`}
                        </span>
                        <button
                          type="button"
                          className={styles.chipRemoveBtn}
                          onClick={() => removeDependency(currentTask.id, depId)}
                          aria-label="Remove dependency"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}

                  {/* Prerequisite Task Adder */}
                  <select
                    className={`${styles.addChipBtn} ${styles.depSelect}`}
                    value={selectedDepId}
                    onChange={async (e) => {
                      const depId = e.target.value;
                      if (!depId) return;
                      try {
                        await addDependency(currentTask.id, depId);
                        setSelectedDepId('');
                      } catch (err) {
                        setDepError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                    aria-label="Add prerequisite task"
                  >
                    <option value="">+ Add Prerequisite...</option>
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
                  {depError && (
                    <span className={styles.depErrorText}>
                      {depError}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add Property Trigger (Hidden when all 6 fields are visible) */}
          {hiddenOptionalFields.length > 0 && (
            <RadixDropdownMenu.Root
              open={isAddPropertyMenuOpen}
              onOpenChange={setIsAddPropertyMenuOpen}
            >
              <RadixDropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className={styles.addPropertyRow}
                  aria-label="Add property"
                >
                  <PlusIconSvg className={styles.addPropertyIcon} />
                  <span>Add property</span>
                </button>
              </RadixDropdownMenu.Trigger>
              <RadixDropdownMenu.Portal container={portalContainer}>
                <RadixDropdownMenu.Content
                  className={styles.glassContent}
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {hiddenOptionalFields.map((field) => {
                    const labelMap: Record<OptionalField, { name: string; icon: React.ReactNode }> = {
                      repeat: { name: 'Repeat', icon: <RepeatIconSvg /> },
                      goal: { name: 'Goal', icon: <TargetIconSvg /> },
                      waitingFor: { name: 'Waiting For', icon: <HourglassIconSvg /> },
                      habit: { name: 'Habit', icon: <HabitIconSvg /> },
                      dependsOn: { name: 'Depends On', icon: <LinkIconSvg /> },
                      attachments: { name: 'Attachments', icon: <AttachmentIconSvg /> },
                    };
                    const item = labelMap[field];
                    return (
                      <RadixDropdownMenu.Item
                        key={field}
                        className={styles.glassItem}
                        onSelect={() => handleSelectOptionalField(field)}
                      >
                        {item.icon}
                        <span>{item.name}</span>
                      </RadixDropdownMenu.Item>
                    );
                  })}
                </RadixDropdownMenu.Content>
              </RadixDropdownMenu.Portal>
            </RadixDropdownMenu.Root>
          )}
        </div>

        {/* Block 3: Subtasks */}
        <div className={styles.block} style={{ '--i': 2 } as React.CSSProperties}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>SUBTASKS</span>
            {subtasks.length > 0 && (
              <span className={styles.subtasksCounter}>
                {subtasks.filter((s) => s.is_completed === 1).length} of {subtasks.length}
              </span>
            )}
          </div>

          <div className={styles.subtasksList}>
            {subtasks.map((sub) => (
              <div key={sub.id} className={styles.subtaskRow}>
                <div className={styles.subtaskCheckbox}>
                  <Checkbox
                    checked={sub.is_completed === 1}
                    onChange={() => toggleComplete(sub.id)}
                    ariaLabel="Toggle subtask completion"
                    shape="circle"
                    size={16}
                  />
                </div>
                <span
                  className={`${styles.subtaskTitle} ${
                    sub.is_completed === 1 ? styles.subtaskTitleDone : ''
                  }`}
                >
                  {capitalizeFirstLetter(sub.title)}
                </span>
                <button
                  type="button"
                  className={styles.subtaskDeleteBtn}
                  onClick={() => deleteTask(sub.id)}
                  aria-label="Delete subtask"
                >
                  <TrashIconSvg className={styles.subtaskDeleteIcon} />
                </button>
              </div>
            ))}

            <div className={styles.subtaskAddRow}>
              <span className={styles.subtaskAddIcon}>
                <PlusIconSvg className={styles.subtaskAddIcon} />
              </span>
              <input
                type="text"
                className={styles.subtaskAddInput}
                placeholder="Add subtask"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={handleAddSubtask}
              />
            </div>
          </div>
        </div>

        {/* Block 4: Notes (TipTap Editor) */}
        <div className={`${styles.notesBlock} ${styles.block}`} style={{ '--i': 3 } as React.CSSProperties}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>NOTES</span>
            <span className={styles.markdownHint}>Markdown enabled</span>
          </div>
          <div className={styles.notesEditorWrapper}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Block 5: Attachments (Only when present or added) */}
        {visibleFields.has('attachments') && (
          <div className={styles.block} style={{ '--i': 3 } as React.CSSProperties}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>ATTACHMENTS</span>
              <div className={styles.attachmentActions}>
                <button
                  type="button"
                  className={styles.attachmentActionBtn}
                  onClick={() => attachmentStripRef.current?.pickAndUpload()}
                >
                  Add file
                </button>
                <button
                  type="button"
                  className={styles.attachmentActionBtn}
                  onClick={() => attachmentStripRef.current?.openAddLink()}
                >
                  Add link
                </button>
              </div>
            </div>

            <AttachmentStrip
              ref={attachmentStripRef}
              taskId={currentTask.id}
              hideHeader
              hideEmptyDropTarget
              onAttachmentsChanged={(count) => setAttachmentsCount(count)}
            />
          </div>
        )}

        {/* Block 6: Footer with History & Delete */}
        <div className={`${styles.footer} ${styles.block}`} style={{ '--i': 4 } as React.CSSProperties}>
          {history.length > 0 ? (
            <button
              type="button"
              className={`${styles.historyTrigger} ${isHistoryOpen ? styles.historyExpanded : ''}`}
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              aria-expanded={isHistoryOpen}
            >
              <ChevronIconSvg className={styles.historyChevron} />
              <span>History ({history.length})</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            className={styles.deleteBtn}
            onClick={async () => {
              if (confirm('Delete this task?')) {
                await deleteTask(currentTask.id);
                onClose();
              }
            }}
          >
            Delete
          </button>
        </div>

        {/* History Expansion Content */}
        {history.length > 0 && isHistoryOpen && (
          <div className={styles.historyList}>
            {history.map((record) => {
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
                <div key={record.id} className={styles.historyItem}>
                  <div className={styles.historyItemHeader}>
                    <span className={styles.historyDate}>{dateStr}</span>
                    <button
                      type="button"
                      disabled={isRestoring}
                      className={styles.historyRestoreBtn}
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
                    <div key={field}>
                      <strong>{field}</strong>:{' '}
                      <span className={styles.historyOldVal}>{formatVal(diff.from)}</span>{' '}
                      &rarr; {formatVal(diff.to)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date Picker Popover */}
      {isDatePickerOpen && (
        <React.Suspense fallback={null}>
          <DatePicker
            initialDate={currentTask.due_date}
            initialTime={currentTask.due_time}
            initialAllDay={currentTask.all_day === 1}
            initialBucket={currentTask.bucket}
            position={datePickerPos}
            onSelect={(date, time, allDay) => {
              setDate({
                taskId: currentTask.id,
                dueDate: date,
                dueTime: time,
                allDay: allDay ?? false,
              });
              setIsDatePickerOpen(false);
            }}
            onSelectBucket={(bucket) => {
              setBucket(currentTask.id, bucket);
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
            useTaskStore.getState().completeTask(currentTask.id, { skipRecurrence: true });
          }}
        />
      )}
    </motion.aside>
  );
}

export default DetailPanel;
