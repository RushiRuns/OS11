import { describe, it, expect, beforeEach } from 'vitest';
import { useUndoRedoStore } from '../../src/renderer/hooks/useUndoRedo.js';

describe('Phase 5: Undo / Redo History Stack', () => {
  beforeEach(() => {
    useUndoRedoStore.setState({
      undoStack: [],
      redoStack: [],
      lastToastAction: null,
    });
  });

  it('pushes action onto undo stack and sets toast action', () => {
    let executed = false;

    useUndoRedoStore.getState().pushAction({
      description: 'Deleted task #1',
      undoFn: () => {
        executed = true;
      },
      redoFn: () => {},
    });

    const state = useUndoRedoStore.getState();
    expect(state.undoStack.length).toBe(1);
    expect(state.undoStack[0].description).toBe('Deleted task #1');
    expect(state.lastToastAction?.description).toBe('Deleted task #1');
    expect(executed).toBe(false);
  });

  it('executes undo function and transfers action to redo stack', async () => {
    let restored = false;

    useUndoRedoStore.getState().pushAction({
      description: 'Deleted task',
      undoFn: () => {
        restored = true;
      },
      redoFn: () => {},
    });

    await useUndoRedoStore.getState().undo();

    expect(restored).toBe(true);
    expect(useUndoRedoStore.getState().undoStack.length).toBe(0);
    expect(useUndoRedoStore.getState().redoStack.length).toBe(1);
  });

  it('executes redo function and returns action to undo stack', async () => {
    let reDeleted = false;

    useUndoRedoStore.getState().pushAction({
      description: 'Action',
      undoFn: () => {},
      redoFn: () => {
        reDeleted = true;
      },
    });

    await useUndoRedoStore.getState().undo();
    expect(useUndoRedoStore.getState().redoStack.length).toBe(1);

    await useUndoRedoStore.getState().redo();
    expect(reDeleted).toBe(true);
    expect(useUndoRedoStore.getState().undoStack.length).toBe(1);
    expect(useUndoRedoStore.getState().redoStack.length).toBe(0);
  });

  it('clamps history stack to maximum 100 entries', () => {
    for (let i = 0; i < 115; i++) {
      useUndoRedoStore.getState().pushAction({
        description: `Action ${i}`,
        undoFn: () => {},
        redoFn: () => {},
      });
    }

    expect(useUndoRedoStore.getState().undoStack.length).toBe(100);
  });
});
