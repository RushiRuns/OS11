import { useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/Project.js';
import type { Area } from '@shared/types/Area.js';
import type { Tag } from '@shared/types/Tag.js';
import { toISODateOnly, addDaysISO } from '@shared/utils/date.js';
import type { GroupByOption } from '../stores/viewGroupStore.js';
import type { FlattenedTaskItem } from '../features/tasks/TaskList.js';

export interface TaskGroup {
  key: string;
  title: string;
  items: FlattenedTaskItem[];
}

export interface GroupTasksOptions {
  items: FlattenedTaskItem[];
  groupBy: GroupByOption;
  projectsById?: Record<string, Project>;
  areasById?: Record<string, Area>;
  tagsById?: Record<string, Tag>;
  taskTagsByTaskId?: Record<string, string[]>;
  todayStr?: string;
  includeEmpty?: boolean;
}

const PRIORITY_CONFIG: { priority: number; key: string; title: string }[] = [
  { priority: 4, key: 'priority-4', title: 'Urgent' },
  { priority: 3, key: 'priority-3', title: 'High' },
  { priority: 2, key: 'priority-2', title: 'Medium' },
  { priority: 1, key: 'priority-1', title: 'Low' },
  { priority: 0, key: 'priority-0', title: 'No Priority' },
];

/**
 * Pure function to partition flattened task items into ordered groups
 * according to the selected GroupByOption.
 */
export function groupTasks({
  items,
  groupBy,
  projectsById = {},
  areasById = {},
  tagsById = {},
  taskTagsByTaskId = {},
  todayStr,
  includeEmpty = false,
}: GroupTasksOptions): TaskGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', title: 'All Tasks', items }];
  }

  const today = todayStr || toISODateOnly(new Date());

  // Helper to ensure subtask depth doesn't look orphaned if parent is in a different group
  const sanitizeGroupItems = (groupItems: FlattenedTaskItem[]): FlattenedTaskItem[] => {
    const idsInGroup = new Set(groupItems.map((i) => i.task.id));
    return groupItems.map((item) => {
      if (item.depth > 0 && item.task.parent_task_id && !idsInGroup.has(item.task.parent_task_id)) {
        return { ...item, depth: 0 };
      }
      return item;
    });
  };

  // 1. Group by Priority
  if (groupBy === 'priority') {
    const buckets: Record<number, FlattenedTaskItem[]> = {
      4: [],
      3: [],
      2: [],
      1: [],
      0: [],
    };

    for (const item of items) {
      const p = item.task.priority ?? 0;
      const validPriority = p in buckets ? p : 0;
      buckets[validPriority].push(item);
    }

    const result: TaskGroup[] = [];
    for (const cfg of PRIORITY_CONFIG) {
      const list = buckets[cfg.priority] || [];
      if (includeEmpty || list.length > 0) {
        result.push({
          key: cfg.key,
          title: cfg.title,
          items: sanitizeGroupItems(list),
        });
      }
    }
    return result;
  }

  // 2. Group by Date
  if (groupBy === 'date') {
    const tomorrow = addDaysISO(today, 1);
    const in7Days = addDaysISO(today, 7);

    const buckets: {
      overdue: FlattenedTaskItem[];
      today: FlattenedTaskItem[];
      tomorrow: FlattenedTaskItem[];
      upcoming: FlattenedTaskItem[];
      later: FlattenedTaskItem[];
      noDate: FlattenedTaskItem[];
    } = {
      overdue: [],
      today: [],
      tomorrow: [],
      upcoming: [],
      later: [],
      noDate: [],
    };

    for (const item of items) {
      const dueDate = item.task.due_date ? toISODateOnly(item.task.due_date) : null;
      const myDayDate = item.task.my_day_date ? toISODateOnly(item.task.my_day_date) : null;

      if (!dueDate) {
        if (myDayDate === today) {
          buckets.today.push(item);
        } else {
          buckets.noDate.push(item);
        }
      } else if (dueDate < today) {
        buckets.overdue.push(item);
      } else if (dueDate === today) {
        buckets.today.push(item);
      } else if (dueDate === tomorrow) {
        buckets.tomorrow.push(item);
      } else if (dueDate <= in7Days) {
        buckets.upcoming.push(item);
      } else {
        buckets.later.push(item);
      }
    }

    const DATE_CONFIG = [
      { key: 'date-overdue', title: 'Overdue', list: buckets.overdue, allowEmpty: false },
      { key: 'date-today', title: 'Today', list: buckets.today, allowEmpty: true },
      { key: 'date-tomorrow', title: 'Tomorrow', list: buckets.tomorrow, allowEmpty: true },
      { key: 'date-upcoming', title: 'Upcoming', list: buckets.upcoming, allowEmpty: true },
      { key: 'date-later', title: 'Later', list: buckets.later, allowEmpty: true },
      { key: 'date-none', title: 'No Date', list: buckets.noDate, allowEmpty: true },
    ];

    const result: TaskGroup[] = [];
    for (const cfg of DATE_CONFIG) {
      const shouldInclude = cfg.allowEmpty && includeEmpty ? true : cfg.list.length > 0;
      if (shouldInclude) {
        result.push({
          key: cfg.key,
          title: cfg.title,
          items: sanitizeGroupItems(cfg.list),
        });
      }
    }
    return result;
  }

  // 3. Group by Tag
  if (groupBy === 'tag') {
    const tagBuckets: Record<string, FlattenedTaskItem[]> = {};
    const noTagItems: FlattenedTaskItem[] = [];

    for (const item of items) {
      const taskTags = taskTagsByTaskId[item.task.id] || item.task.tags?.map((t) => t.id) || [];
      if (taskTags.length > 0) {
        const primaryTagId = taskTags[0];
        if (!tagBuckets[primaryTagId]) {
          tagBuckets[primaryTagId] = [];
        }
        tagBuckets[primaryTagId].push(item);
      } else {
        noTagItems.push(item);
      }
    }

    const sortedTagIds = Object.keys(tagBuckets).sort((a, b) => {
      const tagA = tagsById[a]?.name || '';
      const tagB = tagsById[b]?.name || '';
      return tagA.localeCompare(tagB);
    });

    const result: TaskGroup[] = [];
    for (const tId of sortedTagIds) {
      const tagObj = tagsById[tId];
      result.push({
        key: `tag-${tId}`,
        title: tagObj ? `#${tagObj.name}` : '#Tag',
        items: sanitizeGroupItems(tagBuckets[tId]),
      });
    }

    if (noTagItems.length > 0 || (includeEmpty && Object.keys(tagsById).length > 0)) {
      result.push({
        key: 'tag-none',
        title: 'No Tag',
        items: sanitizeGroupItems(noTagItems),
      });
    }

    return result;
  }

  // 4. Group by Project
  if (groupBy === 'project') {
    const projectBuckets: Record<string, FlattenedTaskItem[]> = {};
    const noProjectItems: FlattenedTaskItem[] = [];

    for (const item of items) {
      const pId = item.task.project_id;
      if (pId && projectsById[pId]) {
        if (!projectBuckets[pId]) {
          projectBuckets[pId] = [];
        }
        projectBuckets[pId].push(item);
      } else {
        noProjectItems.push(item);
      }
    }

    const sortedProjectIds = Object.keys(projectBuckets).sort((a, b) => {
      const projA = projectsById[a];
      const projB = projectsById[b];
      if (projA?.sort_order !== undefined && projB?.sort_order !== undefined) {
        return projA.sort_order - projB.sort_order;
      }
      return (projA?.name || '').localeCompare(projB?.name || '');
    });

    const result: TaskGroup[] = [];
    for (const pId of sortedProjectIds) {
      const proj = projectsById[pId];
      result.push({
        key: `project-${pId}`,
        title: proj ? `${proj.icon ? proj.icon + ' ' : '📁 '}${proj.name}` : 'Project',
        items: sanitizeGroupItems(projectBuckets[pId]),
      });
    }

    if (noProjectItems.length > 0) {
      result.push({
        key: 'project-none',
        title: 'No Project',
        items: sanitizeGroupItems(noProjectItems),
      });
    }

    return result;
  }

  // 5. Group by Area
  if (groupBy === 'area') {
    const areaBuckets: Record<string, FlattenedTaskItem[]> = {};
    const noAreaItems: FlattenedTaskItem[] = [];

    for (const item of items) {
      const aId =
        item.task.area_id ||
        (item.task.project_id && projectsById[item.task.project_id]?.area_id) ||
        null;

      if (aId && areasById[aId]) {
        if (!areaBuckets[aId]) {
          areaBuckets[aId] = [];
        }
        areaBuckets[aId].push(item);
      } else {
        noAreaItems.push(item);
      }
    }

    const sortedAreaIds = Object.keys(areaBuckets).sort((a, b) => {
      const areaA = areasById[a];
      const areaB = areasById[b];
      if (areaA?.sort_order !== undefined && areaB?.sort_order !== undefined) {
        return areaA.sort_order - areaB.sort_order;
      }
      return (areaA?.name || '').localeCompare(areaB?.name || '');
    });

    const result: TaskGroup[] = [];
    for (const aId of sortedAreaIds) {
      const area = areasById[aId];
      result.push({
        key: `area-${aId}`,
        title: area ? `${area.icon ? area.icon + ' ' : '🧭 '}${area.name}` : 'Area',
        items: sanitizeGroupItems(areaBuckets[aId]),
      });
    }

    if (noAreaItems.length > 0) {
      result.push({
        key: 'area-none',
        title: 'No Area',
        items: sanitizeGroupItems(noAreaItems),
      });
    }

    return result;
  }

  // 6. Group by Time
  if (groupBy === 'time') {
    const buckets: {
      morning: FlattenedTaskItem[];
      afternoon: FlattenedTaskItem[];
      evening: FlattenedTaskItem[];
      night: FlattenedTaskItem[];
      anyTime: FlattenedTaskItem[];
    } = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      anyTime: [],
    };

    for (const item of items) {
      let minutes: number | null = null;
      if (item.task.scheduled_start_min !== null && item.task.scheduled_start_min !== undefined) {
        minutes = item.task.scheduled_start_min;
      } else if (item.task.due_time) {
        const parts = item.task.due_time.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1] || '0', 10);
        if (!Number.isNaN(h)) {
          minutes = h * 60 + (Number.isNaN(m) ? 0 : m);
        }
      }

      if (minutes === null) {
        buckets.anyTime.push(item);
      } else if (minutes < 720) {
        // Before 12:00 PM
        buckets.morning.push(item);
      } else if (minutes < 1020) {
        // 12:00 PM - 5:00 PM
        buckets.afternoon.push(item);
      } else if (minutes < 1260) {
        // 5:00 PM - 9:00 PM
        buckets.evening.push(item);
      } else {
        // After 9:00 PM
        buckets.night.push(item);
      }
    }

    const TIME_CONFIG = [
      { key: 'time-morning', title: 'Morning', list: buckets.morning },
      { key: 'time-afternoon', title: 'Afternoon', list: buckets.afternoon },
      { key: 'time-evening', title: 'Evening', list: buckets.evening },
      { key: 'time-night', title: 'Night', list: buckets.night },
      { key: 'time-any', title: 'Any Time', list: buckets.anyTime },
    ];

    const result: TaskGroup[] = [];
    for (const cfg of TIME_CONFIG) {
      if (includeEmpty || cfg.list.length > 0) {
        result.push({
          key: cfg.key,
          title: cfg.title,
          items: sanitizeGroupItems(cfg.list),
        });
      }
    }
    return result;
  }

  return [{ key: 'all', title: 'All Tasks', items }];
}

