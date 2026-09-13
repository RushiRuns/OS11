import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '../../src/renderer/stores/selectionStore.js';
import { between, atStart, atEnd } from '../../src/shared/utils/fractional-index.js';

describe('Domain: Multi-Select & Selection Store', () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it('toggles selection and updates isMultiSelectActive', () => {
    const store = useSelectionStore.getState();
    expect(store.isMultiSelectActive).toBe(false);
    expect(store.selectedIds.size).toBe(0);

    store.toggleSelect('task-1');
    expect(useSelectionStore.getState().selectedIds.has('task-1')).toBe(true);
    expect(useSelectionStore.getState().isMultiSelectActive).toBe(true);

    store.toggleSelect('task-1');
    expect(useSelectionStore.getState().selectedIds.has('task-1')).toBe(false);
    expect(useSelectionStore.getState().isMultiSelectActive).toBe(false);
  });

  it('selects contiguous range via selectRange', () => {
    const allIds = ['t-1', 't-2', 't-3', 't-4', 't-5'];
    const store = useSelectionStore.getState();

    // Select first anchor
    store.toggleSelect('t-2');
    expect(useSelectionStore.getState().lastSelectedId).toBe('t-2');

    // Range select to t-4
    store.selectRange(allIds, 't-4');
    const selected = useSelectionStore.getState().selectedIds;
    expect(selected.size).toBe(3);
    expect(selected.has('t-2')).toBe(true);
    expect(selected.has('t-3')).toBe(true);
    expect(selected.has('t-4')).toBe(true);
    expect(selected.has('t-1')).toBe(false);
    expect(selected.has('t-5')).toBe(false);
  });

  it('selects all items via selectAll', () => {
    const allIds = ['t-1', 't-2', 't-3'];
    useSelectionStore.getState().selectAll(allIds);

    expect(useSelectionStore.getState().selectedIds.size).toBe(3);
    expect(useSelectionStore.getState().isMultiSelectActive).toBe(true);
  });

  it('clears selection completely', () => {
    useSelectionStore.getState().selectAll(['t-1', 't-2']);
    useSelectionStore.getState().clearSelection();

    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().isMultiSelectActive).toBe(false);
    expect(useSelectionStore.getState().lastSelectedId).toBeNull();
  });
});

describe('Domain: Fractional Indexing for Drag & Drop Reorder', () => {
  it('calculates midpoint between existing sort orders', () => {
    expect(between(1000, 2000)).toBe(1500);
    expect(between(1000, 1500)).toBe(1250);
    expect(between(0, 100)).toBe(50);
  });

  it('calculates start and end bounds', () => {
    expect(atStart(1000)).toBe(0);
    expect(atEnd(2000)).toBe(3000);
    expect(between(null, 1000)).toBe(0);
    expect(between(2000, null)).toBe(3000);
  });

  it('handles empty boundaries and duplicate positions', () => {
    expect(between(null, null)).toBe(1000);
    expect(between(500, 500)).toBe(500.5);
  });
});
