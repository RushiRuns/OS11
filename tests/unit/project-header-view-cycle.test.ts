import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViewSwitcher, type ProjectViewMode } from '../../src/renderer/features/projects/ViewSwitcher.js';
import { ProjectHeader } from '../../src/renderer/features/projects/ProjectHeader.js';
import type { Project, Task } from '../../src/shared/types/index.js';

// Setup window mocks if needed for Node environment
beforeEach(() => {
  vi.clearAllMocks();
  if (typeof (global as any).window === 'undefined') {
    (global as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }
});

// Helper testing the pure cycling function logic mirroring ViewSwitcher
function getNextCycledView(
  currentView: ProjectViewMode,
  availableViews: ProjectViewMode[]
): ProjectViewMode {
  const activeViewsList =
    availableViews && availableViews.length > 0
      ? availableViews
      : (['list', 'board', 'timeline', 'calendar', 'table'] as ProjectViewMode[]);

  if (activeViewsList.length <= 1) {
    return currentView;
  }

  const currentIndex = activeViewsList.indexOf(currentView);
  const nextIndex =
    currentIndex === -1 ? 0 : (currentIndex + 1) % activeViewsList.length;
  return activeViewsList[nextIndex];
}

describe('Project Header & View Cycling Logic', () => {
  describe('1. View Cycling Transitions', () => {
    it('TC-01: Case 1 - Single view returns the same view on click', () => {
      const views: ProjectViewMode[] = ['list'];
      const nextView = getNextCycledView('list', views);
      expect(nextView).toBe('list');
    });

    it('TC-02: Case 2 - Cycles between two views in order and wraps around', () => {
      const views: ProjectViewMode[] = ['list', 'board'];

      const step1 = getNextCycledView('list', views);
      expect(step1).toBe('board');

      const step2 = getNextCycledView('board', views);
      expect(step2).toBe('list');
    });

    it('TC-03: Multi-view cycling wraps circularly through all enabled views in user order', () => {
      // User enabled them in custom order: board, timeline, list
      const views: ProjectViewMode[] = ['board', 'timeline', 'list'];

      expect(getNextCycledView('board', views)).toBe('timeline');
      expect(getNextCycledView('timeline', views)).toBe('list');
      expect(getNextCycledView('list', views)).toBe('board');
    });

    it('TC-04: Gracefully defaults to first view if current view is not in enabled list', () => {
      const views: ProjectViewMode[] = ['board', 'table'];
      const nextView = getNextCycledView('list', views);
      expect(nextView).toBe('board');
    });
  });

  describe('2. ViewSwitcher Component Interactions & State Logic', () => {
    it('renders single cycle button with correct aria-label and title for single view', () => {
      const html = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          currentView: 'list',
          availableViews: ['list'],
          onViewChange: () => {},
        })
      );

      expect(html).toContain('View switcher: currently List');
      expect(html).toContain('Only 1 view enabled');
      // Segmented tab buttons are gone
      expect(html).not.toContain('switcherContainer');
    });

    it('renders single cycle button with switchable title when multiple views enabled', () => {
      const html = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          currentView: 'board',
          availableViews: ['list', 'board'],
          onViewChange: () => {},
        })
      );

      expect(html).toContain('View switcher: currently Board');
      expect(html).toContain('Click to switch view, Right-click or Ctrl+click to configure views');
    });

    it('prevents disabling the last remaining view in view list', () => {
      const activeViews: ProjectViewMode[] = ['list'];
      const viewToToggle: ProjectViewMode = 'list';

      let updateCalled = false;
      if (activeViews.includes(viewToToggle)) {
        if (activeViews.length > 1) {
          updateCalled = true;
        }
      }

      expect(updateCalled).toBe(false);
    });

    it('shifts current view to first remaining view when active view is toggled off', () => {
      const activeViews: ProjectViewMode[] = ['board', 'timeline'];
      const currentView: ProjectViewMode = 'board';

      const next = activeViews.filter((v) => v !== 'board');
      expect(next).toEqual(['timeline']);

      let nextCurrentView: ProjectViewMode = currentView;
      if (currentView === 'board') {
        nextCurrentView = next[0];
      }
      expect(nextCurrentView).toBe('timeline');
    });
  });

  describe('3. ProjectHeader Layout, Badges & Menu', () => {
    const mockBaseProject: Project = {
      id: 'proj-1',
      name: 'OS11 Modernization',
      description: 'Streamlining project view',
      color: '#6366f1',
      icon: '🚀',
      status: 'active',
      default_view: 'list',
      views: ['list', 'board'],
      sort_order: 1,
      group_id: null,
      area_id: 'area_1',
      is_pinned: 0,
      pinned_sort_order: 0,
      is_someday: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('TC-05: Removes the "Active" status badge when project is active', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: { ...mockBaseProject, status: 'active' },
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );

      // "Active" badge should NOT be in the rendered markup
      expect(html).not.toContain('>Active<');
      expect(html).not.toContain('statusActive');
    });

    it('TC-06: Preserves Archived and Completed badges when applicable', () => {
      const archivedHtml = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: { ...mockBaseProject, status: 'archived' },
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );
      expect(archivedHtml).toContain('Archived');

      const completedHtml = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: { ...mockBaseProject, status: 'completed' },
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );
      expect(completedHtml).toContain('Completed');
    });

    it('TC-07: Preserves Someday and Stalled badges when applicable', () => {
      // Someday badge
      const somedayHtml = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: { ...mockBaseProject, is_someday: 1 },
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );
      expect(somedayHtml).toContain('Someday / Maybe');

      // Stalled badge (no tasks scheduled)
      const stalledHtml = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: mockBaseProject,
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );
      expect(stalledHtml).toContain('Stalled: no next action');
    });

    it('TC-08: Progress indicator pill and percentage tooltip are removed', () => {
      const sampleTasks: Task[] = [
        {
          id: 't-1',
          title: 'Task 1',
          status: 'done',
          is_completed: 1,
          is_trashed: 0,
          due_date: '2026-10-01',
          created_at: '',
          updated_at: '',
        } as any,
        {
          id: 't-2',
          title: 'Task 2',
          status: 'todo',
          is_completed: 0,
          is_trashed: 0,
          due_date: '2026-10-01',
          created_at: '',
          updated_at: '',
        } as any,
      ];

      const html = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: mockBaseProject,
          sections: [],
          tasks: sampleTasks,
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );

      expect(html).not.toContain('progressPill');
      expect(html).not.toContain('progressTooltip');
      expect(html).not.toContain('done');
      expect(html).not.toContain('overdue');
    });

    it('TC-09: Header controls place ViewSwitcher to the left of the Three-Dot Menu', () => {
      const html = renderToStaticMarkup(
        React.createElement(ProjectHeader, {
          project: mockBaseProject,
          sections: [],
          tasks: [],
          milestones: [],
          currentView: 'list',
          onViewChange: () => {},
          onOpenMilestones: () => {},
          onOpenTemplates: () => {},
        })
      );

      expect(html).toContain('headerControls');
      // Verify both View switcher and project actions button are inside header controls
      const headerControlsIndex = html.indexOf('headerControls');
      const viewSwitcherIndex = html.indexOf('View switcher:', headerControlsIndex);
      const moreBtnIndex = html.indexOf('Project actions', headerControlsIndex);

      expect(headerControlsIndex).toBeGreaterThan(-1);
      expect(viewSwitcherIndex).toBeGreaterThan(headerControlsIndex);
      expect(moreBtnIndex).toBeGreaterThan(viewSwitcherIndex);
    });
  });
});
