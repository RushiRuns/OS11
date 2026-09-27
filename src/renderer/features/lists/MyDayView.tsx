import React, { useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { TaskList } from '../tasks/TaskList.js';
import { Button } from '../../components/Button/Button.js';
import { Tooltip } from '../../components/Tooltip/Tooltip.js';
import type { Task } from '@shared/types/task.js';
import styles from './MyDayView.module.css';

interface MyDayViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
  isSuggestionsOpen?: boolean;
  onToggleSuggestions?: () => void;
}

export function MyDayView({
  onSelectTask,
  selectedTaskId,
  isSuggestionsOpen,
  onToggleSuggestions,
}: MyDayViewProps): React.ReactElement {
  const { tasksById } = useTaskStore();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Format date header nicely: e.g. "Sunday, September 13"
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Count tasks recommended for today
  const suggestionsCount = useMemo(() => {
    return Object.values(tasksById).filter((t) => {
      if (t.is_trashed === 1 || t.is_completed === 1) return false;
      if (t.my_day_date === todayStr) return false;

      const isDueTodayOrOverdue = t.due_date && t.due_date <= todayStr;
      const isHighPriority = t.priority >= 2;
      return isDueTodayOrOverdue || isHighPriority;
    }).length;
  }, [tasksById, todayStr]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>☀️ My Day</h1>
            <div className={styles.dateSub}>{formattedDate}</div>
          </div>

          {suggestionsCount > 0 && (
            <Tooltip content={`Suggestions (${suggestionsCount})`} side="bottom">
              <Button
                variant={isSuggestionsOpen ? 'primary' : 'ghost'}
                size="sm"
                className={styles.suggestionBtn}
                onClick={onToggleSuggestions}
                aria-label="Toggle suggestions"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

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
