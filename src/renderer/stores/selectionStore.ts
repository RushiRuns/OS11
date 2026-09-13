import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  isMultiSelectActive: boolean;

  toggleSelect: (id: string) => void;
  selectRange: (allIds: string[], targetId: string) => void;
  selectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set<string>(),
  lastSelectedId: null,
  isMultiSelectActive: false,

  toggleSelect: (id: string) => {
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return {
        selectedIds: next,
        lastSelectedId: id,
        isMultiSelectActive: next.size > 0,
      };
    });
  },

  selectRange: (allIds: string[], targetId: string) => {
    const { lastSelectedId, selectedIds } = get();
    if (!lastSelectedId || !allIds.includes(lastSelectedId) || !allIds.includes(targetId)) {
      get().toggleSelect(targetId);
      return;
    }

    const startIdx = allIds.indexOf(lastSelectedId);
    const endIdx = allIds.indexOf(targetId);
    const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];

    const next = new Set(selectedIds);
    for (let i = min; i <= max; i++) {
      next.add(allIds[i]);
    }

    set({
      selectedIds: next,
      lastSelectedId: targetId,
      isMultiSelectActive: next.size > 0,
    });
  },

  selectAll: (allIds: string[]) => {
    const next = new Set(allIds);
    set({
      selectedIds: next,
      lastSelectedId: allIds[allIds.length - 1] ?? null,
      isMultiSelectActive: next.size > 0,
    });
  },

  clearSelection: () => {
    set({
      selectedIds: new Set<string>(),
      lastSelectedId: null,
      isMultiSelectActive: false,
    });
  },

  isSelected: (id: string) => get().selectedIds.has(id),
}));
