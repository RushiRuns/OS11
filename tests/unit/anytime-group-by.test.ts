import { describe, it, expect, beforeEach } from 'vitest';

// localStorage mock must be in place BEFORE the store module is imported,
// so its getInitial* helpers read a clean slate.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
};

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

// Dynamic import so the mock is active when the module initialises
const { useViewGroupStore } = await import(
  '../../src/renderer/stores/viewGroupStore.js'
);

describe('Anytime View Group By Persistence', () => {
  const VIEW_ID = 'smart_anytime';

  // Helper matching AnytimeView resolution logic: strictly ['area', 'project', 'none'], fallback to 'area'
  const resolveAnytimeGroupBy = (storedValue: string | undefined): 'area' | 'project' | 'none' => {
    if (storedValue === 'project' || storedValue === 'area' || storedValue === 'none') {
      return storedValue;
    }
    return 'area';
  };

  beforeEach(() => {
    localStorageMock.clear();
    // Reset store internal map between tests
    useViewGroupStore.setState({ groupByMap: {}, visibleMap: {} });
  });

  it('TC-AT-01: falls back to default ("area") when no setting has been persisted', () => {
    const raw = useViewGroupStore.getState().groupByMap[VIEW_ID];
    const resolved = resolveAnytimeGroupBy(raw);
    expect(resolved).toBe('area');
  });

  it('TC-AT-02: persists "project" when selected by the user', () => {
    const { setGroupBy } = useViewGroupStore.getState();
    setGroupBy(VIEW_ID, 'project');

    const storedInState = useViewGroupStore.getState().groupByMap[VIEW_ID];
    expect(storedInState).toBe('project');
    expect(resolveAnytimeGroupBy(storedInState)).toBe('project');

    const serialized = JSON.parse(localStorageMock.getItem('os11:view-group-by') || '{}');
    expect(serialized[VIEW_ID]).toBe('project');
  });

  it('TC-AT-03: retains selection after simulating view switch / store read', () => {
    const { setGroupBy } = useViewGroupStore.getState();

    // User selects Project in Anytime view
    setGroupBy(VIEW_ID, 'project');

    // User switches to Inbox view and modifies that view
    setGroupBy('list_inbox', 'priority');

    // Return to Anytime view and inspect resolved state
    const anytimeOption = useViewGroupStore.getState().groupByMap[VIEW_ID];
    const inboxOption = useViewGroupStore.getState().groupByMap['list_inbox'];

    expect(resolveAnytimeGroupBy(anytimeOption)).toBe('project');
    expect(inboxOption).toBe('priority');
  });

  it('TC-AT-04: persists "none" grouping when chosen', () => {
    const { setGroupBy } = useViewGroupStore.getState();
    setGroupBy(VIEW_ID, 'none');

    const storedInState = useViewGroupStore.getState().groupByMap[VIEW_ID];
    expect(storedInState).toBe('none');
    expect(resolveAnytimeGroupBy(storedInState)).toBe('none');

    const serialized = JSON.parse(localStorageMock.getItem('os11:view-group-by') || '{}');
    expect(serialized[VIEW_ID]).toBe('none');
  });

  it('TC-AT-05: persists "area" when explicitly re-selected after "project"', () => {
    const { setGroupBy } = useViewGroupStore.getState();
    setGroupBy(VIEW_ID, 'project');
    expect(resolveAnytimeGroupBy(useViewGroupStore.getState().groupByMap[VIEW_ID])).toBe('project');

    setGroupBy(VIEW_ID, 'area');
    expect(resolveAnytimeGroupBy(useViewGroupStore.getState().groupByMap[VIEW_ID])).toBe('area');

    const serialized = JSON.parse(localStorageMock.getItem('os11:view-group-by') || '{}');
    expect(serialized[VIEW_ID]).toBe('area');
  });

  it('TC-AT-06: safely falls back to "area" if unsupported groupBy is present in storage', () => {
    // e.g. If an invalid or foreign groupBy option is encountered
    const resolved = resolveAnytimeGroupBy('priority');
    expect(resolved).toBe('area');
  });
});
