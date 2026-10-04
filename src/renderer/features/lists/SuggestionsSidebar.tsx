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

  // Filter and prioritize suggestions:
  // 1. Due follow-ups: waiting_since is set and follow_up_date <= today
  // 2. Due / overdue tasks
  // 3. High priority tasks
  // 4. Anytime bucket tasks
  // Strictly excludes Someday bucket tasks.
  const suggestions = useMemo(() => {
    const followUps: Array<{ task: Task; badge: string; badgeClass: string }> = [];
    const dueTasks: Array<{ task: Task; badge: string; badgeClass: string }> = [];
    const priorityTasks: Array<{ task: Task; badge: string; badgeClass: string }> = [];
    const anytimeTasks: Array<{ task: Task; badge: string; badgeClass: string }> = [];

    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 1 || t.is_completed === 1) continue;
      if (t.my_day_date === todayStr) continue;
      if (t.bucket === 'someday') continue;

      if (t.waiting_since && t.follow_up_date && t.follow_up_date <= todayStr) {
        followUps.push({
          task: t,
          badge: 'Follow up today',
          badgeClass: styles.followUpBadge,
        });
        continue;
      }

      if (t.due_date && t.due_date <= todayStr) {
        dueTasks.push({
          task: t,
          badge: '(Due)',
          badgeClass: styles.dueBadge,
        });
        continue;
      }

      if (t.priority >= 2) {
        priorityTasks.push({
          task: t,
          badge: t.priority >= 3 ? 'High Priority' : 'Priority',
          badgeClass: styles.priorityBadge,
        });
        continue;
      }

      if (t.bucket === 'anytime') {
        anytimeTasks.push({
          task: t,
          badge: 'Anytime',
          badgeClass: styles.anytimeBadge,
        });
      }
    }

    anytimeTasks.sort((a, b) => (b.task.created_at || '').localeCompare(a.task.created_at || ''));

    return [...followUps, ...dueTasks, ...priorityTasks, ...anytimeTasks].slice(0, 20);
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
            {suggestions.map(({ task, badge, badgeClass }) => (
              <div key={task.id} className={styles.suggestionRow}>
                <div className={styles.suggestionTitleWrap}>
                  <span className={styles.suggestionTitle} title={task.title}>
                    {task.title}
                  </span>
                  {badge && <span className={badgeClass}>{badge}</span>}
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
