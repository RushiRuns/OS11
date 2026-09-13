import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { NotificationHistoryItem } from '@shared/types/NotificationHistoryItem.js';

interface NotificationState {
  items: NotificationHistoryItem[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;

  // Actions
  loadNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearHistory: () => Promise<void>;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,

  loadNotifications: async () => {
    set({ isLoading: true });
    try {
      const items = await ipc.invoke<NotificationHistoryItem[]>(IPC.NOTIFICATIONS.GET_HISTORY);
      const unreadCount = items.filter((item) => !item.read_at).length;
      set({ items, unreadCount, isLoading: false });
    } catch (err) {
      console.error('Failed to load notification history:', err);
      set({ isLoading: false });
    }
  },

  markRead: async (id: string) => {
    const existing = get().items.find((item) => item.id === id);
    if (!existing || existing.read_at) return;

    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, read_at: now } : item
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await ipc.invoke(IPC.NOTIFICATIONS.MARK_READ, id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAllRead: async () => {
    const now = new Date().toISOString();
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read_at: item.read_at ?? now })),
      unreadCount: 0,
    }));

    try {
      await ipc.invoke(IPC.NOTIFICATIONS.MARK_ALL_READ);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },

  clearHistory: async () => {
    set({ items: [], unreadCount: 0 });
    try {
      await ipc.invoke(IPC.NOTIFICATIONS.CLEAR);
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  },

  setOpen: (open: boolean) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
}));

export default useNotificationStore;
