import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskListHeader } from '../../src/renderer/features/tasks/TaskListHeader.js';
import type { ViewSearchState } from '../../src/renderer/features/search/ViewSearchContext.js';

describe('TaskList Search Integration (Phase 4)', () => {
  const baseFilterConfig = {
    sortBy: 'manual' as const,
    sortDirection: 'asc' as const,
    priorityFilter: null,
    incompleteOnly: false,
    starredOnly: false,
    searchQuery: '',
  };

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

  it('renders ViewSearch trigger in TaskListHeader for My Day', () => {
    const searchState = createMockSearchState({ viewName: 'My Day', viewKey: 'smart_my_day' });
    const html = renderToStaticMarkup(
      <TaskListHeader
        title="My Day"
        count={5}
        filterConfig={baseFilterConfig}
        onFilterChange={() => {}}
        isMyDayList={true}
        searchState={searchState}
      />
    );

    // Verifies the search button is present in the header
    expect(html).toContain('aria-label="Search My Day');
  });

  it('renders ViewSearch trigger in TaskListHeader for Inbox', () => {
    const searchState = createMockSearchState({ viewName: 'Inbox', viewKey: 'list_inbox' });
    const html = renderToStaticMarkup(
      <TaskListHeader
        title="Inbox"
        count={3}
        filterConfig={baseFilterConfig}
        onFilterChange={() => {}}
        searchState={searchState}
      />
    );

    expect(html).toContain('aria-label="Search Inbox');
  });

  it('renders active search input when isOpen is true in TaskListHeader', () => {
    const searchState = createMockSearchState({
      isOpen: true,
      query: 'groceries',
      isFiltering: true,
      matchCount: 2,
      viewName: 'Important',
      viewKey: 'smart_important',
    });
    const html = renderToStaticMarkup(
      <TaskListHeader
        title="Important"
        count={4}
        filterConfig={baseFilterConfig}
        onFilterChange={() => {}}
        searchState={searchState}
      />
    );

    expect(html).toContain('placeholder="Search Important"');
    expect(html).toContain('value="groceries"');
    expect(html).toContain('2 matches');
  });
});
