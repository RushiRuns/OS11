import React, { useState, useRef, useEffect, useDeferredValue, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useDndMonitor,
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
    reorderTask,
  } = useTaskStore();

  const { selectAll } = useSelectionStore();
  const { pushAction, undo, lastToastAction, clearToast } = useUndoRedo();
  const [filterConfig, setFilterConfig] = useState(DEFAULT_FILTER_CONFIG);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [subtaskTargetId, setSubtaskTargetId] = useState<string | null>(null);

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

    interface FlattenedTaskItem {
      task: Task;
      depth: number;
      hasSubtasks: boolean;
      isExpanded: boolean;
      subtaskCount: { completed: number; total: number };
    }

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

  // TanStack Virtualizer with dynamic measurement and uniform flexible 8px gap
  const virtualizer = useVirtualizer({
    count: flattenedIncomplete.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    gap: 8,
    overscan: 10,
  });

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

  // Handle Dnd-kit Drag Over (detect subtask nesting target)
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      if (subtaskTargetId !== null) setSubtaskTargetId(null);
      return;
    }

    const overIdStr = String(over.id);
    if (overIdStr.startsWith('list:') || overIdStr.startsWith('project:') || overIdStr.startsWith('tag:')) {
      if (subtaskTargetId !== null) setSubtaskTargetId(null);
      return;
    }

    const activeRect = active.rect.current.translated;
    const overRect = over.rect;

    if (activeRect && overRect) {
      const activeCenterY = activeRect.top + activeRect.height / 2;
      const overCenterY = overRect.top + overRect.height / 2;
      const distance = Math.abs(activeCenterY - overCenterY);
      // If dropped directly within center 60% of card: nest as subtask
      if (distance < overRect.height * 0.3) {
        if (subtaskTargetId !== over.id) {
          console.log('[DragDrop] Subtask target hover:', over.id);
          setSubtaskTargetId(String(over.id));
        }
        return;
      }
    }

    if (subtaskTargetId !== null) {
      setSubtaskTargetId(null);
    }
  };

  // Handle Dnd-kit Drag End (Reorder & Nest Subtask)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const targetSubtaskId = subtaskTargetId;
    setSubtaskTargetId(null);

    if (!over || active.id === over.id) return;

    const overIdStr = String(over.id);
    if (overIdStr.startsWith('list:') || overIdStr.startsWith('project:') || overIdStr.startsWith('tag:')) {
      return; // Handled by App.tsx
    }

    // 1. Direct drop onto card: Nest as Subtask
    if (targetSubtaskId && targetSubtaskId === over.id) {
      try {
        console.log('[DragDrop] Nesting as subtask commit:', { childId: active.id, parentId: over.id });
        await makeSubtask(String(active.id), String(over.id));
      } catch (err) {
        console.error('Failed to make subtask:', err);
      }
      return;
    }

    // 2. Otherwise: Reorder between cards silently (no toast notification)
    const flatTasks = flattenedIncomplete.map((i) => i.task);
    const oldIndex = flatTasks.findIndex((t) => t.id === active.id);
    const newIndex = flatTasks.findIndex((t) => t.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const prevTask = newIndex > 0 ? (newIndex > oldIndex ? flatTasks[newIndex] : flatTasks[newIndex - 1]) : null;
    const nextTask = newIndex < flatTasks.length - 1 ? (newIndex > oldIndex ? flatTasks[newIndex + 1] : flatTasks[newIndex]) : null;

    const newSortOrder = between(prevTask?.sort_order ?? null, nextTask?.sort_order ?? null);
    console.log('[DragDrop] Reorder commit:', { taskId: active.id, newSortOrder });

    await reorderTask(String(active.id), newSortOrder);
  };

  useDndMonitor({
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
    onDragCancel: () => setSubtaskTargetId(null),
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
    <div className={styles.taskListContainer}>
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
                    key={task.id}
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
                      isSubtaskTarget={subtaskTargetId === task.id}
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
