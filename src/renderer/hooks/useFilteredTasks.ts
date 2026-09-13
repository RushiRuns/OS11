import { useMemo } from 'react';
import type { Task } from '@shared/types/task.js';

export type SortOption = 'manual' | 'due_date' | 'priority' | 'alphabetical' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export interface TaskFilterConfig {
  sortBy: SortOption;
  sortDirection: SortDirection;
  priorityFilter: number | null; // null = any
  incompleteOnly: boolean;
  starredOnly: boolean;
  searchQuery: string;
}

export const DEFAULT_FILTER_CONFIG: TaskFilterConfig = {
  sortBy: 'manual',
  sortDirection: 'asc',
  priorityFilter: null,
  incompleteOnly: false,
  starredOnly: false,
  searchQuery: '',
};

export function useFilteredTasks(tasks: Task[], config: TaskFilterConfig): Task[] {
  return useMemo(() => {
    let result = [...tasks];

    // 1. Filtering
    if (config.incompleteOnly) {
      result = result.filter((t) => t.is_completed === 0);
    }

    if (config.starredOnly) {
      result = result.filter((t) => t.is_starred === 1);
    }

    if (config.priorityFilter !== null) {
      result = result.filter((t) => t.priority === config.priorityFilter);
    }

    if (config.searchQuery.trim()) {
      const q = config.searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // 2. Sorting
    result.sort((a, b) => {
      let comparison = 0;

      switch (config.sortBy) {
        case 'due_date': {
          if (!a.due_date && !b.due_date) comparison = a.sort_order - b.sort_order;
          else if (!a.due_date) comparison = 1;
          else if (!b.due_date) comparison = -1;
          else comparison = a.due_date.localeCompare(b.due_date);
          break;
        }

        case 'priority': {
          comparison = b.priority - a.priority; // Default higher priority first
          break;
        }

        case 'alphabetical': {
          comparison = a.title.localeCompare(b.title);
          break;
        }

        case 'created_at': {
          comparison = b.created_at.localeCompare(a.created_at);
          break;
        }

        case 'manual':
        default: {
          comparison = a.sort_order - b.sort_order;
          break;
        }
      }

      return config.sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [tasks, config]);
}

export default useFilteredTasks;
