import React, { useState, useRef, useEffect, useDeferredValue, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useDndMonitor,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { between } from '@shared/utils/fractional-index.js';
import {
  useTaskStore,
  useCompletedTasks,
} from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useSelectionStore } from '../../stores/selectionStore.js';
import { TaskCard } from './TaskCard.js';
import { TaskListHeader } from './TaskListHeader.js';
import { TaskContextMenu, type TaskContextMenuPosition } from './TaskContextMenu.js';
import { BulkActionBar } from './BulkActionBar.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
import { SearchView } from '../search/SearchView.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { Toast } from '../../components/Toast/Toast.js';
import { useFilteredTasks, DEFAULT_FILTER_CONFIG } from '../../hooks/useFilteredTasks.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { useVimMode } from '../../hooks/useVimMode.js';
import type { Task } from '@shared/types/task.js';
import styles from './TaskList.module.css';

export interface TaskListProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
  isMyDayList?: boolean;
  isSuggestionsOpen?: boolean;
  onToggleSuggestions?: () => void;
  isSchedulerOpen?: boolean;
  onToggleScheduler?: () => void;
  suggestionsCount?: number;
}

export interface FlattenedTaskItem {
  task: Task;
  depth: number;
  hasSubtasks: boolean;
  isExpanded: boolean;
  subtaskCount: { completed: number; total: number };
}

// --- Drag-and-drop geometry ---------------------------------------------------
// Pixels of horizontal drag that equal one indent level. Matches the 28px per-depth indent
// TaskCard already uses, so the drop line lines up with where a card at that depth would sit.
const INDENT_PX = 28;
// How far in from the list's left edge a depth-0 drop line starts (past chevron + checkbox).
// Nudge this one number if the line looks offset from your cards.
const INDENT_LINE_BASE_PADDING = 40;
// Keep in sync with the virtualizer gap in createTaskListVirtualizerOptions.
const ROW_GAP_PX = 8;

export interface DropPlan {
  parentId: string | null;
  prevSiblingId: string | null;
  nextSiblingId: string | null;
  depth: number;
  lineTop: number; // viewport-relative Y of the insertion point
  isNoop: boolean; // dropping here would leave the task exactly where it already is
}

export function isExternalDropTarget(id: string): boolean {
  return (
    id === 'scheduler-grid' ||
    id === 'my-day-list-drop-zone' ||
    id.startsWith('list:') ||
    id.startsWith('project:') ||
    id.startsWith('area:') ||
    id.startsWith('tag:')
  );
}

interface PlanDropArgs {
  items: Array<Pick<FlattenedTaskItem, 'task' | 'depth'>>; // rows exactly as rendered
  activeId: string;
  overId: string;
  deltaX: number; // total horizontal pointer travel since the drag started
  activeRect: { top: number; height: number } | null;
  overRect: { top: number; height: number };
  indentPx: number;
  rowGapPx: number;
}

/**
 * Pure drop planning (no React, no store) so it can be unit tested.
 *
 * Depth rule (same model as dnd-kit's sortable-tree and Todoist): the dragged row STARTS at
 * its current depth and horizontal travel adds or removes levels, clamped to what the
 * insertion gap allows:
 *   maxDepth = (row above the gap).depth + 1   -> can become that row's child
 *   minDepth = (row below the gap).depth       -> cannot steal the row below from its parent
 * So a plain vertical drag is a reorder. Dragging right nests, dragging left outdents, and
 * both work in place (pointer still over the dragged row's own slot).
 *
 * The dragged row and its visible subtree move as one unit, so none of them can be the anchor
 * or the new parent (that would create a cycle).
 *
 * Subtasks whose parent is not in the current list (My Day, Important, ...) are rendered as
 * depth-0 rows. They are treated as roots here, so reordering them never detaches their real
 * parent.
 */
