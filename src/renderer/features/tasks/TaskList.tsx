import React, { useState, useRef, useEffect, useDeferredValue, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useDndMonitor,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
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

interface TaskListProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export interface FlattenedTaskItem {
  task: Task;
  depth: number;
  hasSubtasks: boolean;
  isExpanded: boolean;
  subtaskCount: { completed: number; total: number };
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
    gap: 8,
    overscan: 10,
  };
}

export function TaskList({
  onSelectTask,
  selectedTaskId,
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
    promoteSubtask,
    reorderTask,
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

  const parentRef = useRef<HTMLDivElement>(null);

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
          default:
            return tasks
              .filter((t) => t.list_id === activeListId)
              .sort((a, b) => a.sort_order - b.sort_order);
        }
      },
      [activeListId]
    )
  );

  const completedTasks = useCompletedTasks(activeListId);

  // Filter & Sort (deferred value avoids blocking user inputs)
  const deferredConfig = useDeferredValue(filterConfig);
  const filteredIncomplete = useFilteredTasks(
    activeTasks.filter((t) => t.is_completed === 0),
    deferredConfig
  );

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

  const allTaskIds = flattenedIncomplete.map((item) => item.task.id);

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
  // Pixels of horizontal drag that equal one indent level. Matches the 28px
  // per-depth indent TaskCard already uses, so the drop-line indent lines up
  // visually with where a card at that depth would actually sit.
  const INDENT_PX = 28;
  // How far in from the list's left edge a depth-0 drop line should start.
  // This should line up with where a depth-0 card's title text begins
  // (past the chevron + checkbox). Nudge this one number if the line looks
  // offset from your cards.
  const INDENT_LINE_BASE_PADDING = 40;

  interface DropPlan {
    parentId: string | null;
    prevSiblingId: string | null;
    nextSiblingId: string | null;
    depth: number;
    lineTop: number; // viewport-relative Y of the insertion point
  }

  // Given the task being dragged, whatever row dnd-kit currently reports as
  // "over", and how far the pointer has moved horizontally since the drag
  // started, work out: which two siblings the dropped task would land
  // between, and how deep it would nest.
  //
  // Depth rule (matches Todoist/Workflowy-style outliners): by default
  // (no leftward drag) the task nests as a CHILD of whatever row sits
  // directly above the insertion point - that's what makes nesting the
  // "easy" outcome instead of something you have to precisely aim for.
  // Dragging left "outdents" it - each INDENT_PX of leftward movement steps
  // it back out one level, down to top-level (depth 0).
  const computeDropPlan = useCallback(
    (
      activeId: string,
      overId: string,
      deltaX: number,
      activeRect: { top: number; height: number } | null,
      overRect: { top: number; height: number }
    ): DropPlan | null => {
      const visible = flattenedIncomplete.filter((i) => i.task.id !== activeId);
      const overIndex = visible.findIndex((i) => i.task.id === overId);
      if (overIndex === -1) return null;

      const activeCenterY = activeRect
        ? activeRect.top + activeRect.height / 2
        : overRect.top + overRect.height / 2;
      const overCenterY = overRect.top + overRect.height / 2;
      const insertBefore = activeCenterY < overCenterY;

      // The "anchor" is whichever visible row will sit directly ABOVE the
      // dropped task once it lands - that row's depth caps how deep we can nest.
      const anchorItem = insertBefore
        ? (overIndex > 0 ? visible[overIndex - 1] : null)
        : visible[overIndex];

      const anchorDepth = anchorItem ? anchorItem.depth : -1;
      const maxDepth = anchorItem ? anchorDepth + 1 : 0;

      const leftSteps = Math.max(0, Math.round(-deltaX / INDENT_PX));
      const depth = Math.max(0, Math.min(maxDepth, maxDepth - leftSteps));

      let parentTask: Task | null = null;
      if (depth > 0 && anchorItem) {
        let current: Task | undefined = anchorItem.task;
        let currentDepth = anchorDepth;
        while (current && currentDepth > depth - 1) {
          const pid: string | null = current.parent_task_id ?? null;
          current = pid ? tasksById[pid] : undefined;
          currentDepth -= 1;
        }
        parentTask = current ?? null;
      }
      const parentId = parentTask ? parentTask.id : null;

      // Find the actual prev/next siblings under that parent, scanning
      // outward from the insertion gap (skips over any of a sibling's own
      // nested descendants automatically, since those have a different
      // parent_task_id).
      const gapIndex = insertBefore ? overIndex : overIndex + 1;
      let prevSiblingId: string | null = null;
      for (let i = gapIndex - 1; i >= 0; i--) {
        const pid = visible[i].task.parent_task_id ?? null;
        if (pid === parentId) {
          prevSiblingId = visible[i].task.id;
          break;
        }
      }
      let nextSiblingId: string | null = null;
      for (let i = gapIndex; i < visible.length; i++) {
        const pid = visible[i].task.parent_task_id ?? null;
        if (pid === parentId) {
          nextSiblingId = visible[i].task.id;
          break;
        }
      }

      const lineTop = insertBefore ? overRect.top : overRect.top + overRect.height;

      return { parentId, prevSiblingId, nextSiblingId, depth, lineTop };
    },
    [flattenedIncomplete, tasksById]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTaskId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over, delta } = event;
    if (!over || active.id === over.id) {
      setDropIndicator(null);
      return;
    }

    const overIdStr = String(over.id);
    if (overIdStr.startsWith('list:') || overIdStr.startsWith('project:') || overIdStr.startsWith('tag:')) {
      setDropIndicator(null);
      return; // Handled by App.tsx (sidebar list/project/tag drop targets)
    }

    const overRect = over.rect;
    if (!overRect) {
      setDropIndicator(null);
      return;
    }
    const activeRect = active.rect.current.translated ?? active.rect.current.initial ?? null;

    const plan = computeDropPlan(String(active.id), overIdStr, delta.x, activeRect, overRect);
    if (!plan) {
      setDropIndicator(null);
      return;
    }

    const containerRect = parentRef.current?.getBoundingClientRect();
    if (!containerRect) {
      setDropIndicator(null);
      return;
    }

    const left = containerRect.left + INDENT_LINE_BASE_PADDING + plan.depth * INDENT_PX;
    const width = Math.max(40, containerRect.right - left - 16);

    setDropIndicator({ top: plan.lineTop, left, width, depth: plan.depth });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setDraggingTaskId(null);
    setDropIndicator(null);

    if (!over || active.id === over.id) return;

    const overIdStr = String(over.id);
    if (overIdStr.startsWith('list:') || overIdStr.startsWith('project:') || overIdStr.startsWith('tag:')) {
      return; // Handled by App.tsx
    }

    const overRect = over.rect;
    if (!overRect) return;
    const activeRect = active.rect.current.translated ?? active.rect.current.initial ?? null;

    const plan = computeDropPlan(String(active.id), overIdStr, delta.x, activeRect, overRect);
    if (!plan) return;

    const activeId = String(active.id);
    const activeTask = tasksById[activeId];
    if (!activeTask) return;

    const currentParentId = activeTask.parent_task_id ?? null;

    try {
      if (plan.parentId !== currentParentId) {
        if (plan.parentId === null) {
          await promoteSubtask(activeId);
        } else {
          await makeSubtask(activeId, plan.parentId);
        }
      }

      const prevSibling = plan.prevSiblingId ? tasksById[plan.prevSiblingId] : null;
      const nextSibling = plan.nextSiblingId ? tasksById[plan.nextSiblingId] : null;
      const newSortOrder = between(prevSibling?.sort_order ?? null, nextSibling?.sort_order ?? null);
      await reorderTask(activeId, newSortOrder);
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  };

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: () => {
      setDraggingTaskId(null);
      setDropIndicator(null);
    },
  });

  const headerTitle = (() => {
    switch (activeListId) {
      case 'smart_my_day':
        return 'My Day';
      case 'smart_important':
        return 'Important';
      case 'smart_planned':
        return 'Planned';
      case 'smart_all':
      case 'smart_all_tasks':
        return 'All Tasks';
      default:
        return activeListId.startsWith('list_') ? 'Tasks' : 'Tasks';
    }
  })();

  return (
    <div className={styles.taskListContainer} data-dragging={Boolean(draggingTaskId)}>
      {/* Header with Search/Filter bar */}
      <TaskListHeader
        title={headerTitle}
        count={filteredIncomplete.length}
        filterConfig={filterConfig}
        onFilterChange={setFilterConfig}
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

      {/* Quick Add Bar (52px height, 16px radius, Ctrl+N focus, live NLP preview chips) */}
      <div className={styles.quickAddRow}>
        <QuickAddBar />
      </div>

      {/* Virtual Scroll Area wrapped in SortableContext */}
      <SortableContext
        items={allTaskIds}
        strategy={verticalListSortingStrategy}
      >
        <div ref={parentRef} className={styles.virtualScrollArea}>
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

      {/* Floating drag preview: follows the pointer directly instead of the
          card animating/shifting in place, so it's always obvious what
          you're holding and where it'll go. */}
      <DragOverlay dropAnimation={null}>
        {draggingTaskId
          ? (() => {
              const draggingItem = flattenedIncomplete.find((i) => i.task.id === draggingTaskId);
              const draggingTask = draggingItem?.task ?? tasksById[draggingTaskId];
              if (!draggingTask) return null;
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md, 10px)',
                    background: 'var(--surface-raised, #2a2a2e)',
                    border: '1px solid var(--border-subtle, #3a3a3e)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                    maxWidth: '420px',
                    cursor: 'grabbing',
                  }}
                >
                  <span
                    style={{ fontSize: '13px', color: 'var(--text-tertiary, #888)', lineHeight: 1 }}
                    aria-hidden="true"
                  >
                    ⠿
                  </span>
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid var(--text-tertiary, #888)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    style={{
                      fontSize: '14px',
                      color: 'var(--text-primary, #fff)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {draggingTask.title}
                  </span>
                  {draggingItem?.hasSubtasks && (
                    <span
                      style={{ fontSize: '12px', color: 'var(--text-tertiary, #888)', flexShrink: 0 }}
                    >
                      {draggingItem.subtaskCount.completed}/{draggingItem.subtaskCount.total}
                    </span>
                  )}
                </div>
              );
            })()
          : null}
      </DragOverlay>

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
