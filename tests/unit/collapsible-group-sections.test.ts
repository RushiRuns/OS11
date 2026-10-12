import { describe, it, expect, beforeEach } from 'vitest';

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

const { useViewGroupStore } = await import(
  '../../src/renderer/stores/viewGroupStore.js'
);

describe('Collapsible Group Sections Persistence', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useViewGroupStore.setState({
      groupByMap: {},
      visibleMap: {},
      collapsedGroupsMap: {},
    });
  });

  it('TC-CGS-01: sections are expanded by default', () => {
    const isCollapsed = useViewGroupStore.getState().isGroupCollapsed('smart_anytime', 'project-1');
    expect(isCollapsed).toBe(false);
  });

  it('TC-CGS-02: toggling a section marks it as collapsed and persists to localStorage', () => {
    const { toggleGroupCollapsed, isGroupCollapsed } = useViewGroupStore.getState();
    toggleGroupCollapsed('smart_anytime', 'project-1');

    expect(isGroupCollapsed('smart_anytime', 'project-1')).toBe(true);

    const saved = JSON.parse(localStorageMock.getItem('os11:view-group-collapsed') || '{}');
    expect(saved['smart_anytime:project-1']).toBe(true);
  });

  it('TC-CGS-03: toggling an already collapsed section expands it again', () => {
    const { toggleGroupCollapsed, isGroupCollapsed } = useViewGroupStore.getState();
    toggleGroupCollapsed('smart_anytime', 'project-1');
    expect(isGroupCollapsed('smart_anytime', 'project-1')).toBe(true);

    toggleGroupCollapsed('smart_anytime', 'project-1');
    expect(isGroupCollapsed('smart_anytime', 'project-1')).toBe(false);

    const saved = JSON.parse(localStorageMock.getItem('os11:view-group-collapsed') || '{}');
    expect(saved['smart_anytime:project-1']).toBe(false);
  });

  it('TC-CGS-04: collapsing one group does not affect others within the same view or across views', () => {
    const { toggleGroupCollapsed, isGroupCollapsed } = useViewGroupStore.getState();

    // Collapse section 1 in Anytime view
    toggleGroupCollapsed('smart_anytime', 'project-1');

    // Section 2 in Anytime view should remain expanded
    expect(isGroupCollapsed('smart_anytime', 'project-2')).toBe(false);

    // Section 1 in another view (e.g. Inbox list) should remain expanded
    expect(isGroupCollapsed('list_inbox', 'project-1')).toBe(false);
  });

  it('TC-CGS-05: setGroupCollapsed explicitly sets collapsed state', () => {
    const { setGroupCollapsed, isGroupCollapsed } = useViewGroupStore.getState();
    setGroupCollapsed('project:p1', 'area-work', true);
    expect(isGroupCollapsed('project:p1', 'area-work')).toBe(true);

    setGroupCollapsed('project:p1', 'area-work', false);
    expect(isGroupCollapsed('project:p1', 'area-work')).toBe(false);
  });
});
