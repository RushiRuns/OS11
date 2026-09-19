import React, { useState, useRef, useEffect, useDeferredValue, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
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

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  // Dnd-kit sensors: Pointer distance threshold 8px prevents click/drag conflict
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
              .filter((t) => t.parent_task_id === null)
              .sort((a, b) => a.sort_order - b.sort_order);
          default:
            return tasks
              .filter((t) => t.list_id === activeListId && t.parent_task_id === null)
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

  const allTaskIds = filteredIncomplete.map((t) => t.id);

  // TanStack Virtualizer
  const virtualizer = useVirtualizer({
    count: filteredIncomplete.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // var(--task-height-comfortable)
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

  // Handle Dnd-kit Drag End (Reorder & Nest Subtask)
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredIncomplete.findIndex((t) => t.id === active.id);
    const newIndex = filteredIncomplete.findIndex((t) => t.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const activeTask = filteredIncomplete[oldIndex];

    const prevTask = newIndex > 0 ? (newIndex > oldIndex ? filteredIncomplete[newIndex] : filteredIncomplete[newIndex - 1]) : null;
    const nextTask = newIndex < filteredIncomplete.length - 1 ? (newIndex > oldIndex ? filteredIncomplete[newIndex + 1] : filteredIncomplete[newIndex]) : null;

    const newSortOrder = between(prevTask?.sort_order ?? null, nextTask?.sort_order ?? null);
    const oldSortOrder = activeTask.sort_order;

    await reorderTask(String(active.id), newSortOrder);

    pushAction({
      description: `Reordered "${activeTask.title}"`,
      undoFn: async () => {
        await reorderTask(String(active.id), oldSortOrder);
      },
      redoFn: async () => {
        await reorderTask(String(active.id), newSortOrder);
      },
    });
  };

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

      {/* Virtual Scroll Area wrapped in DndContext & SortableContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allTaskIds}
          strategy={verticalListSortingStrategy}
        >
          <div ref={parentRef} className={styles.virtualScrollArea}>
            {filteredIncomplete.length === 0 && completedTasks.length === 0 ? (
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
                  const task = filteredIncomplete[virtualItem.index];
                  if (!task) return null;

                  return (
                    <div
                      key={task.id}
                      className={styles.virtualItem}
                      style={{
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      role="listitem"
                    >
                      <TaskCard
                        task={task}
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
      </DndContext>

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
