import React, { useEffect } from 'react';
import { useTaskStore } from '../../stores/task-store.js';
import { useAppStore } from '../../stores/app-store.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { QuickAdd } from '../../components/QuickAdd/QuickAdd.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { ScrollArea } from '../../components/primitives/ScrollArea/ScrollArea.js';
import type { Task } from '../../../shared/types/task.js';
import styles from './TaskList.module.css';

interface TaskListProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function TaskList({
  onSelectTask,
  selectedTaskId,
}: TaskListProps): React.ReactElement {
  const { tasks, loading, fetchTasks, createTask, toggleComplete, deleteTask } = useTaskStore();
  const { activeListId } = useAppStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (title: string) => {
    await createTask({
      title,
      list_id: activeListId.startsWith('smart_') ? 'list_inbox' : activeListId,
    });
  };

  const getPriorityClass = (priority: number): string => {
    switch (priority) {
      case 1:
        return styles.priorityLow;
      case 2:
        return styles.priorityMedium;
      case 3:
        return styles.priorityHigh;
      case 4:
        return `${styles.priorityCritical} ${styles.priorityCriticalPulse}`;
      default:
        return '';
    }
  };

  const activeTitle = activeListId.startsWith('smart_')
    ? activeListId
        .replace('smart_', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
    : 'Tasks';

  return (
    <div className={styles.taskListContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>{activeTitle}</h1>
      </header>

      <div className={styles.quickAddWrapper}>
        <QuickAdd onAdd={handleCreateTask} />
      </div>

      <div className={styles.listScroll}>
        <ScrollArea orientation="vertical">
          {loading && tasks.length === 0 ? (
            <EmptyState title="Loading tasks..." description="Fetching your latest items" />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon="✓"
              title="All clear"
              description="No tasks in this list. Enjoy your day or add a new task above."
            />
          ) : (
            <div className={styles.tasks}>
              {tasks.map(task => {
                const isCompleted = task.is_completed === 1;
                const priorityClass = getPriorityClass(task.priority);
                const isSelected = selectedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`${styles.taskItem} ${isCompleted ? styles.taskCompleted : ''} ${
                      isSelected ? styles.taskItemActive : ''
                    } ${priorityClass}`}
                    onClick={() => onSelectTask?.(task)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectTask?.(task);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isCompleted}
                      onChange={() => toggleComplete(task.id)}
                      ariaLabel={`Mark "${task.title}" as ${isCompleted ? 'incomplete' : 'complete'}`}
                    />

                    <span className={styles.taskTitle}>{task.title}</span>

                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={e => {
                        e.stopPropagation();
                        deleteTask(task.id);
                        if (selectedTaskId === task.id) {
                          onSelectTask?.(null);
                        }
                      }}
                      title="Delete task"
                      aria-label={`Delete "${task.title}"`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default TaskList;
