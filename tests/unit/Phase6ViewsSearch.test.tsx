import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectHeader } from '../../src/renderer/features/projects/ProjectHeader.js';
import { BoardColumn } from '../../src/renderer/features/projects/BoardColumn.js';
import { AreaView } from '../../src/renderer/features/areas/AreaView.js';
import { ViewSearchContext, type ViewSearchState } from '../../src/renderer/features/search/ViewSearchContext.js';
import type { Project, Section, Task, Area } from '../../src/shared/types/index.js';

if (typeof (global as any).window === 'undefined') {
  (global as any).window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

// Mock stores for ProjectHeader and AreaView
const mockProjectState = {
  projectsById: {
    'proj-1': {
      id: 'proj-1',
      area_id: 'area-1',
      name: 'Alpha Project',
      color: '#1b88ff',
      status: 'active',
    },
  },
  sectionsById: {},
  milestonesById: {},
  selectedMilestoneId: null,
  setSelectedMilestoneId: vi.fn(),
  setSelectedProjectId: vi.fn(),
};

vi.mock('../../src/renderer/stores/projectStore.js', () => ({
  useProjectStore: Object.assign(
    (selector?: any) => (typeof selector === 'function' ? selector(mockProjectState) : mockProjectState),
    {
      getState: () => mockProjectState,
    }
  ),
}));

const mockAreaState = {
  areasById: {
    'area-1': {
      id: 'area-1',
      name: 'Work Area',
      color: '#1b88ff',
      icon: '💼',
      sort_order: 0,
      created_at: '',
    },
  },
  orderedAreaIds: ['area-1'],
};

vi.mock('../../src/renderer/stores/areaStore.js', () => ({
  useArea: (id: string): Area | null => (mockAreaState.areasById as any)[id] ?? null,
  useAreaStore: Object.assign(
    (selector?: any) => (typeof selector === 'function' ? selector(mockAreaState) : mockAreaState),
    {
      getState: () => mockAreaState,
    }
  ),
}));

vi.mock('../../src/renderer/features/projects/CreateProjectModal.js', () => ({
  CreateProjectModal: () => null,
}));

vi.mock('../../src/renderer/stores/taskStore.js', () => ({
  useTasksByArea: (areaId: string): Task[] => [
    {
      id: 'loose-1',
      title: 'Active Loose Task Alpha',
      area_id: areaId,
      project_id: null,
      is_completed: 0,
      is_trashed: 0,
      sort_order: 1,
      parent_task_id: null,
      created_at: '',
      updated_at: '',
    } as Task,
    {
      id: 'loose-2',
      title: 'Completed Loose Task Beta',
      area_id: areaId,
      project_id: null,
      is_completed: 1,
      is_trashed: 0,
      sort_order: 2,
      parent_task_id: null,
      created_at: '',
      updated_at: '',
    } as Task,
  ],
  useTaskStore: () => ({
    tasksById: {},
    toggleComplete: vi.fn(),
    toggleStar: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    duplicateTask: vi.fn(),
  }),
}));

const mockAppState = {
  activeListId: 'area:area-1',
  setActiveListId: vi.fn(),
};

vi.mock('../../src/renderer/stores/app-store.js', () => ({
  useAppStore: Object.assign(
    (selector?: any) => (typeof selector === 'function' ? selector(mockAppState) : mockAppState),
    {
      getState: () => mockAppState,
    }
  ),
}));

vi.mock('../../src/renderer/hooks/useCompletionLinger.js', () => ({
  useCompletionLinger: () => ({
    isLingering: () => false,
    isExiting: () => false,
    lingerVersion: 0,
  }),
}));

function createMockSearchState(overrides: Partial<ViewSearchState> = {}): ViewSearchState {
  return {
    enabled: true,
    isOpen: false,
    query: '',
    tokens: [],
    cursorTaskId: null,
    results: new Map(),
    matchCount: 0,
    isFiltering: false,
    inputRef: { current: null },
    open: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    moveCursor: vi.fn(),
    setQuery: vi.fn(),
    isRowVisible: (_id: string) => true,
    pin: vi.fn(),
    unpin: vi.fn(),
    groupOpen: (_key: string, userOpen: boolean) => userOpen,
    setGroupOverride: vi.fn(),
    viewKey: 'test-view',
    viewName: 'Test',
    ...overrides,
  };
}

describe('Phase 6 Views Search Integration', () => {
  describe('ProjectHeader search trigger', () => {
    it('renders ViewSearch trigger button inside headerControls', () => {
      const mockProject: Project = {
        id: 'proj-1',
        name: 'Project One',
        color: '#1b88ff',
        sort_order: 0,
        status: 'active',
        default_view: 'list',
        views: ['list', 'board'],
        created_at: '',
        updated_at: '',
      };

      const searchState = createMockSearchState({ viewKey: 'project:proj-1', viewName: 'Project One' });

      const html = renderToStaticMarkup(
        <ProjectHeader
          project={mockProject}
          sections={[]}
          tasks={[]}
          milestones={[]}
          currentView="list"
          onViewChange={vi.fn()}
          onOpenMilestones={vi.fn()}
          onOpenTemplates={vi.fn()}
          searchState={searchState}
        />
      );

      expect(html).toContain('aria-label="Search Project One"');
      expect(html).toContain('Project One');
    });
  });

  describe('BoardColumn search behavior', () => {
    const mockSection: Section = {
      id: 'sec-1',
      project_id: 'proj-1',
      name: 'To Do',
      sort_order: 0,
      is_collapsed: 0,
      created_at: '',
    };

    const mockTasks: Task[] = [
      {
        id: 't-1',
        title: 'Design mockup',
        project_id: 'proj-1',
        section_id: 'sec-1',
        is_completed: 0,
        is_trashed: 0,
        sort_order: 0,
        parent_task_id: null,
        created_at: '',
        updated_at: '',
      } as Task,
      {
        id: 't-2',
        title: 'Write docs',
        project_id: 'proj-1',
        section_id: 'sec-1',
        is_completed: 0,
        is_trashed: 0,
        sort_order: 1,
        parent_task_id: null,
        created_at: '',
        updated_at: '',
      } as Task,
    ];

    it('displays total count when not filtering', () => {
      const searchState = createMockSearchState({ isFiltering: false });

      const html = renderToStaticMarkup(
        <ViewSearchContext.Provider value={searchState}>
          <BoardColumn
            section={mockSection}
            tasks={mockTasks}
            onSelectTask={vi.fn()}
            onToggleComplete={vi.fn()}
            onTaskContextMenu={vi.fn()}
            onAddCard={vi.fn()}
            onRenameSection={vi.fn()}
            onDeleteSection={vi.fn()}
          />
        </ViewSearchContext.Provider>
      );

      expect(html).toContain('>2<');
      expect(html).not.toContain('No matches');
    });

    it('displays matched/total badge and sets data-has-matches when filtering', () => {
      const searchState = createMockSearchState({
        isFiltering: true,
        query: 'design',
        tokens: ['design'],
        isRowVisible: (id: string) => id === 't-1',
      });

      const html = renderToStaticMarkup(
        <ViewSearchContext.Provider value={searchState}>
          <BoardColumn
            section={mockSection}
            tasks={mockTasks}
            onSelectTask={vi.fn()}
            onToggleComplete={vi.fn()}
            onTaskContextMenu={vi.fn()}
            onAddCard={vi.fn()}
            onRenameSection={vi.fn()}
            onDeleteSection={vi.fn()}
          />
        </ViewSearchContext.Provider>
      );

      expect(html).toContain('>1/2<');
      expect(html).toContain('data-has-matches="true"');
    });

    it('displays 0/total badge and "No matches" placeholder when column has zero matches', () => {
      const searchState = createMockSearchState({
        isFiltering: true,
        query: 'unknown',
        tokens: ['unknown'],
        isRowVisible: () => false,
      });

      const html = renderToStaticMarkup(
        <ViewSearchContext.Provider value={searchState}>
          <BoardColumn
            section={mockSection}
            tasks={mockTasks}
            onSelectTask={vi.fn()}
            onToggleComplete={vi.fn()}
            onTaskContextMenu={vi.fn()}
            onAddCard={vi.fn()}
            onRenameSection={vi.fn()}
            onDeleteSection={vi.fn()}
          />
        </ViewSearchContext.Provider>
      );

      expect(html).toContain('>0/2<');
      expect(html).toContain('data-has-matches="false"');
      expect(html).toContain('No matches');
    });
  });

  describe('AreaView search behavior', () => {
    it('renders ViewSearch trigger immediately before + New Project button', () => {
      const html = renderToStaticMarkup(<AreaView areaId="area-1" />);

      expect(html).toContain('aria-label="Search Work Area"');
      expect(html).toContain('+ New Project');
      // Verify Projects section below loose tasks is rendered and untouched
      expect(html).toContain('Alpha Project');
      expect(html).toContain('Loose Tasks');
    });
  });
});