export function planDrop({
  items,
  activeId,
  overId,
  deltaX,
  activeRect,
  overRect,
  indentPx,
  rowGapPx,
}: PlanDropArgs): DropPlan | null {
  const activeIndex = items.findIndex((i) => i.task.id === activeId);
  const overIndex = items.findIndex((i) => i.task.id === overId);
  if (activeIndex === -1 || overIndex === -1) return null;
  const activeItem = items[activeIndex];

  let subtreeEnd = activeIndex + 1;
  while (subtreeEnd < items.length && items[subtreeEnd].depth > activeItem.depth) subtreeEnd++;

  // Hovering inside the dragged row's own subtree: nothing sensible to drop onto.
  if (overIndex > activeIndex && overIndex < subtreeEnd) return null;

  const visible = [...items.slice(0, activeIndex), ...items.slice(subtreeEnd)];
  const byId = new Map(items.map((i) => [i.task.id, i]));
  const displayParentId = (t: PlanDropArgs['items'][number]['task']): string | null =>
    t.parent_task_id && byId.has(t.parent_task_id) ? t.parent_task_id : null;

  let gapIndex: number;
  let lineTop: number;
  if (overId === activeId) {
    // Pointer still over the dragged row's own slot: the gap is where it already sits.
    gapIndex = activeIndex;
    lineTop = overRect.top - rowGapPx / 2;
  } else {
    const overVisible =
      overIndex < activeIndex ? overIndex : overIndex - (subtreeEnd - activeIndex);
    const activeCenterY = activeRect
      ? activeRect.top + activeRect.height / 2
      : overRect.top + overRect.height / 2;
    const insertBefore = activeCenterY < overRect.top + overRect.height / 2;
    gapIndex = insertBefore ? overVisible : overVisible + 1;
    lineTop = insertBefore
      ? overRect.top - rowGapPx / 2
      : overRect.top + overRect.height + rowGapPx / 2;
  }

  const prev = gapIndex > 0 ? visible[gapIndex - 1] : null;
  const next = gapIndex < visible.length ? visible[gapIndex] : null;
  const maxDepth = prev ? prev.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const projected = activeItem.depth + Math.round(deltaX / indentPx);
  const depth = Math.min(maxDepth, Math.max(minDepth, projected));

  // New parent = the ancestor of the row above the gap that sits at (depth - 1).
  let parentId: string | null = null;
  if (depth > 0 && prev) {
    let cursor: (typeof items)[number] | undefined = prev;
    while (cursor && cursor.depth > depth - 1) {
      const pid = displayParentId(cursor.task);
      cursor = pid ? byId.get(pid) : undefined;
    }
    parentId = cursor ? cursor.task.id : null;
  }

  // Nearest siblings under that parent, scanning outward from the gap. A sibling's own
  // nested rows are skipped automatically because their parent differs.
  const findSiblings = (gap: number, parent: string | null) => {
    let prevId: string | null = null;
    for (let i = gap - 1; i >= 0; i--) {
      if (displayParentId(visible[i].task) === parent) {
        prevId = visible[i].task.id;
        break;
      }
    }
    let nextId: string | null = null;
    for (let i = gap; i < visible.length; i++) {
      if (displayParentId(visible[i].task) === parent) {
        nextId = visible[i].task.id;
        break;
      }
    }
    return { prevId, nextId };
  };

  const { prevId, nextId } = findSiblings(gapIndex, parentId);
  const currentParent = displayParentId(activeItem.task);
  const current = findSiblings(activeIndex, currentParent);
  const isNoop =
    parentId === currentParent && prevId === current.prevId && nextId === current.nextId;

  return { parentId, prevSiblingId: prevId, nextSiblingId: nextId, depth, lineTop, isNoop };
}

export function computeTaskItemEstimate(item?: {
  task?: { notes?: string | null };
  hasSubtasks?: boolean;
}): number {
  if (!item) return 44;
  let height = 44; // base single-line title comfortable height
  if (item.task?.notes) {
    height += 20; // notes row
  }
  if (item.hasSubtasks) {
    height += 18; // subtask count badge / chevron row
  }
  return height;
}

export function createTaskListVirtualizerOptions<TElement extends Element>(
  items: Array<{ task: { id: string; notes?: string | null }; hasSubtasks?: boolean }>,
  getScrollElement: () => TElement | null
) {
  return {
    count: items.length,
    getScrollElement,
    getItemKey: (index: number) => items[index]?.task.id ?? index,
    estimateSize: (index: number) => computeTaskItemEstimate(items[index]),
    gap: ROW_GAP_PX,
    overscan: 10,
  };
}

