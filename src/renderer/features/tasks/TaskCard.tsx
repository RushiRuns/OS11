import React, { memo, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { useSelectionStore } from '../../stores/selectionStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { TagPicker } from '../tags/TagPicker.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useAttachmentStore } from '../../stores/attachmentStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useGoalStore } from '../../stores/goalStore.js';
import { useSchedulerUiStore } from '../../stores/schedulerUiStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useListStore } from '../../stores/listStore.js';
import { useToday } from '../../hooks/useToday.js';
import { resolveContainerBadge, resolveSmartBadges } from './task-badges.js';
import { formatTimeRange } from '../lists/scheduler/useSchedulerLayout.js';
import { CardGlyph } from './card-glyphs.js';
import { formatDueLabel } from './due-label.js';
import type { Task } from '@shared/types/task.js';
import { capitalizeFirstLetter } from '@shared/utils/index.js';
import { useOptionalViewSearchContext } from '../search/ViewSearchContext.js';
import { HighlightMark } from '../search/HighlightMark.js';
import styles from './TaskCard.module.css';

export interface TaskCardProps {
  task: Task;
  depth?: number;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  subtaskCount?: { completed: number; total: number };
  onToggleExpand?: (taskId: string) => void;
  isSelected?: boolean;
  allTaskIds?: string[];
  onOpenDetail?: (task: Task) => void;
  onSelect?: (task: Task) => void;
  onToggleComplete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onUpdateTitle?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onFileDrop?: (taskId: string, files: FileList) => void;
  parentTitle?: string;
  disableDrag?: boolean;
  exiting?: boolean;
}

export function stripHtmlNotes(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDateTime(
  dueDate?: string | null,
  dueTime?: string | null,
  allDay?: number
): string | null {
  if (!dueDate && !dueTime) return null;

  let formattedDate: string | null = null;
  let timeStr: string | null = null;

  if (dueDate) {
    if (dueDate.includes('T')) {
      const [dPart, tPart] = dueDate.split('T');
      const parts = dPart.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[1]}/${parts[2]}/${parts[0]}`;
      } else {
        formattedDate = dPart;
      }
      if (!dueTime && tPart && allDay !== 1) {
        timeStr = tPart.slice(0, 5);
      }
    } else {
      const parts = dueDate.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[1]}/${parts[2]}/${parts[0]}`;
      } else {
        formattedDate = dueDate;
      }
    }
  }

  if (dueTime && allDay !== 1) {
    timeStr = dueTime;
  }

  let formattedTime: string | null = null;
  if (timeStr && allDay !== 1) {
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      formattedTime = `${hours}:${minutes} ${ampm}`;
    } else {
      formattedTime = timeStr;
    }
  }

  if (formattedDate && formattedTime) {
    return `${formattedDate}, ${formattedTime}`;
  }
  return formattedDate || formattedTime;
}

