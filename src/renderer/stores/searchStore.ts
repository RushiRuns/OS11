import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { SearchResult } from '@shared/types/search.js';

interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  selectedIndex: number;

  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  setQuery: (query: string) => Promise<void>;
  setSelectedIndex: (idx: number) => void;
  clear: () => void;
}

let searchTimer: NodeJS.Timeout | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  query: '',
  results: [],
  isLoading: false,
  selectedIndex: 0,

  openSearch: () => set({ isOpen: true }),
  closeSearch: () => set({ isOpen: false, query: '', results: [], selectedIndex: 0 }),
  toggleSearch: () => {
    const current = get().isOpen;
    if (current) {
      set({ isOpen: false, query: '', results: [], selectedIndex: 0 });
    } else {
      set({ isOpen: true });
    }
  },

  setQuery: async (query: string) => {
    set({ query, selectedIndex: 0 });

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      set({ results: [], isLoading: false });
      return;
    }

    set({ isLoading: true });

    searchTimer = setTimeout(async () => {
      try {
        const res = await ipc.invoke<{ ok: boolean; data: SearchResult[] }>(
          IPC.SEARCH.QUERY,
          trimmed
        );

        const list = res && Array.isArray(res.data) ? res.data : Array.isArray(res) ? (res as SearchResult[]) : [];
        set({ results: list, isLoading: false });
      } catch (err) {
        console.error('[searchStore] Search query failed:', err);
        set({ results: [], isLoading: false });
      }
    }, 100);
  },

  setSelectedIndex: (selectedIndex: number) => set({ selectedIndex }),

  clear: () => set({ query: '', results: [], selectedIndex: 0, isLoading: false }),
}));
