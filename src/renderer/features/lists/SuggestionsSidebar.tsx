import React, { useMemo, useEffect } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { Button } from '../../components/Button/Button.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { Task } from '@shared/types/task.js';
import styles from './SuggestionsSidebar.module.css';

export interface SuggestionsSidebarProps {
  onClose: () => void;
}

export function SuggestionsSidebar({ onClose }: SuggestionsSidebarProps): React.ReactElement {
  const { tasksById, updateTask } = useTaskStore();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter tasks due today/overdue or high-priority that are not yet in My Day
  const suggestions = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => {
        if (t.is_trashed === 1 || t.is_completed === 1) return false;
        if (t.my_day_date === todayStr) return false;

        const isDueTodayOrOverdue = t.due_date && t.due_date <= todayStr;
        const isHighPriority = t.priority >= 2;
        return isDueTodayOrOverdue || isHighPriority;
      })
      .slice(0, 15);
  }, [tasksById, todayStr]);

  const handleAddToMyDay = async (task: Task) => {
    await updateTask({
      id: task.id,
      my_day_date: todayStr,
    });
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside className={styles.panelContainer} aria-label="Suggestions Sidebar">
      <div className={styles.header}>
        <span className={styles.headerTitle}>Suggestions</span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close suggestions"
          title="Close suggestions"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className={styles.emptyStateContainer}>
          <EmptyState
            title="All caught up!"
            description="No suggestions recommended for today."
          />
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.suggestionList}>
            {suggestions.map((task) => (
              <div key={task.id} className={styles.suggestionRow}>
                <div className={styles.suggestionTitleWrap}>
                  <span className={styles.suggestionTitle} title={task.title}>
                    {task.title}
                  </span>
                  {task.due_date && task.due_date <= todayStr && (
                    <span className={styles.dueBadge}>(Due)</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddToMyDay(task)}
                  aria-label={`Add ${task.title} to My Day`}
                >
                  + Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default SuggestionsSidebar;
