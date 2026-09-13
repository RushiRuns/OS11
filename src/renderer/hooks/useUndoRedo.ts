import { create } from 'zustand';
import { useEffect } from 'react';

export interface UndoAction {
  id: string;
  description: string;
  undoFn: () => Promise<void> | void;
  redoFn: () => Promise<void> | void;
}

interface UndoRedoState {
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  lastToastAction: UndoAction | null;
  pushAction: (action: Omit<UndoAction, 'id'>) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearToast: () => void;
}

const MAX_STACK_SIZE = 100;

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  lastToastAction: null,

  pushAction: (action) => {
    const item: UndoAction = {
      ...action,
      id: `undo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };

    set((state) => {
      const nextUndo = [item, ...state.undoStack];
      if (nextUndo.length > MAX_STACK_SIZE) {
        nextUndo.pop();
      }
      return {
        undoStack: nextUndo,
        redoStack: [], // Clear redo stack on new action
        lastToastAction: item,
      };
    });
  },

  undo: async () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const [current, ...remainingUndo] = undoStack;
    try {
      await current.undoFn();
      set({
        undoStack: remainingUndo,
        redoStack: [current, ...redoStack],
        lastToastAction: null,
      });
    } catch (err) {
      console.error('[UndoRedo] Failed to execute undo:', err);
    }
  },

  redo: async () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const [current, ...remainingRedo] = redoStack;
    try {
      await current.redoFn();
      set({
        undoStack: [current, ...undoStack],
        redoStack: remainingRedo,
      });
    } catch (err) {
      console.error('[UndoRedo] Failed to execute redo:', err);
    }
  },

  clearToast: () => {
    set({ lastToastAction: null });
  },
}));

export function useUndoRedo(): {
  pushAction: (action: Omit<UndoAction, 'id'>) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  lastToastAction: UndoAction | null;
  clearToast: () => void;
} {
  const { pushAction, undo, redo, undoStack, redoStack, lastToastAction, clearToast } = useUndoRedoStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an active editable input or textarea (native undo handles text)
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.includes('Mac');
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y' && !isMac) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    pushAction,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    lastToastAction,
    clearToast,
  };
}

export default useUndoRedo;
