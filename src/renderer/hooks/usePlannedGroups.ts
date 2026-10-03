import { useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import {
  toISODateOnly,
  addDaysISO,
  getEndOfWeek,
  getNextWeekRange,
  formatMonthLabel,
  formatForDisplay,
  formatOverdueLabel,
} from '@shared/utils/date.js';
import { parseISO, format } from 'date-fns';

export type PlannedGroupKind =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'this-week' // one group per remaining weekday
  | 'next-week' // one group, not split by day
  | 'later'; // one group per month

export interface PlannedGroup {
  key: string;
  kind: PlannedGroupKind;
  label: string; // "Overdue · Sep 28", "Today", "Wednesday, Oct 7", "Next Week", "November"
  dateISO?: string; // set for day-level groups only
  taskIds: string[];
  targetDropDateISO?: string; // required for every kind except 'overdue' (not a drop target)
}

export interface PlannedDropData {
  type?: string;
  targetDropDateISO?: string;
  kind?: string;
  groupKey?: string;
}

/**
 * Computes the planned group key a task currently belongs to.
 */
export function getTaskPlannedGroupKey(task: Task, today: string): string | null {
  if (!task.due_date || task.is_trashed === 1 || task.is_completed === 1) return null;
  const taskDateStr = toISODateOnly(task.due_date);
  const todayStr = toISODateOnly(today);
  const tomorrowStr = addDaysISO(todayStr, 1);

  const todayDate = parseISO(todayStr);
  const currentWeekEndStr = format(getEndOfWeek(todayDate), 'yyyy-MM-dd');
  const nextWeekRange = getNextWeekRange(todayDate);

  if (taskDateStr < todayStr) {
    return `overdue:${taskDateStr}`;
  }
  if (taskDateStr === todayStr) {
    return 'today';
  }
  if (taskDateStr === tomorrowStr) {
    return 'tomorrow';
  }
  if (taskDateStr > tomorrowStr && taskDateStr <= currentWeekEndStr) {
    return `this-week:${taskDateStr}`;
  }
  if (taskDateStr >= nextWeekRange.startISO && taskDateStr <= nextWeekRange.endISO) {
    return 'next-week';
  }
  if (taskDateStr > nextWeekRange.endISO) {
    return `later:${taskDateStr.slice(0, 7)}`;
  }
  return null;
}

/**
 * Pure function to resolve whether a drag drop should update a task's due date.
 * Returns the target date ISO string if the drop is valid and requires rescheduling,
 * or null if the drop is a no-op (same group, same date, or invalid target).
 */
export function resolvePlannedDrop(
  task: Task | null | undefined,
  overData: PlannedDropData | null | undefined,
  today: string
): string | null {
  if (!task || !overData) return null;
  if (overData.type !== 'planned-group') return null;
  if (overData.kind === 'overdue' || !overData.targetDropDateISO) return null;

  const currentTaskDate = task.due_date ? toISODateOnly(task.due_date) : null;
  const targetDate = overData.targetDropDateISO;

  // 1. If dropping onto the exact same date, no-op
  if (currentTaskDate === targetDate) {
    return null;
  }

  // 2. If dropping onto the exact same group bucket, no-op
  if (overData.groupKey && currentTaskDate) {
    const currentGroupKey = getTaskPlannedGroupKey(task, today);
    if (currentGroupKey && currentGroupKey === overData.groupKey) {
      return null;
    }
  }

  return targetDate;
}

/**
 * Sort tasks within a day / bucket:
 * 1. All-day tasks first (all_day === 1 or !due_time)
 * 2. Timed tasks by due_time ascending
 * 3. Ties by sort_order ascending
 */
export function sortTasksWithinDay(a: Task, b: Task): number {
  const aIsAllDay = a.all_day === 1 || !a.due_time;
  const bIsAllDay = b.all_day === 1 || !b.due_time;

  if (aIsAllDay && !bIsAllDay) return -1;
  if (!aIsAllDay && bIsAllDay) return 1;

  if (!aIsAllDay && !bIsAllDay) {
    const timeCompare = (a.due_time || '').localeCompare(b.due_time || '');
    if (timeCompare !== 0) return timeCompare;
  }

  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
}

/**
 * Pure function to partition active dated tasks into planned groups.
 */
export function buildPlannedGroups(tasks: Task[], today: string): PlannedGroup[] {
  const todayStr = toISODateOnly(today);
  const tomorrowStr = addDaysISO(todayStr, 1);

  // Compute week boundaries using Monday-start convention
  const todayDate = parseISO(todayStr);
  const currentWeekEndDate = getEndOfWeek(todayDate);
  const currentWeekEndStr = format(currentWeekEndDate, 'yyyy-MM-dd');

  const nextWeekRange = getNextWeekRange(todayDate);
  const nextWeekStartStr = nextWeekRange.startISO;
  const nextWeekEndStr = nextWeekRange.endISO;

  // Filter out trashed and completed tasks
  const eligibleTasks = tasks.filter(t => t.due_date && t.is_trashed === 0 && t.is_completed === 0);

  // Group buckets collectors
  const overdueMap = new Map<string, Task[]>(); // dateStr -> Task[]
  const todayTasks: Task[] = [];
  const tomorrowTasks: Task[] = [];
  const thisWeekMap = new Map<string, Task[]>(); // dateStr -> Task[]
  const nextWeekTasks: Task[] = [];
  const laterMap = new Map<string, Task[]>(); // yearMonth -> Task[]

  for (const task of eligibleTasks) {
    const taskDateStr = toISODateOnly(task.due_date!);

    // Precedence: Overdue, Today, Tomorrow, This Week, Next Week, Later
    if (taskDateStr < todayStr) {
      if (!overdueMap.has(taskDateStr)) {
        overdueMap.set(taskDateStr, []);
      }
      overdueMap.get(taskDateStr)!.push(task);
    } else if (taskDateStr === todayStr) {
      todayTasks.push(task);
    } else if (taskDateStr === tomorrowStr) {
      tomorrowTasks.push(task);
    } else if (taskDateStr > tomorrowStr && taskDateStr <= currentWeekEndStr) {
      if (!thisWeekMap.has(taskDateStr)) {
        thisWeekMap.set(taskDateStr, []);
      }
      thisWeekMap.get(taskDateStr)!.push(task);
    } else if (
      taskDateStr > tomorrowStr &&
      taskDateStr >= nextWeekStartStr &&
      taskDateStr <= nextWeekEndStr
    ) {
      nextWeekTasks.push(task);
    } else if (taskDateStr > nextWeekEndStr) {
      const yearMonth = taskDateStr.slice(0, 7); // YYYY-MM
      if (!laterMap.has(yearMonth)) {
        laterMap.set(yearMonth, []);
      }
      laterMap.get(yearMonth)!.push(task);
    }
  }

  const groups: PlannedGroup[] = [];

  // 1. Overdue groups: Split by day, oldest first
  const sortedOverdueDates = Array.from(overdueMap.keys()).sort();
  for (const dateStr of sortedOverdueDates) {
    const dateTasks = overdueMap.get(dateStr)!.sort(sortTasksWithinDay);
    if (dateTasks.length > 0) {
      groups.push({
        key: `overdue:${dateStr}`,
        kind: 'overdue',
        label: formatOverdueLabel(dateStr),
        dateISO: dateStr,
        taskIds: dateTasks.map(t => t.id),
        // No targetDropDateISO (not a drop target)
      });
    }
  }

  // 2. Today group
  if (todayTasks.length > 0) {
    todayTasks.sort(sortTasksWithinDay);
    groups.push({
      key: 'today',
      kind: 'today',
      label: 'Today',
      dateISO: todayStr,
      taskIds: todayTasks.map(t => t.id),
      targetDropDateISO: todayStr,
    });
  }

  // 3. Tomorrow group
  if (tomorrowTasks.length > 0) {
    tomorrowTasks.sort(sortTasksWithinDay);
    groups.push({
      key: 'tomorrow',
      kind: 'tomorrow',
      label: 'Tomorrow',
      dateISO: tomorrowStr,
      taskIds: tomorrowTasks.map(t => t.id),
      targetDropDateISO: tomorrowStr,
    });
  }

  // 4. This Week groups: Split by day, chronologically
  const sortedThisWeekDates = Array.from(thisWeekMap.keys()).sort();
  for (const dateStr of sortedThisWeekDates) {
    const dateTasks = thisWeekMap.get(dateStr)!.sort(sortTasksWithinDay);
    if (dateTasks.length > 0) {
      groups.push({
        key: `this-week:${dateStr}`,
        kind: 'this-week',
        label: formatForDisplay(dateStr),
        dateISO: dateStr,
        taskIds: dateTasks.map(t => t.id),
        targetDropDateISO: dateStr,
      });
    }
  }

  // 5. Next Week group: Single aggregate bucket
  if (nextWeekTasks.length > 0) {
    // Sort tasks in Next Week by date ascending first, then within day
    nextWeekTasks.sort((a, b) => {
      const dateA = toISODateOnly(a.due_date!);
      const dateB = toISODateOnly(b.due_date!);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return sortTasksWithinDay(a, b);
    });

    groups.push({
      key: 'next-week',
      kind: 'next-week',
      label: 'Next Week',
      dateISO: undefined,
      taskIds: nextWeekTasks.map(t => t.id),
      targetDropDateISO: nextWeekStartStr, // Defaults to following Monday
    });
  }

  // 6. Later groups: Split by month, chronologically
  const sortedYearMonths = Array.from(laterMap.keys()).sort();
  for (const ym of sortedYearMonths) {
    const monthTasks = laterMap.get(ym)!.sort((a, b) => {
      const dateA = toISODateOnly(a.due_date!);
      const dateB = toISODateOnly(b.due_date!);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return sortTasksWithinDay(a, b);
    });

    if (monthTasks.length > 0) {
      const monthFirstDate = parseISO(`${ym}-01`);
      // If the 1st of this month is on or before nextWeekEndStr (e.g. current month),
      // the drop target must be the first day after next week so it never targets a past or overdue date!
      const defaultDropDate = `${ym}-01`;
      const targetDropDate =
        defaultDropDate <= nextWeekEndStr ? addDaysISO(nextWeekEndStr, 1) : defaultDropDate;

      groups.push({
        key: `later:${ym}`,
        kind: 'later',
        label: formatMonthLabel(monthFirstDate),
        dateISO: undefined,
        taskIds: monthTasks.map(t => t.id),
        targetDropDateISO: targetDropDate,
      });
    }
  }

  return groups;
}

export function usePlannedGroups(tasks: Task[], today: string): PlannedGroup[] {
  return useMemo(() => {
    return buildPlannedGroups(tasks, today);
  }, [tasks, today]);
}

export default usePlannedGroups;
