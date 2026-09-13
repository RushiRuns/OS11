import React, { useState, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { TaskList } from '../tasks/TaskList.js';
import type { Task } from '@shared/types/task.js';
import styles from './MyDayView.module.css';

interface MyDayViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function MyDayView({
  onSelectTask,
  selectedTaskId,
}: MyDayViewProps): React.ReactElement {
  const { tasksById, updateTask } = useTaskStore();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Format date header nicely: e.g. "Sunday, September 13"
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Surfaces tasks due today/overdue or high-priority that are not yet in My Day
  const suggestions = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => {
        if (t.is_trashed === 1 || t.is_completed === 1) return false;
        if (t.my_day_date === todayStr) return false; // Already in My Day

        const isDueTodayOrOverdue = t.due_date && t.due_date <= todayStr;
        const isHighPriority = t.priority >= 2;
        return isDueTodayOrOverdue || isHighPriority;
      })
      .slice(0, 10);
  }, [tasksById, todayStr]);

  const handleAddToMyDay = async (task: Task) => {
    await updateTask({
      id: task.id,
      my_day_date: todayStr,
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>☀️ My Day</h1>
            <div className={styles.dateSub}>{formattedDate}</div>
          </div>

          {suggestions.length > 0 && (
            <button
              type="button"
              className={styles.suggestionToggleBtn}
              onClick={() => setShowSuggestions(!showSuggestions)}
            >
              <span>💡</span>
              <span>Suggestions ({suggestions.length})</span>
            </button>
          )}
        </div>
      </header>

      {showSuggestions && suggestions.length > 0 && (
        <div className={styles.suggestionPanel}>
          <div className={styles.suggestionHeader}>Recommended for Today</div>
          <div className={styles.suggestionList}>
            {suggestions.map((task) => (
              <div key={task.id} className={styles.suggestionRow}>
                <span className={styles.suggestionTitle}>
                  {task.title}
                  {task.due_date && task.due_date <= todayStr && (
                    <small style={{ marginLeft: 6, color: 'var(--color-danger)' }}>
                      (Due)
                    </small>
                  )}
                </span>
                <button
                  type="button"
                  className={styles.suggestionAddBtn}
                  onClick={() => handleAddToMyDay(task)}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.taskListWrap}>
        <TaskList
          onSelectTask={onSelectTask}
          selectedTaskId={selectedTaskId}
        />
      </div>
    </div>
  );
}

export default MyDayView;