export interface GroupDropMutationResult {
  updates: Partial<Task>;
  previousValues: Partial<Task>;
  tagChanges?: {
    addTagId?: string;
    removeTagId?: string;
  };
  description: string;
}

/**
 * Pure function to resolve property changes when a task is dropped across groups.
 */
export function resolveGroupDropMutation({
  task,
  groupBy,
  targetGroupKey,
  targetTask,
  projectsById = {},
  areasById = {},
  taskTagsByTaskId = {},
  todayStr,
}: {
  task: Task;
  groupBy: GroupByOption;
  targetGroupKey: string;
  targetTask?: Task | null;
  projectsById?: Record<string, Project>;
  areasById?: Record<string, Area>;
  taskTagsByTaskId?: Record<string, string[]>;
  todayStr: string;
}): GroupDropMutationResult | null {
  if (groupBy === 'none') return null;

  // 1. Priority
  if (groupBy === 'priority') {
    let targetPriority = 0;
    if (targetTask && targetTask.priority !== undefined) {
      targetPriority = targetTask.priority ?? 0;
    } else if (targetGroupKey.startsWith('priority-')) {
      targetPriority = parseInt(targetGroupKey.replace('priority-', ''), 10) || 0;
    }

    if (task.priority === targetPriority) return null;

    const PRIORITY_NAMES: Record<number, string> = {
      4: 'Urgent',
      3: 'High',
      2: 'Medium',
      1: 'Low',
      0: 'No Priority',
    };

    return {
      updates: { priority: targetPriority },
      previousValues: { priority: task.priority },
      description: `Set priority of "${task.title}" to ${PRIORITY_NAMES[targetPriority] || 'No Priority'}`,
    };
  }

  // 2. Date
  if (groupBy === 'date') {
    let targetDate: string | null = null;
    if (targetTask && targetTask.due_date) {
      targetDate = targetTask.due_date;
    } else if (targetGroupKey === 'date-today') {
      targetDate = todayStr;
    } else if (targetGroupKey === 'date-tomorrow') {
      targetDate = addDaysISO(todayStr, 1);
    } else if (targetGroupKey === 'date-upcoming') {
      targetDate = addDaysISO(todayStr, 2);
    } else if (targetGroupKey === 'date-later') {
      targetDate = addDaysISO(todayStr, 8);
    } else if (targetGroupKey === 'date-overdue') {
      targetDate = addDaysISO(todayStr, -1);
    } else if (targetGroupKey === 'date-none') {
      targetDate = null;
    }

    if (task.due_date === targetDate) return null;

    return {
      updates: { due_date: targetDate },
      previousValues: { due_date: task.due_date },
      description: `Moved "${task.title}" to ${targetDate || 'No Date'}`,
    };
  }

  // 3. Project
  if (groupBy === 'project') {
    let newProjectId: string | null = null;
    let newAreaId: string | null = task.area_id ?? null;

    if (targetTask) {
      newProjectId = targetTask.project_id ?? null;
      newAreaId = targetTask.area_id ?? null;
    } else if (targetGroupKey.startsWith('project-') && targetGroupKey !== 'project-none') {
      newProjectId = targetGroupKey.replace('project-', '');
      newAreaId = projectsById[newProjectId]?.area_id ?? null;
    } else if (targetGroupKey === 'project-none') {
      newProjectId = null;
    }

    if (task.project_id === newProjectId) return null;

    const projName =
      newProjectId && projectsById[newProjectId] ? projectsById[newProjectId].name : 'No Project';
    return {
      updates: { project_id: newProjectId, area_id: newAreaId },
      previousValues: { project_id: task.project_id, area_id: task.area_id },
      description: `Moved "${task.title}" to ${projName}`,
    };
  }

  // 4. Area
  if (groupBy === 'area') {
    let newAreaId: string | null = null;
    let newProjectId = task.project_id ?? null;

    if (targetTask) {
      newAreaId = targetTask.area_id ?? null;
    } else if (targetGroupKey.startsWith('area-') && targetGroupKey !== 'area-none') {
      newAreaId = targetGroupKey.replace('area-', '');
    } else if (targetGroupKey === 'area-none') {
      newAreaId = null;
    }

    if (task.area_id === newAreaId) return null;

    // If moving to a different area, clear project if it belongs to an old area
    if (newProjectId && projectsById[newProjectId] && projectsById[newProjectId].area_id !== newAreaId) {
      newProjectId = null;
    }

    const areaName = newAreaId && areasById[newAreaId] ? areasById[newAreaId].name : 'No Area';
    return {
      updates: { area_id: newAreaId, project_id: newProjectId },
      previousValues: { area_id: task.area_id, project_id: task.project_id },
      description: `Moved "${task.title}" to ${areaName}`,
    };
  }

  // 5. Tag
  if (groupBy === 'tag') {
    const taskTags = taskTagsByTaskId[task.id] || task.tags?.map((t) => t.id) || [];
    const prevTagId = taskTags[0] || null;

    let targetTagId: string | null = null;
    if (targetTask) {
      const targetTags = taskTagsByTaskId[targetTask.id] || targetTask.tags?.map((t) => t.id) || [];
      targetTagId = targetTags[0] || null;
    } else if (targetGroupKey.startsWith('tag-') && targetGroupKey !== 'tag-none') {
      targetTagId = targetGroupKey.replace('tag-', '');
    } else if (targetGroupKey === 'tag-none') {
      targetTagId = null;
    }

    if (prevTagId === targetTagId) return null;

    return {
      updates: {},
      previousValues: {},
      tagChanges: {
        addTagId: targetTagId || undefined,
        removeTagId: prevTagId || undefined,
      },
      description: `Updated tag on "${task.title}"`,
    };
  }

  // 6. Time
  if (groupBy === 'time') {
    let newMin: number | null = null;
    let newTime: string | null = null;

    const targetTimeKey = targetGroupKey;
    if (targetTask) {
      if (targetTask.scheduled_start_min !== null && targetTask.scheduled_start_min !== undefined) {
        newMin = targetTask.scheduled_start_min;
        const h = String(Math.floor(newMin / 60)).padStart(2, '0');
        const m = String(newMin % 60).padStart(2, '0');
        newTime = `${h}:${m}`;
      } else if (targetTask.due_time) {
        newTime = targetTask.due_time;
      }
    } else {
      if (targetTimeKey === 'time-morning') {
        newMin = 540; // 9:00 AM
        newTime = '09:00';
      } else if (targetTimeKey === 'time-afternoon') {
        newMin = 840; // 2:00 PM
        newTime = '14:00';
      } else if (targetTimeKey === 'time-evening') {
        newMin = 1080; // 6:00 PM
        newTime = '18:00';
      } else if (targetTimeKey === 'time-night') {
        newMin = 1260; // 9:00 PM
        newTime = '21:00';
      } else if (targetTimeKey === 'time-any') {
        newMin = null;
        newTime = null;
      }
    }

    if (task.scheduled_start_min === newMin && task.due_time === newTime) return null;

    return {
      updates: { scheduled_start_min: newMin, due_time: newTime },
      previousValues: { scheduled_start_min: task.scheduled_start_min, due_time: task.due_time },
      description: `Moved "${task.title}" to ${targetTimeKey.replace('time-', '')}`,
    };
  }

  return null;
}

/**
 * React hook to memoize task grouping.
 */
export function useGroupedTasks(options: GroupTasksOptions): TaskGroup[] {
  const {
    items,
    groupBy,
    projectsById,
    areasById,
    tagsById,
    taskTagsByTaskId,
    todayStr,
    includeEmpty,
  } = options;

  return useMemo(
    () =>
      groupTasks({
        items,
        groupBy,
        projectsById,
        areasById,
        tagsById,
        taskTagsByTaskId,
        todayStr,
        includeEmpty,
      }),
    [items, groupBy, projectsById, areasById, tagsById, taskTagsByTaskId, todayStr, includeEmpty]
  );
}

export default useGroupedTasks;
