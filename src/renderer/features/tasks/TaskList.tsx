import React, { useState, useRef, useEffect, useDeferredValue, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useTaskStore,
  useCompletedTasks,
} from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { TaskCard } from './TaskCard.js';
import { TaskListHeader } from './TaskListHeader.js';
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
  } = useTaskStore();

  const { pushAction, undo, lastToastAction, clearToast } = useUndoRedo();
  const [filterConfig, setFilterConfig] = useState(DEFAULT_FILTER_CONFIG);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

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

      {/* Virtual Scroll Area */}
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
                >
                  <TaskCard
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={onSelectTask}
                    onToggleComplete={toggleComplete}
                    onToggleStar={toggleStar}
                    onUpdateTitle={(id, title) => updateTask({ id, title })}
                    onDelete={handleDeleteTask}
                    onDuplicate={duplicateTask}
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
              onClick={() => setIsCompletedOpen(!isCompletedOpen)}
            >
              <span
                className={`${styles.completedCaret} ${
                  isCompletedOpen ? styles.completedCaretOpen : ''
                }`}
              >
                ▶
              </span>
              <span>Completed ({completedTasks.length})</span>
            </div>

            {isCompletedOpen && (
              <div className={styles.completedList}>
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={onSelectTask}
                    onToggleComplete={toggleComplete}
                    onToggleStar={toggleStar}
                    onUpdateTitle={(id, title) => updateTask({ id, title })}
                    onDelete={handleDeleteTask}
                    onDuplicate={duplicateTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
