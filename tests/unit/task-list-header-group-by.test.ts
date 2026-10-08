import { describe, it, expect } from 'vitest';
import React from 'react';
import { TaskListHeader } from '../../src/renderer/features/tasks/TaskListHeader.js';
import type { TaskListHeaderProps } from '../../src/renderer/features/tasks/TaskListHeader.js';

const baseProps: TaskListHeaderProps = {
  title: 'Inbox',
  count: 5,
  filterConfig: {
    sortBy: 'manual',
    sortDirection: 'asc',
    priorityFilter: null,
    incompleteOnly: false,
    starredOnly: false,
    searchQuery: '',
  },
  onFilterChange: () => {},
};

describe('TaskListHeader — Group By Pill Props', () => {
  // TC-01: Inbox and Important — pill props are passed and received
  it('TC-01: accepts isGroupByVisible + groupBy + callbacks for Inbox / Important', () => {
    const onChange = () => {};
    const onToggle = () => {};
    const element = React.createElement(TaskListHeader, {
      ...baseProps,
      isGroupByVisible: true,
      groupBy: 'priority',
      onGroupByChange: onChange,
      onToggleGroupBy: onToggle,
    });

    expect(element.props.isGroupByVisible).toBe(true);
    expect(element.props.groupBy).toBe('priority');
    expect(element.props.onGroupByChange).toBe(onChange);
    expect(element.props.onToggleGroupBy).toBe(onToggle);
  });

  // TC-02: My Day — pill props coexist with Scheduler and Suggestions props
  it('TC-02: My Day passes groupBy pill props alongside Scheduler and Suggestions props', () => {
    const element = React.createElement(TaskListHeader, {
      ...baseProps,
      title: 'My Day',
      isMyDayList: true,
      isSchedulerOpen: false,
      onToggleScheduler: () => {},
      isSuggestionsOpen: false,
      onToggleSuggestions: () => {},
      suggestionsCount: 3,
      isGroupByVisible: true,
      groupBy: 'time',
      onGroupByChange: () => {},
      onToggleGroupBy: () => {},
    });

    // Group By props present
    expect(element.props.groupBy).toBe('time');
    expect(element.props.isGroupByVisible).toBe(true);
    // My Day-specific props untouched
    expect(element.props.isMyDayList).toBe(true);
    expect(element.props.isSchedulerOpen).toBe(false);
    expect(element.props.onToggleScheduler).toBeDefined();
    expect(element.props.isSuggestionsOpen).toBe(false);
    expect(element.props.onToggleSuggestions).toBeDefined();
    expect(element.props.suggestionsCount).toBe(3);
  });

  // Pill is hidden by default (isGroupByVisible = false / omitted)
  it('TC-01b: isGroupByVisible defaults to falsy when not provided', () => {
    const element = React.createElement(TaskListHeader, { ...baseProps });
    expect(element.props.isGroupByVisible).toBeFalsy();
  });

  // All 7 GroupByOption strings are valid as the groupBy prop
  it('TC-03: all 7 GroupByOption values are accepted by the prop', () => {
    const options = [
      'none',
      'time',
      'date',
      'tag',
      'project',
      'area',
      'priority',
    ] as const;
    for (const opt of options) {
      const el = React.createElement(TaskListHeader, {
        ...baseProps,
        isGroupByVisible: true,
        groupBy: opt,
        onGroupByChange: () => {},
      });
      expect(el.props.groupBy).toBe(opt);
    }
  });
});
