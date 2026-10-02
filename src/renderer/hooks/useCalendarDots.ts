import { useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { toISODateOnly } from '@shared/utils/date.js';
import { buildMonthGridCells } from './useMonthGrid.js';

export function computeCalendarDots(tasks: Task[], visibleMonth: Date): Record<string, number> {
  const dots: Record<string, number> = {};

  // Build the 42 cells representing the visible grid
  const cells = buildMonthGridCells(visibleMonth, null);
  const visibleDatesSet = new Set(cells.map(c => c.dateStr));

  // Initialize dots for all visible dates
  for (const dateStr of visibleDatesSet) {
    dots[dateStr] = 0;
  }

  // Count active tasks for visible dates
  for (const task of tasks) {
    if (task.due_date && task.is_trashed === 0 && task.is_completed === 0) {
      const taskDateStr = toISODateOnly(task.due_date);
      if (visibleDatesSet.has(taskDateStr)) {
        dots[taskDateStr] = (dots[taskDateStr] || 0) + 1;
      }
    }
  }

  return dots;
}

export function useCalendarDots(tasks: Task[], visibleMonth: Date): Record<string, number> {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();

  return useMemo(() => {
    return computeCalendarDots(tasks, new Date(year, month, 1));
  }, [tasks, year, month]);
}

export default useCalendarDots;
