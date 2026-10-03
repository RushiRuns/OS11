import { create } from 'zustand';
import { settingsServiceAdapter } from '../services/settings-service-adapter.js';
import type { SystemInfo } from '@shared/types/settings.js';

import { useListStore } from './listStore.js';

interface AppState {
  activeListId: string;
  systemInfo: SystemInfo | null;
  isSidebarVisible: boolean;
  setActiveListId: (id: string) => void;
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  fetchSystemInfo: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  activeListId: 'smart_my_day',
  systemInfo: null,
  isSidebarVisible: true,

  setActiveListId: (id: string) => {
    set({ activeListId: id });
    useListStore.getState().setActiveList(id);
  },

  setSidebarVisible: (visible: boolean) => {
    set({ isSidebarVisible: visible });
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarVisible: !state.isSidebarVisible }));
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
