import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Area, CreateAreaPayload, UpdateAreaPayload } from '@shared/types/Area.js';

export interface AreaStoreState {
  areasById: Record<string, Area>;
  orderedAreaIds: string[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;

  // Actions
  loadAreas: () => Promise<void>;
  createArea: (payload: CreateAreaPayload) => Promise<Area>;
  updateArea: (id: string, fields: UpdateAreaPayload) => Promise<Area>;
  deleteArea: (id: string) => Promise<void>;
  reorderAreas: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
}

export const useAreaStore = create<AreaStoreState>((set, get) => ({
  areasById: {},
  orderedAreaIds: [],
  isLoading: false,
  isLoaded: false,
  error: null,

  loadAreas: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await ipc.invoke<Area[]>(IPC.AREAS.GET_ALL);
      const list = Array.isArray(res) ? res : [];
      const areasById: Record<string, Area> = {};
      const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order);
      const orderedAreaIds = sorted.map((a) => {
        areasById[a.id] = a;
        return a.id;
      });

      set({
        areasById,
        orderedAreaIds,
        isLoading: false,
        isLoaded: true,
      });
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  createArea: async (payload: CreateAreaPayload): Promise<Area> => {
    const tempId = `temp-area-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Area = {
      id: tempId,
      workspace_id: payload.workspace_id ?? 'ws_default',
      name: payload.name,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      is_collapsed: 0,
      created_at: now,
      updated_at: now,
    };

    set((state) => ({
      areasById: { ...state.areasById, [tempId]: optimistic },
      orderedAreaIds: [...state.orderedAreaIds, tempId],
    }));

    try {
      const created = await ipc.invoke<Area>(IPC.AREAS.CREATE, payload);
      set((state) => {
        const nextMap = { ...state.areasById };
        delete nextMap[tempId];
        nextMap[created.id] = created;
        const nextOrder = state.orderedAreaIds.map((id) => (id === tempId ? created.id : id));
        return { areasById: nextMap, orderedAreaIds: nextOrder };
      });
      return created;
    } catch (err) {
      // Rollback
      set((state) => {
        const nextMap = { ...state.areasById };
        delete nextMap[tempId];
        const nextOrder = state.orderedAreaIds.filter((id) => id !== tempId);
        return { areasById: nextMap, orderedAreaIds: nextOrder };
      });
      throw err;
    }
  },

  updateArea: async (id: string, fields: UpdateAreaPayload): Promise<Area> => {
    const current = get().areasById[id];
    if (!current) throw new Error(`Area ${id} not found`);

    const isCollapsedVal =
      fields.is_collapsed !== undefined
        ? typeof fields.is_collapsed === 'boolean'
          ? fields.is_collapsed ? 1 : 0
          : fields.is_collapsed
        : current.is_collapsed;

    const optimistic: Area = {
      ...current,
      ...fields,
      is_collapsed: isCollapsedVal,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      areasById: { ...state.areasById, [id]: optimistic },
    }));

    try {
      const updated = await ipc.invoke<Area>(IPC.AREAS.UPDATE, { id, fields });
      set((state) => ({
        areasById: { ...state.areasById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      // Rollback
      set((state) => ({
        areasById: { ...state.areasById, [id]: current },
      }));
      throw err;
    }
  },

  deleteArea: async (id: string): Promise<void> => {
    const current = get().areasById[id];
    if (!current) return;

    // Check safeguard on frontend as well
    if (get().orderedAreaIds.length <= 1) {
      throw new Error('At least one Area must always exist.');
    }

    // Call backend which checks projects and loose tasks count
    await ipc.invoke(IPC.AREAS.DELETE, id);

    set((state) => {
      const nextMap = { ...state.areasById };
      delete nextMap[id];
      const nextOrder = state.orderedAreaIds.filter((aid) => aid !== id);
      return { areasById: nextMap, orderedAreaIds: nextOrder };
    });
  },

  reorderAreas: async (updates: Array<{ id: string; sortOrder: number }>): Promise<void> => {
    const prevMap = get().areasById;
    const prevOrder = get().orderedAreaIds;

    const nextMap = { ...prevMap };
    for (const u of updates) {
      if (nextMap[u.id]) {
        nextMap[u.id] = { ...nextMap[u.id], sort_order: u.sortOrder };
      }
    }

    const nextOrder = Object.values(nextMap)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => a.id);

    set({ areasById: nextMap, orderedAreaIds: nextOrder });

    try {
      await ipc.invoke(IPC.AREAS.REORDER, updates);
    } catch (err) {
      // Rollback
      set({ areasById: prevMap, orderedAreaIds: prevOrder });
      throw err;
    }
  },
}));

export function useAreas(): Area[] {
  return useAreaStore((state) =>
    state.orderedAreaIds.map((id) => state.areasById[id]).filter(Boolean)
  );
}

export function useArea(id?: string | null): Area | undefined {
  return useAreaStore((state) => (id ? state.areasById[id] : undefined));
}

export function useAreaCount(): number {
  return useAreaStore((state) => state.orderedAreaIds.length);
}

export default useAreaStore;
