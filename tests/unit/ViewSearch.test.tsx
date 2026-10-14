import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViewSearch } from '../../src/renderer/features/search/ViewSearch.js';
import type { ViewSearchState } from '../../src/renderer/features/search/ViewSearchContext.js';

describe('ViewSearch Component', () => {
  const createMockSearchState = (overrides?: Partial<ViewSearchState>): ViewSearchState => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    query: '',
    setQuery: vi.fn(),
    tokens: [],
    isFiltering: false,
    matchCount: 0,
    cursorTaskId: null,
    moveCursor: vi.fn(),
    results: new Map(),
    isRowVisible: () => true,
    pin: vi.fn(),
    unpin: vi.fn(),
    groupOpen: (_key, userOpen) => userOpen,
    setGroupOverride: vi.fn(),
    inputRef: { current: null },
    viewName: 'My Day',
    viewKey: 'smart_my_day',
    enabled: true,
    ...overrides,
  });

  it('renders nothing when enabled is false', () => {
    const state = createMockSearchState({ enabled: false });
    const html = renderToStaticMarkup(<ViewSearch searchState={state} />);
    expect(html).toBe('');
  });

  it('renders closed trigger button with search icon and aria-label', () => {
    const state = createMockSearchState({ isOpen: false, viewName: 'Inbox' });
    const html = renderToStaticMarkup(<ViewSearch searchState={state} />);

    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Search Inbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('<button');
    expect(html).not.toContain('<input');
  });

  it('renders expanded search field with Esc badge when query is empty', () => {
    const state = createMockSearchState({
      isOpen: true,
      query: '',
      viewName: 'Planned',
    });
    const html = renderToStaticMarkup(<ViewSearch searchState={state} />);

    expect(html).toContain('role="searchbox"');
    expect(html).toContain('placeholder="Search Planned"');
    expect(html).toContain('Esc');
    expect(html).toContain('aria-label="Close search"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders match count when query has text', () => {
    const state1 = createMockSearchState({
      isOpen: true,
      query: 'meeting',
      matchCount: 3,
      viewName: 'Personal tasks',
    });
    const html1 = renderToStaticMarkup(<ViewSearch searchState={state1} />);
    expect(html1).toContain('3 matches');
    expect(html1).not.toContain('escKeycap');

    const state2 = createMockSearchState({
      isOpen: true,
      query: 'design',
      matchCount: 1,
      viewName: 'Projects',
    });
    const html2 = renderToStaticMarkup(<ViewSearch searchState={state2} />);
    expect(html2).toContain('1 match');

    const state3 = createMockSearchState({
      isOpen: true,
      query: 'unknown',
      matchCount: 0,
      viewName: 'Waiting For',
    });
    const html3 = renderToStaticMarkup(<ViewSearch searchState={state3} />);
    expect(html3).toContain('No matches');
  });
});
