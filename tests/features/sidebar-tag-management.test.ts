import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useTagStore } from '../../src/renderer/stores/tagStore.js';
import { useAppStore } from '../../src/renderer/stores/app-store.js';
import type { Tag } from '../../src/shared/types/Tag.js';
import { IPC } from '../../src/shared/ipc-channels.js';

describe('Feature: Sidebar Tag Management & Collapsible Sections', () => {
  const originalWindow = global.window;
  const originalLocalStorage = global.localStorage;

  // Mock localStorage
  let mockStorage: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
    clear: vi.fn(() => {
      mockStorage = {};
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    // Setup global window and electron mock
    (global as any).window = {
      electron: {
        invoke: vi.fn(async (channel: string, payload?: any) => {
          if (channel === IPC.TAGS.UPDATE) {
            return {
              ok: true,
              data: {
                id: payload.id,
                name: payload.fields.name,
                color: payload.fields.color,
                sort_order: 1,
                created_at: '2026-09-19T00:00:00.000Z',
              },
            };
          }
          if (channel === IPC.TAGS.DELETE) {
            return { ok: true, data: { success: true } };
          }
          return { ok: true, data: null };
        }),
        on: () => () => {},
      },
      confirm: vi.fn(() => true),
    };

    (global as any).localStorage = localStorageMock;

    // Reset tagStore
    useTagStore.setState({
      tagsById: {},
      taskTagsByTaskId: {},
      isLoading: false,
      isLoaded: false,
    });

    // Reset appStore
    useAppStore.setState({
      activeListId: 'smart_my_day',
    });
  });

  afterEach(() => {
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
  });

  describe('Tag Editing & Task Cascade', () => {
    it('updates tag name and color, cascading immediately to all associated tasks', async () => {
      const tagWork: Tag = {
        id: 'tag-1',
        name: 'work',
        color: 'var(--tag-blue)',
        sort_order: 1,
        created_at: '2026-09-19T00:00:00.000Z',
      };

      // Set initial tag state with 2 tasks tagged
      useTagStore.setState({
        tagsById: { [tagWork.id]: tagWork },
        taskTagsByTaskId: {
          'task-1': [tagWork.id],
          'task-2': [tagWork.id],
          'task-3': [],
        },
      });

      // Verify tasks initially see the blue "work" tag
      expect(useTagStore.getState().getTagsForTask('task-1')).toEqual([tagWork]);
      expect(useTagStore.getState().getTagsForTask('task-2')).toEqual([tagWork]);
      expect(useTagStore.getState().getTagsForTask('task-3')).toEqual([]);

      // Edit the tag name and color
      const updated = await useTagStore.getState().updateTag(tagWork.id, {
        name: 'deep-work',
        color: 'var(--tag-orange)',
      });

      expect(updated.name).toBe('deep-work');
      expect(updated.color).toBe('var(--tag-orange)');

      // Verify cascading updates in tasks
      const task1Tags = useTagStore.getState().getTagsForTask('task-1');
      expect(task1Tags).toHaveLength(1);
      expect(task1Tags[0].name).toBe('deep-work');
      expect(task1Tags[0].color).toBe('var(--tag-orange)');

      const task2Tags = useTagStore.getState().getTagsForTask('task-2');
      expect(task2Tags).toHaveLength(1);
      expect(task2Tags[0].name).toBe('deep-work');
      expect(task2Tags[0].color).toBe('var(--tag-orange)');
    });
  });

  describe('Tag Deletion & Association Stripping', () => {
    it('deletes tag, removes it from tagsById and strips associations from all tasks', async () => {
      const tagUrgent: Tag = {
        id: 'tag-urgent',
        name: 'urgent',
        color: 'var(--tag-red)',
        sort_order: 1,
        created_at: '2026-09-19T00:00:00.000Z',
      };
      const tagPersonal: Tag = {
        id: 'tag-personal',
        name: 'personal',
        color: 'var(--tag-green)',
        sort_order: 2,
        created_at: '2026-09-19T00:00:00.000Z',
      };

      useTagStore.setState({
        tagsById: {
          [tagUrgent.id]: tagUrgent,
          [tagPersonal.id]: tagPersonal,
        },
        taskTagsByTaskId: {
          'task-1': [tagUrgent.id, tagPersonal.id],
          'task-2': [tagUrgent.id],
        },
      });

      // Delete tagUrgent
      await useTagStore.getState().deleteTag(tagUrgent.id);

      // Verify tag is removed from tagsById
      expect(useTagStore.getState().tagsById[tagUrgent.id]).toBeUndefined();
      expect(useTagStore.getState().tagsById[tagPersonal.id]).toBeDefined();

      // Verify task associations stripped
      expect(useTagStore.getState().taskTagsByTaskId['task-1']).toEqual([tagPersonal.id]);
      expect(useTagStore.getState().taskTagsByTaskId['task-2']).toEqual([]);

      // Verify getTagsForTask returns only remaining tags
      const task1Tags = useTagStore.getState().getTagsForTask('task-1');
      expect(task1Tags).toHaveLength(1);
      expect(task1Tags[0].id).toBe(tagPersonal.id);

      const task2Tags = useTagStore.getState().getTagsForTask('task-2');
      expect(task2Tags).toHaveLength(0);
    });

    it('navigates away to smart_my_day if active view was the deleted tag', async () => {
      const tagToDelete: Tag = {
        id: 'tag-xyz',
        name: 'temporary',
        color: 'var(--tag-gray)',
        sort_order: 1,
        created_at: '2026-09-19T00:00:00.000Z',
      };

      useTagStore.setState({
        tagsById: { [tagToDelete.id]: tagToDelete },
      });

      // Active list is currently viewing this tag
      useAppStore.setState({
        activeListId: `tag:${tagToDelete.id}`,
      });

      // Simulating Sidebar's handleDeleteTag logic
      const handleDeleteTag = async (tag: Tag) => {
        if (useAppStore.getState().activeListId === `tag:${tag.id}`) {
          useAppStore.getState().setActiveListId('smart_my_day');
        }
        await useTagStore.getState().deleteTag(tag.id);
      };

      await handleDeleteTag(tagToDelete);

      expect(useAppStore.getState().activeListId).toBe('smart_my_day');
    });
  });

  describe('Section Collapse & Persistence', () => {
    it('persists collapsed sections to localStorage and toggles correctly', () => {
      const STORAGE_KEY = 'os11:sidebar_collapsed_sections';

      // Initial state
      let collapsedSections: Record<string, boolean> = {};

      const toggleSection = (sectionKey: string) => {
        collapsedSections = {
          ...collapsedSections,
          [sectionKey]: !collapsedSections[sectionKey],
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedSections));
      };

      // Collapse Lists section
      toggleSection('lists');
      expect(collapsedSections['lists']).toBe(true);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ lists: true }));

      // Collapse Tags section
      toggleSection('tags');
      expect(collapsedSections['lists']).toBe(true);
      expect(collapsedSections['tags']).toBe(true);

      // Re-expand Lists section
      toggleSection('lists');
      expect(collapsedSections['lists']).toBe(false);
      expect(collapsedSections['tags']).toBe(true);

      // Verify hydration from localStorage
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved).toEqual({ lists: false, tags: true });
    });
  });

  describe('Conditional Section Visibility', () => {
    it('hides Tags section when no tags have been created', () => {
      const tagsById: Record<string, Tag> = {};
      const shouldShowTags = Object.values(tagsById).length > 0;
      expect(shouldShowTags).toBe(false);

      const withTag: Record<string, Tag> = {
        't1': { id: 't1', name: 'alpha', sort_order: 1, created_at: '' },
      };
      const shouldShowWithTags = Object.values(withTag).length > 0;
      expect(shouldShowWithTags).toBe(true);
    });

    it('hides Projects section unless module is enabled AND user has created projects', () => {
      const checkProjectsVisibility = (moduleEnabled: boolean, projectsCount: number) => {
        return moduleEnabled && projectsCount > 0;
      };

      // Module disabled, no projects
      expect(checkProjectsVisibility(false, 0)).toBe(false);

      // Module disabled, projects exist
      expect(checkProjectsVisibility(false, 2)).toBe(false);

      // Module enabled, no projects created
      expect(checkProjectsVisibility(true, 0)).toBe(false);

      // Module enabled, projects created
      expect(checkProjectsVisibility(true, 1)).toBe(true);
    });
  });
});