export function TaskList({
  onSelectTask,
  selectedTaskId,
  isMyDayList: propIsMyDayList,
  isSuggestionsOpen,
  onToggleSuggestions,
  isSchedulerOpen,
  onToggleScheduler,
  suggestionsCount: propSuggestionsCount,
}: TaskListProps): React.ReactElement {
  const { activeListId } = useAppStore();
  const {
    loadTasks,
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    restoreTask,
    duplicateTask,
    makeSubtask,
    moveTask,
  } = useTaskStore();

  const { selectAll } = useSelectionStore();
  const { pushAction, undo, lastToastAction, clearToast } = useUndoRedo();
  const [filterConfig, setFilterConfig] = useState(DEFAULT_FILTER_CONFIG);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  // --- Drag-and-drop nesting state -----------------------------------------
  // Outliner-style DnD (Todoist/Workflowy pattern): the row you're hovering
  // determines WHERE in the list you'd land (draggingTaskId + dropIndicator.top),
  // and how far LEFT you drag horizontally determines how shallow the nesting
  // is (dropIndicator.depth). Dropping with no horizontal movement nests as a
  // child of whatever row is directly above the insertion point - dragging
  // left "outdents" it back out, one level per INDENT_PX pixels.
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    top: number;
    left: number;
    width: number;
    depth: number;
  } | null>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const isMyDay = propIsMyDayList ?? (activeListId === 'smart_my_day');
  const [isTimeBlockDragging, setIsTimeBlockDragging] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const { setNodeRef: setMyDayListDropRef, isOver: isOverMyDayList } = useDroppable({
    id: 'my-day-list-drop-zone',
    data: { type: 'my-day-list' },
    disabled: !isMyDay || !isTimeBlockDragging,
  });

  const setCombinedListRef = useCallback(
    (node: HTMLDivElement | null) => {
      (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setMyDayListDropRef(node);
    },
    [setMyDayListDropRef]
  );

  const tasksById = useTaskStore((state) => state.tasksById);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const toggleParentExpand = useCallback((parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, activeListId]);

  // Derive active tasks based on current smart list or user list
  const activeTasks = useTaskStore(
    useCallback(
      (state) => {
        const tasks = Object.values(state.tasksById).filter((t) => t.is_trashed === 0);
        const today = new Date().toISOString().split('T')[0];
        switch (activeListId) {
          case 'smart_my_day':
            return tasks
              .filter((t) => t.my_day_date === today)
              .sort((a, b) => a.sort_order - b.sort_order);
          case 'smart_important':
            return tasks
              .filter((t) => t.is_starred === 1)
              .sort((a, b) => a.sort_order - b.sort_order);
          case 'smart_planned':
            return tasks
              .filter((t) => t.due_date !== null)
              .sort((a, b) => {
                if (a.due_date && b.due_date) {
                  return a.due_date.localeCompare(b.due_date);
                }
                return a.sort_order - b.sort_order;
              });
          case 'smart_all':
          case 'smart_all_tasks':
            return tasks
              .sort((a, b) => a.sort_order - b.sort_order);
          case 'smart_completed':
            return tasks
              .filter((t) => t.is_completed === 1)
              .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
          default:
            if (activeListId.startsWith('project:')) {
              const projId = activeListId.slice(8);
              return tasks
                .filter((t) => t.project_id === projId)
                .sort((a, b) => a.sort_order - b.sort_order);
            }
            if (activeListId.startsWith('area:')) {
              const areaId = activeListId.slice(5);
              return tasks
                .filter((t) => t.area_id === areaId && !t.project_id)
                .sort((a, b) => a.sort_order - b.sort_order);
            }
            if (activeListId === 'list_inbox') {
              return tasks
                .filter(
                  (t) =>
                    !t.area_id &&
                    !t.project_id &&
                    !t.my_day_date &&
                    !t.due_date &&
                    !t.bucket &&
                    !t.waiting_since &&
                    !t.waiting_on
                )
                .sort((a, b) => a.sort_order - b.sort_order);
            }
            return tasks
              .filter((t) => t.list_id === activeListId || t.project_id === activeListId)
              .sort((a, b) => a.sort_order - b.sort_order);
        }
      },
      [activeListId]
    )
  );

  const completedTasks = useCompletedTasks(activeListId);

  // Filter & Sort (deferred value avoids blocking user inputs)
  const deferredConfig = useDeferredValue(filterConfig);
  // Memoised: an inline .filter() hands useFilteredTasks a new array every render, which
  // re-flattens the tree and re-keys the virtualizer on every drag-indicator update.
  const incompleteActive = useMemo(
    () => activeTasks.filter((t) => t.is_completed === 0),
    [activeTasks]
  );
  const filteredIncomplete = useFilteredTasks(incompleteActive, deferredConfig);

  // Hierarchical tree flattening with indentation depth and collapse state
  const flattenedIncomplete = useMemo(() => {
    const activeTasksMap = new Map<string, Task>();
    for (const t of filteredIncomplete) {
      activeTasksMap.set(t.id, t);
    }

    const childrenByParentId = new Map<string, Task[]>();
    for (const t of filteredIncomplete) {
      if (t.parent_task_id) {
        const list = childrenByParentId.get(t.parent_task_id) || [];
        list.push(t);
        childrenByParentId.set(t.parent_task_id, list);
      }
    }

    const subtaskStats = new Map<string, { completed: number; total: number }>();
    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 0 && t.parent_task_id) {
        const stats = subtaskStats.get(t.parent_task_id) || { completed: 0, total: 0 };
        stats.total += 1;
        if (t.is_completed === 1) stats.completed += 1;
        subtaskStats.set(t.parent_task_id, stats);
      }
    }

    const rootTasks = filteredIncomplete.filter(
      (t) => !t.parent_task_id || !activeTasksMap.has(t.parent_task_id)
    );

    const result: FlattenedTaskItem[] = [];

    const appendTree = (task: Task, depth: number) => {
      const stats = subtaskStats.get(task.id) || { completed: 0, total: 0 };
      const hasSubtasks = stats.total > 0;
      const isExpanded = !collapsedParentIds.has(task.id);

      result.push({
        task,
        depth,
        hasSubtasks,
        isExpanded,
        subtaskCount: stats,
      });

      if (hasSubtasks && isExpanded) {
        const children = childrenByParentId.get(task.id) || [];
        for (const child of children) {
          appendTree(child, depth + 1);
        }
      }
    };

    for (const root of rootTasks) {
      appendTree(root, 0);
    }

    return result;
  }, [filteredIncomplete, tasksById, collapsedParentIds]);

  const allTaskIds = useMemo(
    () => flattenedIncomplete.map((item) => item.task.id),
    [flattenedIncomplete]
  );

  // TanStack Virtualizer with dynamic measurement, getItemKey by task.id, and uniform 8px gap
  const virtualizer = useVirtualizer(
    useMemo(
      () => createTaskListVirtualizerOptions(flattenedIncomplete, () => parentRef.current),
      [flattenedIncomplete]
    )
  );

  // Task deletion with Undo Toast
  const handleDeleteTask = useCallback(
    async (id: string) => {
      const target = activeTasks.find((t) => t.id === id);
      if (!target) return;

      await deleteTask(id);

      pushAction({
        description: `Task "${target.title}" moved to trash`,
        undoFn: async () => {
          await restoreTask(target.id);
        },
        redoFn: async () => {
          await deleteTask(target.id);
        },
      });
    },
    [activeTasks, deleteTask, pushAction, restoreTask]
  );

  // Ctrl+A select all visible tasks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll(allTaskIds);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allTaskIds, selectAll]);

  // Vim mode navigation (gated by vim_keybindings module toggle)
  useVimMode({
    tasks: filteredIncomplete,
    selectedTaskId: selectedTaskId ?? null,
    onSelectTask,
    onDeleteTask: handleDeleteTask,
    onToggleComplete: toggleComplete,
    onToggleStar: toggleStar,
    onOpenQuickAdd: () => {
      const input = document.querySelector('input[aria-label="Quick add task"]') as HTMLInputElement;
      input?.focus();
    },
  });

  // Feature Spec §5.2 standard keyboard shortcuts
  useKeyboardShortcuts({
    activeTasks: filteredIncomplete,
    selectedTaskId: selectedTaskId ?? null,
    onSelectTask,
    onDeleteTask: handleDeleteTask,
  });

  // --- Outliner-style drop planning ----------------------------------------
  // The geometry lives in planDrop() at the top of this file (pure, unit-testable).
  const computeDropPlan = useCallback(
    (
      activeId: string,
      overId: string,
      deltaX: number,
      activeRect: { top: number; height: number } | null,
      overRect: { top: number; height: number }
    ): DropPlan | null =>
      planDrop({
        items: flattenedIncomplete,
        activeId,
        overId,
        deltaX,
        activeRect,
        overRect,
        indentPx: INDENT_PX,
        rowGapPx: ROW_GAP_PX,
      }),
    [flattenedIncomplete]
  );

  const clearDragState = () => {
    setIsTimeBlockDragging(false);
    setDraggingTaskId(null);
    setDropIndicator(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data?.current?.type === 'time-block') {
      setIsTimeBlockDragging(true);
      return;
    }
    setIsTimeBlockDragging(false);
    setDraggingTaskId(String(event.active.id));
  };

  // onDragMove, NOT onDragOver. dnd-kit only fires onDragOver when the hovered row CHANGES, so
  // horizontal travel (indent / outdent) and crossing a row's midpoint never reached it and the
  // drop line sat frozen while the drop itself used different numbers.
  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over, delta } = event;
    if (
      !over ||
      active.data?.current?.type === 'time-block' ||
      isExternalDropTarget(String(over.id))
    ) {
      setDropIndicator(null);
      return;
    }

    const plan = computeDropPlan(
      String(active.id),
      String(over.id),
      delta.x,
      active.rect.current.translated ?? active.rect.current.initial ?? null,
      over.rect
    );
    const containerRect = parentRef.current?.getBoundingClientRect();
    // No line when the drop would change nothing: nothing flashes at the start of a drag.
    if (!plan || plan.isNoop || !containerRect) {
      setDropIndicator(null);
      return;
    }

    const left = containerRect.left + INDENT_LINE_BASE_PADDING + plan.depth * INDENT_PX;
    const nextIndicator = {
      top: plan.lineTop,
      left,
      width: Math.max(40, containerRect.right - left - 16),
      depth: plan.depth,
    };
    // Same slot as the previous frame: return the old object so React skips the re-render.
    setDropIndicator((prev) =>
      prev &&
      prev.top === nextIndicator.top &&
      prev.left === nextIndicator.left &&
      prev.width === nextIndicator.width
        ? prev
        : nextIndicator
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    clearDragState();

    if (!over || active.data?.current?.type === 'time-block') return;
    const overIdStr = String(over.id);
    if (isExternalDropTarget(overIdStr)) return; // handled by App.tsx

    const activeId = String(active.id);
    const activeTask = tasksById[activeId];
    if (!activeTask || activeTask.is_completed === 1) return;

    const plan = computeDropPlan(
      activeId,
      overIdStr,
      delta.x,
      active.rect.current.translated ?? active.rect.current.initial ?? null,
      over.rect
    );
    if (!plan || plan.isNoop) return;

    // Compare against the parent that is actually DISPLAYED. A subtask whose real parent is
    // not in this list shows as a root, and reordering it must not promote (detach) it.
    const prevParentId = activeTask.parent_task_id ?? null;
    const displayedParentId =
      prevParentId && allTaskIds.includes(prevParentId) ? prevParentId : null;
    const parentChanged = plan.parentId !== displayedParentId;

    const prevSibling = plan.prevSiblingId ? tasksById[plan.prevSiblingId] : null;
    const nextSibling = plan.nextSiblingId ? tasksById[plan.nextSiblingId] : null;
    const newSortOrder = between(prevSibling?.sort_order ?? null, nextSibling?.sort_order ?? null);

    const prevSortOrder = activeTask.sort_order;
    const nextParentId = parentChanged ? plan.parentId : undefined; // undefined = leave parent alone

    // One store write for parent + position, so the row jumps once instead of hopping twice.
    // Errors roll back inside the store and propagate; nothing is swallowed here.
    await moveTask(activeId, { parentId: nextParentId, sortOrder: newSortOrder });

    pushAction({
      description: `Moved "${activeTask.title}"`,
      undoFn: async () => {
        await moveTask(activeId, {
          parentId: parentChanged ? prevParentId : undefined,
          sortOrder: prevSortOrder,
        });
      },
      redoFn: async () => {
        await moveTask(activeId, { parentId: nextParentId, sortOrder: newSortOrder });
      },
    });
  };

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: clearDragState,
  });

  const headerTitle = (() => {
    switch (activeListId) {
      case 'list_inbox':
      case 'smart_inbox':
        return 'Inbox';
      case 'smart_my_day':
        return 'My Day';
      case 'smart_important':
        return 'Important';
      case 'smart_planned':
        return 'Planned';
      case 'smart_all':
      case 'smart_all_tasks':
        return 'All Tasks';
      case 'smart_completed':
        return 'Completed';
      default:
        if (activeListId.startsWith('project:')) {
          const proj = useProjectStore.getState().projectsById[activeListId.slice(8)];
          return proj?.name ?? 'Project';
        }
        if (activeListId.startsWith('area:')) {
          const area = useAreaStore.getState().areasById[activeListId.slice(5)];
          return area ? `${area.name} — Tasks` : 'Area Tasks';
        }
        return 'Tasks';
    }
  })();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const calculatedSuggestionsCount = useMemo(() => {
    if (!isMyDay) return 0;
    if (propSuggestionsCount !== undefined) return propSuggestionsCount;
    return Object.values(tasksById).filter((t) => {
      if (t.is_trashed === 1 || t.is_completed === 1) return false;
      if (t.my_day_date === todayStr) return false;
      const isDueTodayOrOverdue = t.due_date && t.due_date <= todayStr;
      const isHighPriority = t.priority >= 2;
      return isDueTodayOrOverdue || isHighPriority;
    }).length;
  }, [isMyDay, propSuggestionsCount, tasksById, todayStr]);

  return (
    <div className={styles.taskListContainer} data-dragging={Boolean(draggingTaskId)}>
      {/* Header with Search/Filter bar */}
      <TaskListHeader
        title={headerTitle}
        count={filteredIncomplete.length}
        filterConfig={filterConfig}
        onFilterChange={setFilterConfig}
        isMyDayList={isMyDay}
        isSuggestionsOpen={isSuggestionsOpen}
        onToggleSuggestions={onToggleSuggestions}
        isSchedulerOpen={isSchedulerOpen}
        onToggleScheduler={onToggleScheduler}
        suggestionsCount={calculatedSuggestionsCount}
      />

      {/* Inline FTS5 Search View (Ctrl+F or /) */}
      <SearchView
        onSelectTask={(taskId) => {
          const matched = activeTasks.find((t) => t.id === taskId);
          if (matched) {
            onSelectTask?.(matched);
          }
        }}
      />

      {/* Virtual Scroll Area wrapped in SortableContext */}
      <SortableContext
        items={allTaskIds}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setCombinedListRef}
          className={`${styles.virtualScrollArea} ${isMyDay && isTimeBlockDragging && isOverMyDayList ? styles.unscheduleTarget : ''}`}
        >
          {isMyDay && isTimeBlockDragging && isOverMyDayList && (
            <div className={styles.unscheduleBadge} aria-hidden="true">
              Drop to unschedule
            </div>
          )}
          {flattenedIncomplete.length === 0 && completedTasks.length === 0 ? (
            <EmptyState
              title="All clear"
              description="No tasks in this list. Press Ctrl+N to add one."
            />
          ) : (
            <div
              className={styles.virtualInner}
              style={{ height: `${virtualizer.getTotalSize()}px` }}
              role="list"
              aria-label="Tasks"
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = flattenedIncomplete[virtualItem.index];
                if (!item) return null;
                const { task, depth, hasSubtasks, isExpanded, subtaskCount } = item;

                return (
                  <div
                    key={virtualItem.key}
                    ref={virtualizer.measureElement}
                    data-index={virtualItem.index}
                    className={styles.virtualItem}
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    role="listitem"
                  >
                    <TaskCard
                      task={task}
                      depth={depth}
                      hasSubtasks={hasSubtasks}
                      isExpanded={isExpanded}
                      subtaskCount={subtaskCount}
                      onToggleExpand={toggleParentExpand}
                      isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                      allTaskIds={allTaskIds}
                      onSelect={(t) => setFocusedTaskId(t.id)}
                      onOpenDetail={(t) => onSelectTask?.(t)}
                      onToggleComplete={toggleComplete}
                      onToggleStar={toggleStar}
                      onUpdateTitle={(id, title) => updateTask({ id, title })}
                      onDelete={handleDeleteTask}
                      onDuplicate={duplicateTask}
                      onContextMenu={(e, t) => {
                        setContextMenuTask(t);
                        setContextMenuPos({ x: e.clientX, y: e.clientY });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Completed Section */}
          {completedTasks.length > 0 && (
            <div className={styles.completedSection}>
              <div
                className={styles.completedHeader}
                role="button"
                tabIndex={0}
                aria-expanded={isCompletedOpen}
                aria-label={`Completed tasks (${completedTasks.length})`}
                onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsCompletedOpen(!isCompletedOpen);
                  }
                }}
              >
                <span
                  className={`${styles.completedCaret} ${
                    isCompletedOpen ? styles.completedCaretOpen : ''
                  }`}
                  aria-hidden="true"
                >
                  ▶
                </span>
                <span>Completed ({completedTasks.length})</span>
              </div>

              {isCompletedOpen && (
                <div className={styles.completedList} role="list" aria-label="Completed tasks">
                  {completedTasks.map((task) => (
                    <div key={task.id} role="listitem">
                      <TaskCard
                        task={task}
                        depth={task.parent_task_id ? 1 : 0}
                        isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                        allTaskIds={allTaskIds}
                        onSelect={(t) => setFocusedTaskId(t.id)}
                        onOpenDetail={(t) => onSelectTask?.(t)}
                        onToggleComplete={toggleComplete}
                        onToggleStar={toggleStar}
                        onUpdateTitle={(id, title) => updateTask({ id, title })}
                        onDelete={handleDeleteTask}
                        onDuplicate={duplicateTask}
                        onContextMenu={(e, t) => {
                          setContextMenuTask(t);
                          setContextMenuPos({ x: e.clientX, y: e.clientY });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SortableContext>

      {/* Quick Add Bar anchored at bottom with spacing */}
      <div className={styles.quickAddRow}>
        <QuickAddBar />
      </div>

      {/* Insertion-point indicator: a thin line at the exact row-gap the
          dragged task would land in, indented to preview the nesting depth
          it would land at. Positioned fixed (viewport coords) so it doesn't
          need to know about the virtualizer's internal scroll math. */}
      {dropIndicator && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: `${dropIndicator.top}px`,
              left: `${dropIndicator.left}px`,
              width: `${dropIndicator.width}px`,
              height: '2px',
              background: 'var(--accent)',
              zIndex: 60,
              pointerEvents: 'none',
              transform: 'translateY(-1px)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: `${dropIndicator.top}px`,
              left: `${dropIndicator.left - 4}px`,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              border: '2px solid var(--accent)',
              background: 'var(--surface-base)',
              zIndex: 61,
              pointerEvents: 'none',
              transform: 'translate(0, -50%)',
            }}
          />
        </>
      )}



      {/* Bulk Action Bar (Framer Motion AnimatePresence) */}
      <BulkActionBar />

      {/* Task Context Menu */}
      <TaskContextMenu
        task={contextMenuTask}
        position={contextMenuPos}
        onClose={() => {
          setContextMenuTask(null);
          setContextMenuPos(null);
        }}
        onToggleComplete={toggleComplete}
        onToggleStar={toggleStar}
        onSetPriority={(id, priority) => updateTask({ id, priority })}
        onSetDueDate={(id, date, time, allDay) =>
          updateTask({
            id,
            due_date: date,
            due_time: time,
            all_day: allDay ? 1 : 0,
          })
        }
        onToggleMyDay={(id) => {
          const today = new Date().toISOString().split('T')[0];
          const target = activeTasks.find((t) => t.id === id);
          const next = target?.my_day_date === today ? null : today;
          updateTask({ id, my_day_date: next });
        }}
        onMoveToList={(id, listId) => updateTask({ id, list_id: listId })}
        onDuplicate={duplicateTask}
        onCreateSubtask={(parentId) => makeSubtask(`task-${Date.now()}`, parentId)}
        onOpenDetail={(t) => onSelectTask?.(t)}
        onDelete={handleDeleteTask}
      />

      {/* Undo Toast Container */}
      {lastToastAction && (
        <div className={styles.toastWrap}>
          <Toast
            id="undo-toast"
            message={lastToastAction.description}
            variant="undo"
            actionLabel="Undo"
            onAction={async () => {
              await undo();
              clearToast();
            }}
            onDismiss={() => clearToast()}
            duration={5000}
          />
        </div>
      )}
    </div>
  );
}

export default TaskList;
