import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Attachment } from '@shared/types/index.js';

export interface AttachmentStoreState {
  countsByTaskId: Record<string, number>;
  everyAttachment: Attachment[];
  loading: boolean;
  loadCounts: () => Promise<void>;
  loadEveryAttachment: () => Promise<Attachment[]>;
  setCount: (taskId: string, count: number) => void;
  incrementCount: (taskId: string, delta?: number) => void;
}

export const useAttachmentStore = create<AttachmentStoreState>((set) => ({
  countsByTaskId: {},
  everyAttachment: [],
  loading: false,

  loadCounts: async () => {
    try {
      const counts = await ipc.invoke<Record<string, number>>(IPC.ATTACHMENTS.GET_COUNTS);
      set({ countsByTaskId: counts || {} });
    } catch {
      // best-effort
    }
  },

  loadEveryAttachment: async () => {
    try {
      const items = await ipc.invoke<Attachment[]>(IPC.ATTACHMENTS.GET_EVERY_ATTACHMENT);
      set({ everyAttachment: items || [] });
      return items || [];
    } catch {
      return [];
    }
  },

  setCount: (taskId: string, count: number) => {
    set((state) => ({
      countsByTaskId: {
        ...state.countsByTaskId,
        [taskId]: count,
      },
    }));
  },

  incrementCount: (taskId: string, delta = 1) => {
    set((state) => ({
      countsByTaskId: {
        ...state.countsByTaskId,
        [taskId]: Math.max(0, (state.countsByTaskId[taskId] ?? 0) + delta),
      },
    }));
  },
}));

export default useAttachmentStore;