export const TaskCard = memo(function TaskCard({
  task,
  depth = 0,
  hasSubtasks = false,
  isExpanded = true,
  subtaskCount,
  onToggleExpand,
  isSelected = false,
  allTaskIds,
  onOpenDetail,
  onSelect,
  onToggleComplete,
  onToggleStar,
  onUpdateTitle,
  onContextMenu,
  onFileDrop,
  parentTitle,
  disableDrag = false,
  exiting = false,
}: TaskCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [fileOver, setFileOver] = useState(false);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const prevCompletedRef = useRef(task.is_completed);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (prevCompletedRef.current === 0 && task.is_completed === 1) {
      setJustDone(true);
      const timer = setTimeout(() => setJustDone(false), 220);
      return () => clearTimeout(timer);
    }
    prevCompletedRef.current = task.is_completed;
  }, [task.is_completed]);

  const searchCtx = useOptionalViewSearchContext();
  const isSearchFiltering = Boolean(searchCtx?.isFiltering);
  const isSearchCursor = Boolean(searchCtx?.cursorTaskId === task.id);
  const matchResult = searchCtx?.results.get(task.id);
  const isTitleMatch = matchResult?.isTitleMatch ?? false;
  const searchTokens = searchCtx?.tokens ?? [];

  useEffect(() => {
    if (isEditing && searchCtx?.pin) {
      searchCtx.pin(task.id);
      return () => {
        searchCtx.unpin(task.id);
      };
    }
  }, [isEditing, task.id, searchCtx]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [collapseStyle, setCollapseStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (exiting && cardRef.current) {
      const currentHeight = cardRef.current.offsetHeight;
      setCollapseStyle({
        height: `${currentHeight}px`,
        minHeight: '0px',
        overflow: 'hidden',
        transition: 'none',
      });
      // Force reflow so initial height is committed before transition begins
      void cardRef.current.offsetHeight;
      const rafId = requestAnimationFrame(() => {
        setCollapseStyle({
          height: '0px',
          minHeight: '0px',
          paddingTop: '0px',
          paddingBottom: '0px',
          marginTop: '0px',
          marginBottom: '-4px',
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none',
          transition:
            'height 280ms cubic-bezier(0.4, 0, 0.2, 1), min-height 280ms cubic-bezier(0.4, 0, 0.2, 1), padding 280ms cubic-bezier(0.4, 0, 0.2, 1), margin 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        });
      });
      return () => cancelAnimationFrame(rafId);
    } else {
      setCollapseStyle(null);
    }
  }, [exiting]);

  const { selectedIds, isMultiSelectActive, toggleSelect, selectRange } = useSelectionStore();
  const isMultiSelected = selectedIds.has(task.id);

  const taskTags = useTagStore(state => state.getTagsForTask(task.id));
  const loadTagsForTask = useTagStore(state => state.loadTagsForTask);
  const attachmentCount = useAttachmentStore(state => state.countsByTaskId[task.id] ?? 0);
  const linkedGoal = useGoalStore(state => state.getGoalForTask(task.id));

  const dueInfo = useMemo(() => {
    if (task.is_completed === 1) {
      const result = formatDueLabel(task.due_date, task.due_time, task.all_day);
      return result ? { ...result, isOverdue: false } : null;
    }
    return formatDueLabel(task.due_date, task.due_time, task.all_day);
  }, [task.due_date, task.due_time, task.all_day, task.is_completed]);

  const hookActiveListId = useAppStore(state => state.activeListId);
  const activeListId = typeof window === 'undefined' ? (useAppStore.getState().activeListId || hookActiveListId) : hookActiveListId;
  const isMyDayView = activeListId === 'smart_my_day';
  const today = useToday();

  const hookProject = useProjectStore(state => (task.project_id ? state.projectsById[task.project_id] : undefined));
  const project = typeof window === 'undefined'
    ? (task.project_id ? (useProjectStore.getState().projectsById[task.project_id] || hookProject) : undefined)
    : hookProject;

  const hookArea = useAreaStore(state => (task.area_id ? state.areasById[task.area_id] : undefined));
  const area = typeof window === 'undefined'
    ? (task.area_id ? (useAreaStore.getState().areasById[task.area_id] || hookArea) : undefined)
    : hookArea;

  const hookList = useListStore(state => (task.list_id ? state.listsById[task.list_id] : undefined));
  const list = typeof window === 'undefined'
    ? (task.list_id ? (useListStore.getState().listsById[task.list_id] || hookList) : undefined)
    : hookList;

  const containerBadge = useMemo(() => {
    return resolveContainerBadge({
      task,
      activeListId,
      project,
      area,
      list,
      depth,
    });
  }, [task, activeListId, project, area, list, depth]);

  const smartBadges = useMemo(() => {
    return resolveSmartBadges({
      task,
      activeListId,
      today,
    });
  }, [task, activeListId, today]);

  const hasScheduledTime =
    isMyDayView &&
    typeof task.scheduled_start_min === 'number' &&
    typeof task.scheduled_duration_min === 'number';

  const scheduledTimeRange = useMemo(() => {
    if (!hasScheduledTime) return null;
    return formatTimeRange(task.scheduled_start_min!, task.scheduled_duration_min!);
  }, [hasScheduledTime, task.scheduled_start_min, task.scheduled_duration_min]);

  const hoveredBlockId = useSchedulerUiStore(state => state.hoveredBlockId);
  const isHoveredFromBlock = hoveredBlockId === task.id;

  const handleTimeChipClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const slotActive = useTaskStore.getState().rightSlotActive;
    if (slotActive !== 'scheduler') {
      useTaskStore.getState().toggleRightSlotPeer('scheduler');
    }
    useSchedulerUiStore.getState().setSelectedBlockId(task.id);
    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${task.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('os11-timeblock-flash');
        setTimeout(() => el.classList.remove('os11-timeblock-flash'), 1200);
      }
    }, 150);
  };

  useEffect(() => {
    loadTagsForTask(task.id);
  }, [task.id, loadTagsForTask]);

  const effectiveDisableDrag = disableDrag || isSearchFiltering;
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: task.id,
    disabled: effectiveDisableDrag,
    data: {
      type: 'task-row',
      taskId: task.id,
      task,
      subtaskCount,
    },
  });

  // Keep a semi-transparent placeholder in place with exact layout dimensions
  // so TanStack Virtualizer does not suffer height shifts or re-measurement layout jumps.
  // The floating preview is handled by the root DragOverlay in App.tsx.
  const sortableStyle: React.CSSProperties = {
    opacity: isDragging ? 0.35 : 1,
    marginLeft: depth > 0 ? `${depth * 28 - 12}px` : undefined,
    width: depth > 0 ? `calc(100% - ${depth * 28 - 12}px)` : undefined,
  };

  const setCombinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      cardRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef]
  );

  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(
    (valueToCommit: string) => {
      setIsEditing(false);
      const trimmed = valueToCommit.trim();
      if (trimmed && trimmed !== task.title) {
        setEditTitle(trimmed);
        onUpdateTitle?.(task.id, trimmed);
      } else {
        setEditTitle(task.title);
      }
    },
    [task.id, task.title, onUpdateTitle]
  );

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditTitle(task.title);
  }, [task.title]);

  // Keep a ref to the latest editTitle and commitEdit for cleanup on unmount
  const editTitleRef = useRef(editTitle);
  editTitleRef.current = editTitle;
  const isEditingRef = useRef(isEditing);
  isEditingRef.current = isEditing;
  const commitEditRef = useRef(commitEdit);
  commitEditRef.current = commitEdit;

  // Unmount cleanup: if task card unmounts while editing, safely commit pending changes
  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        commitEditRef.current(editTitleRef.current);
      }
    };
  }, []);

  // When selection moves to another task, commit any ongoing edit
  const prevSelectedRef = useRef(isSelected);
  useEffect(() => {
    if (prevSelectedRef.current && !isSelected && isEditing) {
      commitEdit(editTitle);
    }
    prevSelectedRef.current = isSelected;
  }, [isSelected, isEditing, editTitle, commitEdit]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault();
      e.stopPropagation();
      setIsTagPickerOpen(true);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      commitEdit(editTitle);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditing && (isSelected || document.activeElement === cardRef.current)) {
      if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(true);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    if (e.shiftKey) {
      e.stopPropagation();
      selectRange(allTaskIds || [], task.id);
      return;
    }
    if (isMultiSelectActive) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    onSelect?.(task);
  };

  // Priority border class
  const getPriorityClass = (p: number) => {
    switch (p) {
      case 1:
        return styles.priority1;
      case 2:
        return styles.priority2;
      case 3:
        return styles.priority3;
      case 4:
        return `${styles.priority4} ${styles.priorityCriticalPulse}`;
      default:
        return '';
    }
  };

  const metadataSegments = useMemo(() => {
    const segments: React.ReactNode[] = [];

    // 1. Scheduled Time
    if (hasScheduledTime && scheduledTimeRange) {
      segments.push(
        <span
          key="scheduled-time"
          className={styles.scheduledTimeSegment}
          onClick={handleTimeChipClick}
          onMouseEnter={() => useSchedulerUiStore.getState().setHoveredBlockId(task.id)}
          onMouseLeave={() => useSchedulerUiStore.getState().setHoveredBlockId(null)}
          title="Click to view block in scheduler"
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTimeChipClick(e as any);
            }
          }}
        >
          <CardGlyph name="clock" className={styles.timeGlyph} />
          <span>{scheduledTimeRange}</span>
        </span>
      );
    }

    // 2. Due Date
    if (dueInfo) {
      segments.push(
        <span
          key="due-date"
          className={`${styles.metaDate} ${dueInfo.isOverdue ? styles.metaDateOverdue : ''}`}
          title={`Due: ${dueInfo.label}`}
        >
          {dueInfo.label}
        </span>
      );
    }

    // 3. Container Badge (plain text label, no emoji, max 180px with ellipsis)
    if (containerBadge) {
      segments.push(
        <span
          key="container-badge"
          className={styles.inlineContainerBadge}
          role="button"
          tabIndex={0}
          data-testid="container-badge"
          title={containerBadge.title}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            useAppStore.getState().setActiveListId(containerBadge.targetListId);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              useAppStore.getState().setActiveListId(containerBadge.targetListId);
            }
          }}
        >
          <span className={styles.inlineContainerBadgeLabel}>{containerBadge.label}</span>
        </span>
      );
    }

    // 4. Smart Status Badges (tinted status glyph + label)
    for (const smartBadge of smartBadges) {
      let glyphName: 'sun' | 'bolt' | 'box' | 'hourglass' = 'sun';
      if (smartBadge.badgeType === 'anytime') glyphName = 'bolt';
      else if (smartBadge.badgeType === 'someday') glyphName = 'box';
      else if (smartBadge.badgeType === 'waiting') glyphName = 'hourglass';

      segments.push(
        <span
          key={`smart-badge-${smartBadge.id}`}
          className={`${styles.inlineSmartBadge} ${styles[`inlineSmartBadge_${smartBadge.badgeType}`] || ''} ${smartBadge.isOverdue ? styles.inlineSmartBadgeOverdue : ''}`}
          role="button"
          tabIndex={0}
          data-testid="smart-status-badge"
          data-badge-id={smartBadge.id}
          title={smartBadge.title}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            useAppStore.getState().setActiveListId(smartBadge.targetListId);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              useAppStore.getState().setActiveListId(smartBadge.targetListId);
            }
          }}
        >
          <CardGlyph name={glyphName} className={styles.smartBadgeGlyph} />
          <span className={styles.inlineSmartBadgeLabel}>{smartBadge.label}</span>
        </span>
      );
    }

    // 5. Tags (first 2, then +N)
    if (taskTags.length > 0) {
      const visibleTags = taskTags.slice(0, 2);
      const remainingCount = taskTags.length - 2;

      segments.push(
        <span key="tags" className={styles.tagsGroup}>
          {visibleTags.map(tag => (
            <span
              key={tag.id}
              className={styles.inlineTagPill}
              role="button"
              tabIndex={0}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                useAppStore.getState().setActiveListId(`tag:${tag.id}`);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  useAppStore.getState().setActiveListId(`tag:${tag.id}`);
                }
              }}
              title={`Tag: #${tag.name}`}
            >
              #{tag.name}
            </span>
          ))}
          {remainingCount > 0 && (
            <span
              className={styles.inlineTagMore}
              title={taskTags.slice(2).map(t => `#${t.name}`).join(', ')}
            >
              +{remainingCount}
            </span>
          )}
        </span>
      );
    }

    // 6. Glyphs Group: Goal, Repeat, Clip
    const trailingGlyphs: React.ReactNode[] = [];
    if (linkedGoal) {
      trailingGlyphs.push(
        <span
          key="goal-glyph"
          className={styles.metaGlyphBtn}
          role="button"
          tabIndex={0}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            useAppStore.getState().setActiveListId('view_goals');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              useAppStore.getState().setActiveListId('view_goals');
            }
          }}
          title={`Goal: ${linkedGoal.title}`}
          aria-label={`Goal: ${linkedGoal.title}`}
        >
          <CardGlyph name="goal" />
        </span>
      );
    }

    if (task.recurrence_rule) {
      trailingGlyphs.push(
        <span
          key="repeat-glyph"
          className={styles.metaGlyph}
          title={`Repeats: ${task.recurrence_rule}`}
          aria-label={`Repeats: ${task.recurrence_rule}`}
        >
          <CardGlyph name="repeat" />
        </span>
      );
    }

    if (attachmentCount > 0) {
      trailingGlyphs.push(
        <span
          key="clip-glyph"
          className={styles.metaGlyph}
          title={`${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}
          aria-label={`${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}
        >
          <CardGlyph name="clip" />
        </span>
      );
    }

    if (trailingGlyphs.length > 0) {
      segments.push(
        <span key="trailing-glyphs" className={styles.metaGlyphsGroup}>
          {trailingGlyphs}
        </span>
      );
    }

    return segments;
  }, [
    hasScheduledTime,
    scheduledTimeRange,
    handleTimeChipClick,
    task.id,
    task.recurrence_rule,
    dueInfo,
    containerBadge,
    smartBadges,
    taskTags,
    linkedGoal,
    attachmentCount,
  ]);

  return (
    <div
      ref={setCombinedRef}
      style={{ ...sortableStyle, ...collapseStyle }}
      {...attributes}
      {...listeners}
      // NOTE: Task reordering + "drop onto a card to nest as a subtask" is handled
      // ENTIRELY by @dnd-kit (via the {...attributes}/{...listeners} above, plus
      // handleDragOver/handleDragEnd in TaskList.tsx). This card is intentionally
      // NOT natively `draggable` and no longer starts a native HTML5 drag for
      // task-to-task moves - that used to run *in parallel* with dnd-kit's pointer
      // based drag and the two systems fought over the same pointerdown, which is
      // why nesting felt broken/inconsistent. The native onDragOver/onDrop below
      // are kept ONLY for dropping real OS files (e.g. from Finder/Explorer) onto
      // a card to attach them - that is a different feature and still needs them.
      className={`${styles.taskCard} ${depth > 0 ? styles.subtaskRow : ''} ${getPriorityClass(task.priority)} ${
        isSelected ? styles.taskCardSelected : ''
      } ${isHoveredFromBlock ? styles.rowHighlightedFromBlock : ''} ${
        isSearchCursor ? styles.searchCursorRow : ''
      }`}
      aria-current={isSearchCursor ? 'true' : undefined}
      data-multiselect={isMultiSelectActive || isMultiSelected ? 'active' : 'inactive'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-filedrop={fileOver ? 'true' : 'false'}
      data-completed={task.is_completed === 1 ? 'true' : undefined}
      data-just-done={justDone ? 'true' : undefined}
      data-exiting={exiting ? 'true' : undefined}
      onClick={handleClick}
      onMouseEnter={() => {
        if (hasScheduledTime) useSchedulerUiStore.getState().setHoveredBlockId(task.id);
      }}
      onMouseLeave={() => {
        if (hasScheduledTime) useSchedulerUiStore.getState().setHoveredBlockId(null);
      }}
      onContextMenu={e => {
        e.preventDefault();
        onContextMenu?.(e, task);
      }}
      onDragOver={e => {
        // Only react to real OS file drags here. Internal task-card drags are
        // handled by dnd-kit and must never be intercepted by this handler.
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={async e => {
        setFileOver(false);
        // Only real OS files are handled here now. Task-to-task nesting is
        // handled by dnd-kit's onDragEnd in TaskList.tsx, not here.
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (onFileDrop) {
            onFileDrop(task.id, e.dataTransfer.files);
          } else {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
              const filePath = (e.dataTransfer.files[i] as unknown as { path?: string }).path;
              if (filePath) {
                try {
                  await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, {
                    taskId: task.id,
                    sourcePath: filePath,
                  });
                } catch {
                  // ignore
                }
              }
            }
            useAttachmentStore.getState().incrementCount(task.id, e.dataTransfer.files.length);
          }
        }
      }}
      tabIndex={0}
      role="row"
      aria-selected={isSelected || isMultiSelected}
      onKeyDown={handleCardKeyDown}
    >
      {/* Multi-Select Checkbox (only rendered when multi-select is active) */}
      {(isMultiSelectActive || isMultiSelected) && (
        <div
          className={styles.multiSelectCheckboxWrap}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (e.shiftKey) {
              selectRange(allTaskIds || [], task.id);
            } else {
              toggleSelect(task.id);
            }
          }}
        >
          <input
            type="checkbox"
            className={styles.multiSelectInput}
            checked={isMultiSelected}
            onChange={() => {}}
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Subtask Chevron Toggle (Positioned in left gutter; reveals on hover without shifting card) */}
      {hasSubtasks && (
        <button
          type="button"
          className={`${styles.subtaskChevronBtn} ${isExpanded ? styles.subtaskChevronExpanded : ''}`}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onToggleExpand?.(task.id);
          }}
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <span className={styles.subtaskChevron}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      )}

      {/* Checkbox */}
      <div
        className={styles.checkboxWrap}
        onPointerDown={e => e.stopPropagation()}
      >
        <Checkbox
          checked={task.is_completed === 1}
          onChange={() => onToggleComplete?.(task.id)}
          ariaLabel={`Mark "${task.title}" as ${task.is_completed === 1 ? 'incomplete' : 'complete'}`}
          shape="circle"
          size={depth > 0 ? 16 : 18}
        />
      </div>

      {/* Standard View: Multi-Layer Apple Reminders Layout */}
      <div className={styles.contentColumn}>
        {/* Optional parent task meta line for dated subtasks */}
        {parentTitle && (
          <div className={styles.parentMetaLine} title={`Subtask of ${parentTitle}`}>
            <span className={styles.parentMetaIcon}>↳</span>
            <span className={styles.parentMetaText}>{parentTitle}</span>
          </div>
        )}

        {/* Row 1: Title */}
        <div className={styles.titleArea}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className={styles.titleInput}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => commitEdit(editTitle)}
              onKeyDown={handleInputKeyDown}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              aria-label={`Edit title for ${task.title}`}
            />
          ) : (
            <span
              className={`${styles.titleText} ${
                task.is_completed === 1 ? styles.completedTitle : ''
              }`}
              onDoubleClick={e => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title={capitalizeFirstLetter(task.title)}
            >
              {isSearchFiltering && isTitleMatch && searchTokens.length > 0 ? (
                <HighlightMark
                  text={capitalizeFirstLetter(task.title)}
                  tokens={searchTokens}
                />
              ) : (
                capitalizeFirstLetter(task.title)
              )}
            </span>
          )}
        </div>

        {/* Row 2: Notes (if present) - clean snippet */}
        {(() => {
          const cleanNotes = stripHtmlNotes(task.notes);
          if (!cleanNotes) return null;
          return (
            <div className={styles.notesRow} title={cleanNotes}>
              <span className={styles.notesText}>{cleanNotes}</span>
            </div>
          );
        })()}

        {/* Row 3: Unified Metadata Row: [Container] · [Smart Status] · [Scheduled Time] · [Due Date] · [Tags] · [Subtask Progress] */}
        {metadataSegments.length > 0 && (
          <div className={styles.metadataRow}>
            {metadataSegments.map((segment, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <span className={styles.metaDot} aria-hidden="true">
                    ·
                  </span>
                )}
                {segment}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Right Edge Controls: Subtask Count, Star Button, Details Button */}
      <div
        className={styles.rightControls}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {hasSubtasks && subtaskCount && subtaskCount.total > 0 && (
          <div
            className={`${styles.subtaskCountBadge} ${
              !isExpanded ? styles.subtaskCountCollapsed : ''
            }`}
            title={`${subtaskCount.completed} of ${subtaskCount.total} subtasks completed`}
            onClick={e => {
              e.stopPropagation();
              onToggleExpand?.(task.id);
            }}
          >
            <CardGlyph name="subtasks" className={styles.subtaskCountIcon} />
            <span>
              {subtaskCount.completed}/{subtaskCount.total}
            </span>
          </div>
        )}

        <button
          type="button"
          className={`${styles.rightControlBtn} ${
            task.is_starred === 1 ? styles.starBtnActive : styles.starBtnInactive
          }`}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onToggleStar?.(task.id);
          }}
          title={task.is_starred === 1 ? 'Unstar task' : 'Star task'}
          aria-label={task.is_starred === 1 ? 'Unstar task' : 'Star task'}
        >
          <CardGlyph name={task.is_starred === 1 ? 'star' : 'starOutline'} />
        </button>

        <button
          type="button"
          className={styles.rightControlBtn}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onOpenDetail?.(task);
          }}
          title="Open task details"
          aria-label="Open task details"
        >
          <CardGlyph name="details" />
        </button>
      </div>

      {isTagPickerOpen && (
        <TagPicker
          taskId={task.id}
          selectedTagIds={taskTags.map(t => t.id)}
          onClose={() => setIsTagPickerOpen(false)}
        />
      )}
    </div>
  );
});

export default TaskCard;
