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

beforeEach(() => {
  localStorageMock.clear();
});

describe('viewGroupStore', () => {
  // ── TC-03: Selecting an option updates the label ──────────────────────────
  it('TC-03: setGroupBy stores the chosen option for the given viewId', () => {
    const { setGroupBy, getGroupBy } = useViewGroupStore.getState();
    setGroupBy('list_inbox', 'priority');
    expect(getGroupBy('list_inbox')).toBe('priority');
  });

  // ── TC-03b: Selecting None resets and auto-hides ──────────────────────────
  it('TC-03b: setGroupBy("none") resets option AND hides the pill', () => {
    const { setGroupBy, getGroupBy, isVisible } = useViewGroupStore.getState();
    setGroupBy('list_inbox', 'priority'); // first select something
    setGroupBy('list_inbox', 'none'); // then reset to none
    expect(getGroupBy('list_inbox')).toBe('none');
    expect(isVisible('list_inbox')).toBe(false); // pill must be hidden
  });

  // Selecting a non-none option does NOT auto-hide the pill
  it('TC-03c: setGroupBy with a non-none option does not change visibility', () => {
    const { setGroupBy, setVisible, isVisible } = useViewGroupStore.getState();
    setVisible('list_inbox', true); // pill is open
    setGroupBy('list_inbox', 'tag'); // user picks Tag
    expect(isVisible('list_inbox')).toBe(true); // pill stays visible
  });

  // ── TC-04: Per-view independence ──────────────────────────────────────────
  it('TC-04: each viewId keeps its own independent groupBy value', () => {
    const { setGroupBy, getGroupBy } = useViewGroupStore.getState();
    setGroupBy('list_inbox', 'tag');
    setGroupBy('smart_my_day', 'time');
    setGroupBy('smart_important', 'priority');

    expect(getGroupBy('list_inbox')).toBe('tag');
    expect(getGroupBy('smart_my_day')).toBe('time');
    expect(getGroupBy('smart_important')).toBe('priority');

    // Changing one must not affect the others
    setGroupBy('list_inbox', 'none');
    expect(getGroupBy('smart_my_day')).toBe('time');
    expect(getGroupBy('smart_important')).toBe('priority');
  });

  // ── TC-04b: localStorage round-trip ───────────────────────────────────────
  it('TC-04b: persisted values are written to localStorage on every setGroupBy', () => {
    const { setGroupBy } = useViewGroupStore.getState();
    setGroupBy('list_inbox', 'area');

    const raw = localStorageMock.getItem('os11:view-group-by');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed['list_inbox']).toBe('area');
  });

  // TC-04c: when none is selected, visibility false is also persisted
  it('TC-04c: selecting none writes false to the visibility localStorage key', () => {
    const { setGroupBy, setVisible } = useViewGroupStore.getState();
    setVisible('list_inbox', true);
    setGroupBy('list_inbox', 'none');

    const raw = localStorageMock.getItem('os11:view-group-visible');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed['list_inbox']).toBe(false);
  });

  // toggleVisible flips visibility independently of groupBy
  it('toggleVisible flips the visibility flag for a given viewId', () => {
    const { toggleVisible, isVisible, setVisible } = useViewGroupStore.getState();
    setVisible('list_inbox', false);
    expect(isVisible('list_inbox')).toBe(false); // starts hidden
    toggleVisible('list_inbox');
    expect(isVisible('list_inbox')).toBe(true);
    toggleVisible('list_inbox');
    expect(isVisible('list_inbox')).toBe(false);
  });
});
