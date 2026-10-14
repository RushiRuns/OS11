import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useViewSearch, type UseViewSearchOptions } from '../../src/renderer/hooks/useViewSearch.js';
import type { ViewSearchState } from '../../src/renderer/features/search/ViewSearchContext.js';

describe('useViewSearch Hook', () => {
  interface SimpleTask {
    id: string;
    title: string;
    parent_task_id?: string | null;
  }

  const sampleTasks: SimpleTask[] = [
    { id: '1', title: 'Buy milk' },
    { id: '2', title: 'Call accountant' },
    { id: '3', title: 'Milk cows on farm' },
    { id: '4', title: 'Child of 2', parent_task_id: '2' },
  ];

  function renderHookHarness(options: UseViewSearchOptions<SimpleTask>): ViewSearchState {
    let capturedState!: ViewSearchState;

    function Harness() {
      capturedState = useViewSearch(options);
      return null;
    }

    renderToStaticMarkup(<Harness />);
    return capturedState;
  }

  it('initializes with default closed state and zero match count', () => {
    const state = renderHookHarness({
      tasks: sampleTasks,
      viewKey: 'test_view',
      viewName: 'Test View',
    });

    expect(state.isOpen).toBe(false);
    expect(state.query).toBe('');
    expect(state.isFiltering).toBe(false);
    expect(state.matchCount).toBe(0);
    expect(state.cursorTaskId).toBeNull();
    expect(state.enabled).toBe(true);
  });

  it('correctly reports row visibility when filtering is inactive', () => {
    const state = renderHookHarness({
      tasks: sampleTasks,
      viewKey: 'test_view',
      viewName: 'Test View',
    });

    // When not filtering, all rows are visible
    expect(state.isRowVisible('1')).toBe(true);
    expect(state.isRowVisible('2')).toBe(true);
  });

  it('correctly handles groupOpen override and match visibility', () => {
    const state = renderHookHarness({
      tasks: sampleTasks,
      viewKey: 'test_view',
      viewName: 'Test View',
    });

    // When not filtering, groupOpen returns userOpen unmodified
    expect(state.groupOpen('group-1', true, false)).toBe(true);
    expect(state.groupOpen('group-1', false, true)).toBe(false);
  });
});
