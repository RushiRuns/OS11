import { create } from 'zustand';
import { settingsServiceAdapter } from '../services/settings-service-adapter.js';
import type { SystemInfo } from '@shared/types/settings.js';

import { useListStore } from './listStore.js';

interface AppState {
  activeListId: string;
  systemInfo: SystemInfo | null;
  setActiveListId: (id: string) => void;
  fetchSystemInfo: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  activeListId: 'smart_my_day',
  systemInfo: null,

  setActiveListId: (id: string) => {
    set({ activeListId: id });
    useListStore.getState().setActiveList(id);
  },

  fetchSystemInfo: async () => {
    try {
      const systemInfo = await settingsServiceAdapter.getSystemInfo();
      set({ systemInfo });
    } catch {
      // Graceful fallback
    }
  },
}));
