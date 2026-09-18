import { create } from 'zustand';
import type { List, CreateListPayload, UpdateListPayload } from '@shared/types/List.js';
import type { ListGroup, CreateListGroupPayload, UpdateListGroupPayload } from '@shared/types/ListGroup.js';
import { listServiceAdapter } from '../services/list-service-adapter.js';

export interface ListStoreState {
  listsById: Record<string, List>;
  orderedIds: string[];
  listGroupsById: Record<string, ListGroup>;
  orderedGroupIds: string[];
  activeListId: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLists: () => Promise<void>;
  setActiveList: (id: string) => void;
  createList: (payload: CreateListPayload) => Promise<List>;
  updateList: (id: string, fields: UpdateListPayload) => Promise<List>;
  deleteList: (id: string) => Promise<boolean>;
  reorderLists: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;

  // Group Actions
  createGroup: (payload: CreateListGroupPayload) => Promise<ListGroup>;
  updateGroup: (id: string, fields: UpdateListGroupPayload) => Promise<ListGroup>;
  deleteGroup: (id: string) => Promise<boolean>;
}

// Fallback seed lists if DB loading fails
const DEFAULT_SMART_LISTS: List[] = [
  {
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
    is_pinned: 1,
    pinned_sort_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'smart_important',
    name: 'Important',
    icon: '⭐',
    color: null,
    background_type: 'none',
    background_value: null,
    sort_order: 1,
    is_smart: 1,
    smart_type: 'important',
    group_id: null,
    notification_enabled: 1,
    is_pinned: 1,
    pinned_sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'smart_planned',
    name: 'Planned',
    icon: '📅',
    color: null,
    background_type: 'none',
    background_value: null,
    sort_order: 2,
    is_smart: 1,
    smart_type: 'planned',
    group_id: null,
    notification_enabled: 1,
    is_pinned: 1,
    pinned_sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'smart_all',
    name: 'All Tasks',
    icon: '📋',
    color: null,
    background_type: 'none',
    background_value: null,
    sort_order: 3,
    is_smart: 1,
    smart_type: 'all',
    group_id: null,
    notification_enabled: 1,
    is_pinned: 1,
    pinned_sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'smart_completed',
    name: 'Completed',
    icon: '✅',
    color: null,
    background_type: 'none',
    background_value: null,
    sort_order: 4,
    is_smart: 1,
    smart_type: 'completed',
    group_id: null,
    notification_enabled: 1,
    is_pinned: 1,
    pinned_sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'list_inbox',
    name: 'Inbox',
    icon: '📥',
    color: null,
    background_type: 'none',
    background_value: null,
    sort_order: 5,
    is_smart: 0,
    smart_type: null,
    group_id: null,
    notification_enabled: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialListsById: Record<string, List> = {};
const initialOrderedIds: string[] = [];
for (const item of DEFAULT_SMART_LISTS) {
  initialListsById[item.id] = item;
  initialOrderedIds.push(item.id);
}

export const useListStore = create<ListStoreState>((set, get) => ({
  listsById: initialListsById,
  orderedIds: initialOrderedIds,
  listGroupsById: {},
  orderedGroupIds: [],
  activeListId: 'smart_my_day',
  isLoading: false,
  error: null,

  setActiveList: (id: string) => {
    set({ activeListId: id });
  },

  loadLists: async () => {
    set({ isLoading: true, error: null });
    try {
      const [fetchedLists, fetchedGroups] = await Promise.all([
        listServiceAdapter.getAll(),
        listServiceAdapter.getAllGroups().catch(() => [] as ListGroup[]),
      ]);

      const listsById: Record<string, List> = {};
      const sortedLists = [...fetchedLists].sort((a, b) => a.sort_order - b.sort_order);
      const orderedIds = sortedLists.map((l) => {
        listsById[l.id] = l;
        return l.id;
      });

      const listGroupsById: Record<string, ListGroup> = {};
      const sortedGroups = [...fetchedGroups].sort((a, b) => a.sort_order - b.sort_order);
      const orderedGroupIds = sortedGroups.map((g) => {
        listGroupsById[g.id] = g;
        return g.id;
      });

      set({
        listsById,
        orderedIds,
        listGroupsById,
        orderedGroupIds,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  createList: async (payload: CreateListPayload): Promise<List> => {
    // Generate optimistic placeholder
    const tempId = payload.id ?? `list_${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: List = {
      id: tempId,
      name: payload.name,
      icon: payload.icon ?? '📁',
      color: payload.color ?? null,
      background_type: payload.background_type ?? 'none',
      background_value: payload.background_value ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      is_smart: payload.is_smart ? 1 : 0,
      smart_type: payload.smart_type ?? null,
      group_id: payload.group_id ?? null,
      notification_enabled: payload.notification_enabled !== false ? 1 : 0,
      is_pinned:
        payload.is_pinned !== undefined
          ? typeof payload.is_pinned === 'boolean'
            ? payload.is_pinned ? 1 : 0
            : payload.is_pinned
          : 0,
      pinned_sort_order: payload.pinned_sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };

    set((state) => ({
      listsById: { ...state.listsById, [tempId]: optimistic },
      orderedIds: [...state.orderedIds, tempId],
    }));

    try {
      const realList = await listServiceAdapter.create(payload);
      set((state) => {
        const nextMap = { ...state.listsById };
        delete nextMap[tempId];
        nextMap[realList.id] = realList;

        const nextOrdered = state.orderedIds.map((id) => (id === tempId ? realList.id : id));
        return {
          listsById: nextMap,
          orderedIds: nextOrdered,
          activeListId: state.activeListId === tempId ? realList.id : state.activeListId,
        };
      });
      return realList;
    } catch (err) {
      // Rollback
      set((state) => {
        const nextMap = { ...state.listsById };
        delete nextMap[tempId];
        return {
          listsById: nextMap,
          orderedIds: state.orderedIds.filter((id) => id !== tempId),
        };
      });
      throw err;
    }
  },

  updateList: async (id: string, fields: UpdateListPayload): Promise<List> => {
    const existing = get().listsById[id];
    if (!existing) {
      throw new Error(`List ${id} not found.`);
    }

    const previousSnapshot: List = { ...existing };
    const optimistic: List = {
      ...existing,
      ...fields,
      notification_enabled:
        fields.notification_enabled !== undefined
          ? typeof fields.notification_enabled === 'boolean'
            ? fields.notification_enabled ? 1 : 0
            : fields.notification_enabled
          : existing.notification_enabled,
      is_pinned:
        fields.is_pinned !== undefined
          ? typeof fields.is_pinned === 'boolean'
            ? fields.is_pinned ? 1 : 0
            : fields.is_pinned
          : existing.is_pinned ?? 0,
      pinned_sort_order:
        fields.pinned_sort_order !== undefined
          ? fields.pinned_sort_order
          : existing.pinned_sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      listsById: { ...state.listsById, [id]: optimistic },
    }));

    try {
      const updated = await listServiceAdapter.update(id, fields);
      set((state) => ({
        listsById: { ...state.listsById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      // Rollback
      set((state) => ({
        listsById: { ...state.listsById, [id]: previousSnapshot },
      }));
      throw err;
    }
  },

  deleteList: async (id: string): Promise<boolean> => {
    const existing = get().listsById[id];
    if (!existing) {
      return false;
    }

    if (existing.is_smart === 1) {
      throw new Error('Cannot delete built-in smart lists.');
    }

    const previousSnapshot = { ...existing };
    const wasActive = get().activeListId === id;

    set((state) => {
      const nextMap = { ...state.listsById };
      delete nextMap[id];
      return {
        listsById: nextMap,
        orderedIds: state.orderedIds.filter((item) => item !== id),
        activeListId: wasActive ? 'smart_my_day' : state.activeListId,
      };
    });

    try {
      await listServiceAdapter.delete(id);
      return true;
    } catch (err) {
      // Rollback
      set((state) => ({
        listsById: { ...state.listsById, [id]: previousSnapshot },
        orderedIds: [...state.orderedIds, id],
        activeListId: wasActive ? id : state.activeListId,
      }));
      throw err;
    }
  },

  reorderLists: async (updates: Array<{ id: string; sortOrder: number }>) => {
    const previousMap = { ...get().listsById };
    const previousOrdered = [...get().orderedIds];

    set((state) => {
      const nextMap = { ...state.listsById };
      for (const u of updates) {
        if (nextMap[u.id]) {
          nextMap[u.id] = { ...nextMap[u.id], sort_order: u.sortOrder };
        }
      }
      const sortedIds = Object.values(nextMap)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => l.id);

      return {
        listsById: nextMap,
        orderedIds: sortedIds,
      };
    });

    try {
      await listServiceAdapter.reorder(updates);
    } catch (err) {
      set({
        listsById: previousMap,
        orderedIds: previousOrdered,
      });
      throw err;
    }
  },

  createGroup: async (payload: CreateListGroupPayload): Promise<ListGroup> => {
    const group = await listServiceAdapter.createGroup(payload);
    set((state) => ({
      listGroupsById: { ...state.listGroupsById, [group.id]: group },
      orderedGroupIds: [...state.orderedGroupIds, group.id],
    }));
    return group;
  },

  updateGroup: async (id: string, fields: UpdateListGroupPayload): Promise<ListGroup> => {
    const updated = await listServiceAdapter.updateGroup(id, fields);
    set((state) => ({
      listGroupsById: { ...state.listGroupsById, [id]: updated },
    }));
    return updated;
  },

  deleteGroup: async (id: string): Promise<boolean> => {
    await listServiceAdapter.deleteGroup(id);
    set((state) => {
      const nextMap = { ...state.listGroupsById };
      delete nextMap[id];

      // Remove group reference from lists in that group
      const nextLists = { ...state.listsById };
      for (const listId in nextLists) {
        if (nextLists[listId].group_id === id) {
          nextLists[listId] = { ...nextLists[listId], group_id: null };
        }
      }

      return {
        listGroupsById: nextMap,
        orderedGroupIds: state.orderedGroupIds.filter((gid) => gid !== id),
        listsById: nextLists,
      };
    });
    return true;
  },
}));

// Selectors
export function useLists(): List[] {
  return useListStore((state) =>
    state.orderedIds
      .map((id) => state.listsById[id])
      .filter((l): l is List => Boolean(l))
  );
}

export function useSmartLists(): List[] {
  return useListStore((state) =>
    state.orderedIds
      .map((id) => state.listsById[id])
      .filter((l): l is List => Boolean(l && l.is_smart === 1))
  );
}

export function useUserLists(): List[] {
  return useListStore((state) =>
    state.orderedIds
      .map((id) => state.listsById[id])
      .filter((l): l is List => Boolean(l && l.is_smart === 0 && (l.is_pinned ?? 0) === 0))
  );
}

export function usePinnedLists(): List[] {
  return useListStore((state) =>
    state.orderedIds
      .map((id) => state.listsById[id])
      .filter((l): l is List => Boolean(l && l.is_smart === 0 && l.is_pinned === 1))
      .sort((a, b) => (a.pinned_sort_order ?? 0) - (b.pinned_sort_order ?? 0))
  );
}

export function useList(id: string): List | undefined {
  return useListStore((state) => state.listsById[id]);
}

export function useActiveList(): List | undefined {
  return useListStore((state) => state.listsById[state.activeListId]);
}

export function useListGroups(): ListGroup[] {
  return useListStore((state) =>
    state.orderedGroupIds
      .map((id) => state.listGroupsById[id])
      .filter((g): g is ListGroup => Boolean(g))
  );
}

export default useListStore;
