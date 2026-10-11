import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Project, Task } from '../../src/shared/types/index.js';
import { ProjectHeader } from '../../src/renderer/features/projects/ProjectHeader.js';
import { ProjectListView } from '../../src/renderer/features/projects/ProjectListView.js';
import { useViewGroupStore, type GroupByOption } from '../../src/renderer/stores/viewGroupStore.js';
import { resolveGroupDropMutation } from '../../src/renderer/hooks/useGroupedTasks.js';

// Setup mock window & localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
};

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: localStorageMock,
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  // Reset viewGroupStore state
  const state = useViewGroupStore.getState();
  for (const k of Object.keys(state.groupByMap)) {
    state.setGroupBy(k, 'none');
  }
  for (const k of Object.keys(state.visibleMap)) {
    state.setVisible(k, false);
  }
});

const mockProject: Project = {
  id: 'proj-group-test',
  name: 'Group By Test Project',
  description: 'Testing group by options in list view',
  color: '#6366f1',
  icon: '📁',
  status: 'active',
  default_view: 'list',
  views: ['list', 'board', 'table', 'calendar', 'timeline'],
  sort_order: 1,
  group_id: null,
  area_id: 'area-1',
  is_pinned: 0,
  pinned_sort_order: 0,
  is_someday: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockTasks: Task[] = [
  {
    id: 't-urgent',
    title: 'Urgent Task',
    project_id: 'proj-group-test',
    status: 'todo',
    priority: 4,
    sort_order: 1000,
    is_completed: 0,
    is_trashed: 0,
    due_date: '2026-10-15',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any,
  {
    id: 't-high',
    title: 'High Priority Task',
    project_id: 'proj-group-test',
    status: 'todo',
    priority: 3,
    sort_order: 2000,
    is_completed: 0,
    is_trashed: 0,
    due_date: '2026-10-15',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any,
  {
    id: 't-none',
    title: 'No Priority Task',
    project_id: 'proj-group-test',
    status: 'todo',
    priority: 0,
    sort_order: 3000,
    is_completed: 0,
    is_trashed: 0,
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any,
];

describe('Project View — Group By in List View', () => {
  describe('1. Menu Item & Header Pill Visibility', () => {
    it('TC-01: Group by pill renders when currentView is "list" and isVisible is true', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setVisible(viewId, true);
      useViewGroupStore.getState().setGroupBy(viewId, 'priority');

      const html = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: mockProject,
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );

      expect(html).toContain('Group by:');
      expect(html).toContain('Priority');
    });

    it('TC-02: Group by pill is NOT rendered for non-list views (board, table, etc.) even if visible in store', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setVisible(viewId, true);
      useViewGroupStore.getState().setGroupBy(viewId, 'priority');

      const nonListViews = ['board', 'table', 'calendar', 'timeline'] as const;

      for (const view of nonListViews) {
        const html = renderToStaticMarkup(
          React.createElement(ProjectHeader, {
            project: mockProject,
            sections: [],
            tasks: [],
            milestones: [],
            currentView: view,
            onViewChange: () => {},
            onOpenMilestones: () => {},
            onOpenTemplates: () => {},
          })
        );

        expect(html).not.toContain('groupByControl');
        expect(html).not.toContain('Group by:');
      }
    });

    it('TC-03: Group by pill is hidden when isVisible is false in list view', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setVisible(viewId, false);

      const html = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: mockProject,
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );

      expect(html).not.toContain('groupByControl');
      expect(html).not.toContain('Group by:');
    });
  });

  describe('2. Dropdown Options Exclusion', () => {
    it('TC-04: Options for project list view exclude "project" and "area"', () => {
      const allOptions: GroupByOption[] = [
        'none',
        'time',
        'date',
        'tag',
        'project',
        'area',
        'priority',
      ];
      const projectOptions = allOptions.filter((opt) => opt !== 'project' && opt !== 'area');

      expect(projectOptions).toEqual(['none', 'time', 'date', 'tag', 'priority']);
      expect(projectOptions).not.toContain('project');
      expect(projectOptions).not.toContain('area');
    });
  });

  describe('3. Store Persistence & Resetting ("none")', () => {
    it('TC-05: Grouping preference is saved per-project in useViewGroupStore', () => {
      const viewId1 = 'project:proj-1';
      const viewId2 = 'project:proj-2';

      useViewGroupStore.getState().setGroupBy(viewId1, 'priority');
      useViewGroupStore.getState().setGroupBy(viewId2, 'date');

      expect(useViewGroupStore.getState().getGroupBy(viewId1)).toBe('priority');
      expect(useViewGroupStore.getState().getGroupBy(viewId2)).toBe('date');
    });

    it('TC-06: Selecting "none" resets group option and auto-hides pill', () => {
      const viewId = `project:${mockProject.id}`;

      useViewGroupStore.getState().setVisible(viewId, true);
      useViewGroupStore.getState().setGroupBy(viewId, 'priority');
      expect(useViewGroupStore.getState().isVisible(viewId)).toBe(true);

      // Select 'none'
      useViewGroupStore.getState().setGroupBy(viewId, 'none');

      expect(useViewGroupStore.getState().getGroupBy(viewId)).toBe('none');
      expect(useViewGroupStore.getState().isVisible(viewId)).toBe(false);
    });
  });

  describe('4. ProjectListView Grouping Behavior', () => {
    it('TC-07: Renders grouped sections when groupBy is not none', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setGroupBy(viewId, 'priority');

      const html = renderToStaticMarkup(
        React.createElement(ProjectListView, {
          project: mockProject,
          tasks: mockTasks,
          onSelectTask: () => {},
        })
      );

      // Should contain group regions and titles for Urgent, High, and No Priority
      expect(html).toContain('groupedContainer');
      expect(html).toContain('Urgent');
      expect(html).toContain('High');
      expect(html).toContain('No Priority');
    });

    it('TC-08: Hides empty groups (e.g. Medium and Low have 0 tasks)', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setGroupBy(viewId, 'priority');

      const html = renderToStaticMarkup(
        React.createElement(ProjectListView, {
          project: mockProject,
          tasks: mockTasks,
          onSelectTask: () => {},
        })
      );

      // Medium and Low have 0 tasks, so should not be rendered
      expect(html).not.toContain('aria-label="Medium"');
      expect(html).not.toContain('aria-label="Low"');
    });

    it('TC-09: Reverts to flat tasksList when groupBy is none', () => {
      const viewId = `project:${mockProject.id}`;
      useViewGroupStore.getState().setGroupBy(viewId, 'none');

      const html = renderToStaticMarkup(
        React.createElement(ProjectListView, {
          project: mockProject,
          tasks: mockTasks,
          onSelectTask: () => {},
        })
      );

      expect(html).toContain('tasksList');
      expect(html).not.toContain('groupedContainer');
    });
  });

  describe('5. Drag-and-Drop Mutation Resolution', () => {
    it('TC-10: resolveGroupDropMutation computes priority update when dropped on group header', () => {
      const task = mockTasks[2]; // No Priority (priority 0)
      const mutation = resolveGroupDropMutation({
        task,
        groupBy: 'priority',
        targetGroupKey: 'priority-4', // Urgent
        todayStr: '2026-10-15',
      });

      expect(mutation).not.toBeNull();
      expect(mutation?.updates).toEqual({ priority: 4 });
    });

    it('TC-11: resolveGroupDropMutation computes date update when dropped on date group', () => {
      const task = mockTasks[2]; // due_date is null
      const mutation = resolveGroupDropMutation({
        task,
        groupBy: 'date',
        targetGroupKey: 'date-today',
        todayStr: '2026-10-15',
      });

      expect(mutation).not.toBeNull();
      expect(mutation?.updates).toEqual({ due_date: '2026-10-15' });
    });
  });
});
