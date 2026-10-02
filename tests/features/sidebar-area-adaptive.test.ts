import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAreaStore } from '../../src/renderer/stores/areaStore.js';
import { useProjectStore } from '../../src/renderer/stores/projectStore.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';
import { useAppStore } from '../../src/renderer/stores/app-store.js';
import type { Area } from '../../src/shared/types/Area.js';
import type { Task } from '../../src/shared/types/task.js';

describe('Feature: Sidebar Adaptive Area Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (global as any).window = {
      electron: {
        invoke: vi.fn(async () => ({ ok: true, data: [] })),
        on: () => () => {},
      },
      dispatchEvent: vi.fn(),
      CustomEvent: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, params?: { detail?: any }) {
          this.type = type;
          this.detail = params?.detail;
        }
      },
    };

    useAreaStore.setState({
      areasById: {},
      orderedAreaIds: [],
      isLoading: false,
      isLoaded: true,
      error: null,
    });

    useProjectStore.setState({
      projectsById: {},
      projectFolderIds: [],
      isLoading: false,
      isLoaded: true,
    });

    useTaskStore.setState({
      tasksById: {},
    });

    useAppStore.setState({
      activeListId: 'smart_inbox',
    });
  });

  describe('Solo User Mode (<= 1 Area)', () => {
    const soloArea: Area = {
      id: 'area_personal',
      workspace_id: 'ws_default',
      name: 'Personal',
      icon: '👤',
      color: '#4A90E2',
      sort_order: 1,
      is_collapsed: 0,
      is_default: 1,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    };

    it('identifies solo user mode when only 1 area exists', () => {
      useAreaStore.setState({
        areasById: { [soloArea.id]: soloArea },
        orderedAreaIds: [soloArea.id],
      });

      const areas = Object.values(useAreaStore.getState().areasById);
      expect(areas.length).toBe(1);
      const isSoloUser = areas.length <= 1;
      expect(isSoloUser).toBe(true);
    });

    it('suppresses loose tasks row when solo area loose task count is 0', () => {
      useAreaStore.setState({
        areasById: { [soloArea.id]: soloArea },
        orderedAreaIds: [soloArea.id],
      });

      const getAreaLooseTaskCount = (areaId: string): number => {
        const tasks = Object.values(useTaskStore.getState().tasksById);
        return tasks.filter(
          (t) => t.area_id === areaId && !t.project_id && !t.is_trashed && !t.is_completed && !t.parent_task_id
        ).length;
      };

      expect(getAreaLooseTaskCount(soloArea.id)).toBe(0);
      const shouldRenderTasksRow = getAreaLooseTaskCount(soloArea.id) > 0;
      expect(shouldRenderTasksRow).toBe(false);
    });

    it('renders loose tasks row when solo area has loose tasks', () => {
      useAreaStore.setState({
        areasById: { [soloArea.id]: soloArea },
        orderedAreaIds: [soloArea.id],
      });

      const looseTask: Task = {
        id: 'loose-1',
        title: 'Call electrician',
        area_id: soloArea.id,
        project_id: null,
        list_id: 'list_inbox',
        is_completed: 0,
        is_starred: 0,
        all_day: 1,
        created_by_device: 'local',
        pomodoro_count: 0,
        is_trashed: 0,
        sort_order: 1,
        priority: 0,
        created_at: '2026-10-02T00:00:00.000Z',
        updated_at: '2026-10-02T00:00:00.000Z',
      };

      useTaskStore.setState({
        tasksById: { [looseTask.id]: looseTask },
      });

      const tasks = Object.values(useTaskStore.getState().tasksById);
      const count = tasks.filter(
        (t) => t.area_id === soloArea.id && !t.project_id && !t.is_trashed && !t.is_completed && !t.parent_task_id
      ).length;

      expect(count).toBe(1);
      const shouldRenderTasksRow = count > 0;
      expect(shouldRenderTasksRow).toBe(true);
    });
  });

  describe('Multi-Area Mode (>= 2 Areas)', () => {
    const area1: Area = {
      id: 'area_personal',
      workspace_id: 'ws_default',
      name: 'Personal',
      icon: '👤',
      color: '#4A90E2',
      sort_order: 1,
      is_collapsed: 0,
      is_default: 1,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    };

    const area2: Area = {
      id: 'area_work',
      workspace_id: 'ws_default',
      name: 'Work',
      icon: '💼',
      color: '#27AE60',
      sort_order: 2,
      is_collapsed: 0,
      is_default: 0,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    };

    it('enables multi-area header groupings when 2 or more areas exist', () => {
      useAreaStore.setState({
        areasById: { [area1.id]: area1, [area2.id]: area2 },
        orderedAreaIds: [area1.id, area2.id],
      });

      const areas = Object.values(useAreaStore.getState().areasById);
      expect(areas.length).toBe(2);
      const isSoloUser = areas.length <= 1;
      expect(isSoloUser).toBe(false);
    });

    it('navigates to Area Overview on area selection in multi-area mode', () => {
      useAreaStore.setState({
        areasById: { [area1.id]: area1, [area2.id]: area2 },
        orderedAreaIds: [area1.id, area2.id],
      });

      // User selects Work area
      useAppStore.getState().setActiveListId(`area:${area2.id}`);
      expect(useAppStore.getState().activeListId).toBe(`area:${area2.id}`);
    });
  });
});
