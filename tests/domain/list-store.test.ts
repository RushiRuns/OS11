import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useListStore } from '../../src/renderer/stores/listStore.js';
import { listServiceAdapter } from '../../src/renderer/services/list-service-adapter.js';
import type { List } from '../../src/shared/types/List.js';

vi.mock('../../src/renderer/services/list-service-adapter.js', () => ({
  listServiceAdapter: {
    getAll: vi.fn(),
    getAllGroups: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
  },
}));

describe('Domain: List Store & Smart Lists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useListStore.setState({
      listsById: {
        smart_my_day: {
          id: 'smart_my_day',
          name: 'My Day',
          icon: '☀️',
          color: null,
          background_type: 'none',
          background_value: null,
          sort_order: 0,
          is_smart: 1,
          smart_type: 'my_day',
          group_id: null,
          notification_enabled: 1,
          created_at: '2026-09-13T00:00:00.000Z',
          updated_at: '2026-09-13T00:00:00.000Z',
        },
        list_inbox: {
          id: 'list_inbox',
          name: 'Inbox',
          icon: '📥',
          color: null,
          background_type: 'none',
          background_value: null,
          sort_order: 1,
          is_smart: 0,
          smart_type: null,
          group_id: null,
          notification_enabled: 1,
          created_at: '2026-09-13T00:00:00.000Z',
          updated_at: '2026-09-13T00:00:00.000Z',
        },
      },
      orderedIds: ['smart_my_day', 'list_inbox'],
      activeListId: 'smart_my_day',
      isLoading: false,
      error: null,
    });
  });

  it('should prevent deleting built-in smart lists', async () => {
    const store = useListStore.getState();
    await expect(store.deleteList('smart_my_day')).rejects.toThrow(
      'Cannot delete built-in smart lists.'
    );
    expect(useListStore.getState().listsById['smart_my_day']).toBeDefined();
  });

  it('should create a custom user list optimistically', async () => {
    const mockCreated: List = {
      id: 'list_work',
      name: 'Work Projects',
      icon: '💼',
      color: '#1B88FF',
      background_type: 'none',
      background_value: null,
      sort_order: 2,
      is_smart: 0,
      smart_type: null,
      group_id: null,
      notification_enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(listServiceAdapter.create).mockResolvedValueOnce(mockCreated);

    const store = useListStore.getState();
    const result = await store.createList({
      name: 'Work Projects',
      icon: '💼',
      color: '#1B88FF',
    });

    expect(result.id).toBe('list_work');
    expect(useListStore.getState().listsById['list_work']).toBeDefined();
    expect(useListStore.getState().orderedIds).toContain('list_work');
  });

  it('should update list attributes with rollback on failure', async () => {
    vi.mocked(listServiceAdapter.update).mockRejectedValueOnce(new Error('IPC network failure'));

    const store = useListStore.getState();
    await expect(
      store.updateList('list_inbox', { name: 'Renamed Inbox' })
    ).rejects.toThrow('IPC network failure');

    // Verified rollback to original name
    expect(useListStore.getState().listsById['list_inbox'].name).toBe('Inbox');
  });

  it('should delete custom user list and switch active list if needed', async () => {
    vi.mocked(listServiceAdapter.delete).mockResolvedValueOnce(true);

    useListStore.setState({ activeListId: 'list_inbox' });
    const store = useListStore.getState();

    const success = await store.deleteList('list_inbox');
    expect(success).toBe(true);
    expect(useListStore.getState().listsById['list_inbox']).toBeUndefined();
    expect(useListStore.getState().orderedIds).not.toContain('list_inbox');
    // Active list switched back to safe default (smart_my_day)
    expect(useListStore.getState().activeListId).toBe('smart_my_day');
  });
});
