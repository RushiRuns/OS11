import { SMART_LISTS } from '@shared/constants/index.js';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/Project.js';
import type { Area } from '@shared/types/Area.js';
import type { List } from '@shared/types/List.js';

export interface ContainerBadge {
  icon: string;
  label: string;
  targetListId: string;
  title: string;
}

export interface SmartBadge {
  id: 'my_day' | 'anytime' | 'someday' | 'waiting';
  icon: string;
  label: string;
  badgeType: 'my_day' | 'anytime' | 'someday' | 'waiting';
  targetListId: string;
  title: string;
  isOverdue?: boolean;
}

/**
 * Ensures an icon is a valid single emoji/symbol or returns fallback emoji.
 * If the icon is a plain ASCII word (e.g. Lucide icon key 'Layers', 'Archive', 'Clock'),
 * the fallback emoji is used instead of printing raw text.
 */
export function sanitizeIcon(icon: string | null | undefined, fallback: string): string {
  if (!icon || !icon.trim()) return fallback;
  const trimmed = icon.trim();
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

export interface ResolveContainerBadgeArgs {
  task: Task;
  activeListId: string;
  project?: Project | null;
  area?: Area | null;
  list?: List | null;
  depth?: number;
}

/**
 * Resolves the container badge (Project, Area, or List) for a task based on current view.
 *
 * Rules:
 * - Subtasks (depth > 0 or parent_task_id) inherit container context from parent; badge suppressed.
 * - Project view suppresses Project badge.
 * - Area view displays Project badge if task belongs to a project; suppresses Area badge for standalone tasks.
 * - Custom list view suppresses that list badge.
 * - Container precedence: Project > Area > List.
 */
export function resolveContainerBadge({
  task,
  activeListId,
  project,
  area,
  list,
  depth = 0,
}: ResolveContainerBadgeArgs): ContainerBadge | null {
  if (depth > 0 || Boolean(task.parent_task_id)) {
    return null;
  }

  // 1. Project container
  if (task.project_id && project && project.name && project.name.trim()) {
    const isCurrentProject = activeListId === `project:${project.id}` || activeListId === project.id;
    if (isCurrentProject) {
      return null;
    }
    const icon = sanitizeIcon(project.icon, '📁');
    const label = project.name.trim();
    return {
      icon,
      label,
      targetListId: `project:${project.id}`,
      title: `Project: ${label}`,
    };
  }

  // 2. Area container (for tasks directly in an area, or if project is not loaded)
  if (task.area_id && area && area.name && area.name.trim()) {
    const isCurrentArea = activeListId === `area:${area.id}` || activeListId === area.id;
    if (isCurrentArea) {
      return null;
    }
    const icon = sanitizeIcon(area.icon, '🏢');
    const label = area.name.trim();
    return {
      icon,
      label,
      targetListId: `area:${area.id}`,
      title: `Area: ${label}`,
    };
  }

  // 3. Custom list container
  if (task.list_id && list && list.name && list.name.trim() && list.id !== 'list_inbox' && list.id !== 'default') {
    const isCurrentList = activeListId === list.id;
    if (isCurrentList) {
      return null;
    }
    const icon = sanitizeIcon(list.icon, '📋');
    const label = list.name.trim();
    return {
      icon,
      label,
      targetListId: list.id,
      title: `List: ${label}`,
    };
  }

  return null;
}

export interface ResolveSmartBadgesArgs {
  task: Task;
  activeListId: string;
  today: string;
}

/**
 * Resolves smart status badges for a task.
 *
 * Rules:
 * - Bucket chain precedence: My Day > Anytime > Someday (mutually exclusive).
 * - Suppressed inside the matching smart view (e.g. My Day badge hidden in smart_my_day, Anytime in smart_anytime).
 * - Displays Anytime badge across container views (projects, areas, lists) for cross-view feedback.
 * - Waiting status is evaluated independently alongside bucket status.
 * - Waiting badge marks isOverdue if follow_up_date < today.
 */
export function resolveSmartBadges({
  task,
  activeListId,
  today,
}: ResolveSmartBadgesArgs): SmartBadge[] {
  const badges: SmartBadge[] = [];

  // 1. Bucket Status Chain
  const isTaskInMyDay = Boolean(task.my_day_date && task.my_day_date === today);

  if (activeListId !== SMART_LISTS.MY_DAY && isTaskInMyDay) {
    badges.push({
      id: 'my_day',
      icon: '☀️',
      label: 'My Day',
      badgeType: 'my_day',
      targetListId: SMART_LISTS.MY_DAY,
      title: 'In My Day',
    });
  } else if (
    activeListId !== SMART_LISTS.ANYTIME &&
    task.bucket === 'anytime'
  ) {
    badges.push({
      id: 'anytime',
      icon: '⚡',
      label: 'Anytime',
      badgeType: 'anytime',
      targetListId: SMART_LISTS.ANYTIME,
      title: 'Bucket: Anytime',
    });
  } else if (activeListId !== SMART_LISTS.SOMEDAY && task.bucket === 'someday') {
    badges.push({
      id: 'someday',
      icon: '📦',
      label: 'Someday',
      badgeType: 'someday',
      targetListId: SMART_LISTS.SOMEDAY,
      title: 'Bucket: Someday',
    });
  }

  // 2. Waiting Status (decoupled from bucket chain)
  if (activeListId !== SMART_LISTS.WAITING_FOR && task.waiting_on && task.waiting_on.trim()) {
    const waitingLabel = task.waiting_on.trim();
    const isOverdue = Boolean(task.follow_up_date && task.follow_up_date < today);
    badges.push({
      id: 'waiting',
      icon: '⏳',
      label: `Waiting: ${waitingLabel}`,
      badgeType: 'waiting',
      targetListId: SMART_LISTS.WAITING_FOR,
      title: `Waiting on: ${waitingLabel}${task.follow_up_date ? ` (follow up: ${task.follow_up_date})` : ''}`,
      isOverdue,
    });
  }

  return badges;
}
