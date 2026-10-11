import { describe, it, expect } from 'vitest';
import {
  resolveContainerBadge,
  resolveSmartBadges,
  sanitizeIcon,
} from '../../src/renderer/features/tasks/task-badges.js';
import { SMART_LISTS } from '@shared/constants/index.js';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/Project.js';
import type { Area } from '@shared/types/Area.js';
import type { List } from '@shared/types/List.js';

describe('task-badges pure resolution unit tests', () => {
  const baseTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    notes: null,
    list_id: 'default',
    project_id: null,
    area_id: null,
    section_id: null,
    parent_task_id: null,
    due_date: null,
    due_time: null,
    all_day: 1,
    priority: 0,
    is_starred: 0,
    is_completed: 0,
    sort_order: 100,
    created_by_device: 'test',
    pomodoro_count: 0,
    is_trashed: 0,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  const projectOS11: Project = {
    id: 'proj-os11',
    name: 'OS11 Project',
    icon: '✅',
    status: 'active',
    default_view: 'list',
    views: ['list'],
    sort_order: 0,
    area_id: 'area-work',
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  const areaWork: Area = {
    id: 'area-work',
    workspace_id: 'ws_default',
    name: 'Work Area',
    icon: '🏢',
    sort_order: 0,
    is_collapsed: 0,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  const listGroceries: List = {
    id: 'list-groceries',
    name: 'Groceries',
    icon: '🛒',
    background_type: 'none',
    sort_order: 0,
    is_smart: 0,
    notification_enabled: 0,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  describe('sanitizeIcon', () => {
    it('preserves valid unicode emojis', () => {
      expect(sanitizeIcon('☀️', '📁')).toBe('☀️');
      expect(sanitizeIcon('🏠', '🏢')).toBe('🏠');
      expect(sanitizeIcon('✅', '📁')).toBe('✅');
    });

    it('falls back to default emoji when string is an alphanumeric Lucide icon name', () => {
      expect(sanitizeIcon('Layers', '⚡')).toBe('⚡');
      expect(sanitizeIcon('Archive', '📦')).toBe('📦');
      expect(sanitizeIcon('Clock', '⏳')).toBe('⏳');
      expect(sanitizeIcon('Folder_icon', '📁')).toBe('📁');
    });

    it('falls back when icon is null, undefined, or empty string', () => {
      expect(sanitizeIcon(null, '📁')).toBe('📁');
      expect(sanitizeIcon(undefined, '🏢')).toBe('🏢');
      expect(sanitizeIcon('   ', '📋')).toBe('📋');
    });
  });

  describe('resolveContainerBadge', () => {
    it('renders project badge in aggregate view (e.g. My Day)', () => {
      const badge = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11' },
        activeListId: SMART_LISTS.MY_DAY,
        project: projectOS11,
      });

      expect(badge).toEqual({
        icon: '✅',
        label: 'OS11 Project',
        targetListId: 'project:proj-os11',
        title: 'Project: OS11 Project',
      });
    });

    it('suppresses project badge when viewed inside its own project (project:id and bare id)', () => {
      const badge1 = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11' },
        activeListId: 'project:proj-os11',
        project: projectOS11,
      });
      expect(badge1).toBeNull();

      const badge2 = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11' },
        activeListId: 'proj-os11',
        project: projectOS11,
      });
      expect(badge2).toBeNull();
    });

    it('suppresses area badge when viewed inside its own area', () => {
      const badge = resolveContainerBadge({
        task: { ...baseTask, area_id: 'area-work' },
        activeListId: 'area:area-work',
        area: areaWork,
      });
      expect(badge).toBeNull();
    });

    it('suppresses custom list badge when viewed inside that list', () => {
      const badge = resolveContainerBadge({
        task: { ...baseTask, list_id: 'list-groceries' },
        activeListId: 'list-groceries',
        list: listGroceries,
      });
      expect(badge).toBeNull();
    });

    it('Area view displays Project badge for tasks having both project_id and area_id', () => {
      const badge = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11', area_id: 'area-work' },
        activeListId: 'area:area-work',
        project: projectOS11,
        area: areaWork,
      });

      expect(badge).not.toBeNull();
      expect(badge?.label).toBe('OS11 Project');
      expect(badge?.targetListId).toBe('project:proj-os11');
    });

    it('suppresses container badge on subtasks (depth > 0 or parent_task_id != null)', () => {
      const badgeWithDepth = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11' },
        activeListId: SMART_LISTS.MY_DAY,
        project: projectOS11,
        depth: 1,
      });
      expect(badgeWithDepth).toBeNull();

      const badgeWithParent = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-os11', parent_task_id: 'parent-1' },
        activeListId: SMART_LISTS.MY_DAY,
        project: projectOS11,
        depth: 0,
      });
      expect(badgeWithParent).toBeNull();
    });

    it('suppresses badge if project name is missing or empty', () => {
      const badge = resolveContainerBadge({
        task: { ...baseTask, project_id: 'proj-empty' },
        activeListId: SMART_LISTS.MY_DAY,
        project: { ...projectOS11, name: '   ' },
      });
      expect(badge).toBeNull();
    });
  });

  describe('resolveSmartBadges', () => {
    const today = '2026-10-11';

    it('suppresses My Day badge when inside My Day view', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, my_day_date: today },
        activeListId: SMART_LISTS.MY_DAY,
        today,
      });
      expect(badges.find(b => b.id === 'my_day')).toBeUndefined();
    });

    it('shows My Day badge when in a container view and my_day_date matches today', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, my_day_date: today },
        activeListId: 'project:proj-os11',
        today,
      });

      const myDayBadge = badges.find(b => b.id === 'my_day');
      expect(myDayBadge).toBeDefined();
      expect(myDayBadge?.label).toBe('My Day');
      expect(myDayBadge?.targetListId).toBe(SMART_LISTS.MY_DAY);
    });

    it('suppresses Anytime badge in Anytime view', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, bucket: 'anytime' },
        activeListId: SMART_LISTS.ANYTIME,
        today,
      });
      expect(badges.find(b => b.id === 'anytime')).toBeUndefined();
    });

    it('suppresses Someday badge in Someday view', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, bucket: 'someday' },
        activeListId: SMART_LISTS.SOMEDAY,
        today,
      });
      expect(badges.find(b => b.id === 'someday')).toBeUndefined();
    });

    it('suppresses Waiting badge in Waiting For view using SMART_LISTS.WAITING_FOR', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, waiting_on: 'Sarah' },
        activeListId: SMART_LISTS.WAITING_FOR,
        today,
      });
      expect(badges.find(b => b.id === 'waiting')).toBeUndefined();
    });

    it('navigates to SMART_LISTS.WAITING_FOR and formats label when waiting_on is present', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, waiting_on: 'Sarah' },
        activeListId: 'project:proj-os11',
        today,
      });

      const waitingBadge = badges.find(b => b.id === 'waiting');
      expect(waitingBadge).toBeDefined();
      expect(waitingBadge?.label).toBe('Waiting: Sarah');
      expect(waitingBadge?.targetListId).toBe('smart_waiting_for');
      expect(waitingBadge?.isOverdue).toBe(false);
    });

    it('marks Waiting badge as isOverdue when follow_up_date < today', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, waiting_on: 'Sarah', follow_up_date: '2026-10-10' },
        activeListId: 'project:proj-os11',
        today,
      });

      const waitingBadge = badges.find(b => b.id === 'waiting');
      expect(waitingBadge?.isOverdue).toBe(true);
    });

    it('does not mark Waiting badge as isOverdue when follow_up_date >= today', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, waiting_on: 'Sarah', follow_up_date: '2026-10-12' },
        activeListId: 'project:proj-os11',
        today,
      });

      const waitingBadge = badges.find(b => b.id === 'waiting');
      expect(waitingBadge?.isOverdue).toBe(false);
    });

    it('enforces My Day > Anytime > Someday precedence', () => {
      // Both My Day and Anytime set: My Day must win
      const badges = resolveSmartBadges({
        task: { ...baseTask, my_day_date: today, bucket: 'anytime' },
        activeListId: 'smart_all',
        today,
      });

      expect(badges.find(b => b.id === 'my_day')).toBeDefined();
      expect(badges.find(b => b.id === 'anytime')).toBeUndefined();
    });

    it('suppresses Anytime badge in project container view to prevent wallpaper', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, bucket: 'anytime' },
        activeListId: 'project:proj-os11',
        today,
      });

      expect(badges.find(b => b.id === 'anytime')).toBeUndefined();
    });

    it('suppresses Anytime badge in area container view to prevent wallpaper', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, bucket: 'anytime' },
        activeListId: 'area:area-work',
        today,
      });

      expect(badges.find(b => b.id === 'anytime')).toBeUndefined();
    });

    it('renders Anytime badge in aggregate views like smart_all or tag view', () => {
      const badgesAll = resolveSmartBadges({
        task: { ...baseTask, bucket: 'anytime' },
        activeListId: 'smart_all',
        today,
      });
      expect(badgesAll.find(b => b.id === 'anytime')).toBeDefined();
      expect(badgesAll[0].badgeType).toBe('anytime');

      const badgesTag = resolveSmartBadges({
        task: { ...baseTask, bucket: 'anytime' },
        activeListId: 'tag:tag-123',
        today,
      });
      expect(badgesTag.find(b => b.id === 'anytime')).toBeDefined();
    });

    it('renders Someday badge with box icon in container views', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, bucket: 'someday' },
        activeListId: 'project:proj-os11',
        today,
      });

      const somedayBadge = badges.find(b => b.id === 'someday');
      expect(somedayBadge).toBeDefined();
      expect(somedayBadge?.icon).toBe('📦');
      expect(somedayBadge?.badgeType).toBe('someday');
    });

    it('decouples Waiting from bucket chain so both display concurrently', () => {
      const badges = resolveSmartBadges({
        task: { ...baseTask, my_day_date: today, bucket: 'anytime', waiting_on: 'Alex' },
        activeListId: 'project:proj-os11',
        today,
      });

      expect(badges).toHaveLength(2);
      expect(badges[0].id).toBe('my_day');
      expect(badges[0].badgeType).toBe('my_day');
      expect(badges[1].id).toBe('waiting');
      expect(badges[1].badgeType).toBe('waiting');
      expect(badges[1].label).toBe('Waiting: Alex');
    });
  });
});
