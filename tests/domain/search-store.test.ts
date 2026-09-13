import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSearchStore } from '../../src/renderer/stores/searchStore.js';
import { ipc } from '../../src/renderer/services/ipc.js';
import { IPC } from '../../src/shared/ipc-channels.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

describe('Domain: Search Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({
      isOpen: false,
      query: '',
      results: [],
      isLoading: false,
      selectedIndex: 0,
    });
  });

  it('opens and closes search state correctly', () => {
    expect(useSearchStore.getState().isOpen).toBe(false);

    useSearchStore.getState().openSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);

    useSearchStore.getState().closeSearch();
    expect(useSearchStore.getState().isOpen).toBe(false);
    expect(useSearchStore.getState().query).toBe('');
    expect(useSearchStore.getState().results).toEqual([]);
  });

  it('toggles search state', () => {
    useSearchStore.getState().toggleSearch();
    expect(useSearchStore.getState().isOpen).toBe(true);

    useSearchStore.getState().toggleSearch();
    expect(useSearchStore.getState().isOpen).toBe(false);
  });

  it('updates query and selected index', async () => {
    vi.mocked(ipc.invoke).mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 'task-1', title: 'Task 1', snippet: '<mark>Task</mark> 1', listId: 'list_inbox' },
        { id: 'task-2', title: 'Task 2', snippet: '<mark>Task</mark> 2', listId: 'list_inbox' },
      ],
    });

    await useSearchStore.getState().setQuery('Task');
    expect(useSearchStore.getState().query).toBe('Task');

    // Wait for debounced timer
    await new Promise((r) => setTimeout(r, 150));

    expect(ipc.invoke).toHaveBeenCalledWith(IPC.SEARCH.QUERY, 'Task');
    expect(useSearchStore.getState().results).toHaveLength(2);

    useSearchStore.getState().setSelectedIndex(1);
    expect(useSearchStore.getState().selectedIndex).toBe(1);
  });

  it('clears query and results', () => {
    useSearchStore.setState({
      query: 'something',
      results: [{ id: '1', title: 'test', snippet: 'test', listId: 'inbox' }],
      selectedIndex: 2,
    });

    useSearchStore.getState().clear();
    expect(useSearchStore.getState().query).toBe('');
    expect(useSearchStore.getState().results).toEqual([]);
    expect(useSearchStore.getState().selectedIndex).toBe(0);
  });
});
