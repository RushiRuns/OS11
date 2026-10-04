import { create } from 'zustand';
import { invoke } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { GtdCounts } from '@shared/types/index.js';

interface CountsState {
  counts: GtdCounts;
  loadCounts: (today?: string) => Promise<void>;
  setCounts: (newCounts: Partial<GtdCounts>) => void;
}

const DEFAULT_COUNTS: GtdCounts = {
  inbox: 0,
  anytime: 0,
  someday: 0,
  waitingFor: 0,
  waitingOverdue: 0,
  stalledProjects: 0,
};

export const useCountsStore = create<CountsState>((set) => ({
  counts: { ...DEFAULT_COUNTS },

  loadCounts: async (today?: string) => {
    try {
      const data = await invoke<GtdCounts>(IPC.TASKS.GET_GTD_COUNTS, today);
      if (data) {
        set({ counts: data });
      }
    } catch (err) {
      console.error('[CountsStore] Failed to load GTD counts:', err);
    }
  },

  setCounts: (newCounts: Partial<GtdCounts>) => {
    set((state) => ({
      counts: {
        ...state.counts,
        ...newCounts,
      },
    }));
  },
}));

export default useCountsStore;
