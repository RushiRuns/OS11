import { create } from 'zustand';

const STORAGE_KEY = 'os11:scheduler-width';
const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 320;
const MAX_WIDTH = 520;

function getInitialWidth(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!Number.isNaN(val)) {
          return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, val));
        }
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDTH;
}

export interface DragPreviewState {
  startMin: number;
  durationMin: number;
}

export interface SchedulerUiState {
  panelWidth: number;
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  isDragging: boolean;
  dragPreviewMinutes: DragPreviewState | null;

  setPanelWidth: (width: number) => void;
  setSelectedBlockId: (id: string | null) => void;
  setHoveredBlockId: (id: string | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  setDragPreviewMinutes: (preview: DragPreviewState | null) => void;
}

export const useSchedulerUiStore = create<SchedulerUiState>((set) => ({
  panelWidth: getInitialWidth(),
  selectedBlockId: null,
  hoveredBlockId: null,
  isDragging: false,
  dragPreviewMinutes: null,

  setPanelWidth: (width: number) => {
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, String(clamped));
      }
    } catch {
      // ignore
    }
    set({ panelWidth: clamped });
  },

  setSelectedBlockId: (id: string | null) => set({ selectedBlockId: id }),
  setHoveredBlockId: (id: string | null) => set({ hoveredBlockId: id }),
  setIsDragging: (isDragging: boolean) => set({ isDragging }),
  setDragPreviewMinutes: (dragPreviewMinutes: DragPreviewState | null) =>
    set({ dragPreviewMinutes }),
}));
