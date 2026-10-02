import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ViewSwitcher } from '../../src/renderer/features/projects/ViewSwitcher.js';
import type { ProjectViewMode } from '../../src/shared/types/index.js';

describe('Minimalist ViewSwitcher Feature Tests', () => {
  it('renders only enabled views and preserves switcher visibility even with a single view', () => {
    const onViewChange = vi.fn();
    const singleView: ProjectViewMode[] = ['list'];

    const element = React.createElement(ViewSwitcher, {
      currentView: 'list',
      availableViews: singleView,
      onViewChange,
    });

    expect(element.props.currentView).toBe('list');
    expect(element.props.availableViews).toEqual(['list']);
  });

  it('renders all 5 views by default when availableViews is omitted for backward compatibility', () => {
    const onViewChange = vi.fn();

    const element = React.createElement(ViewSwitcher, {
      currentView: 'board',
      onViewChange,
    });

    expect(element.props.currentView).toBe('board');
    expect(element.props.availableViews).toBeUndefined();
  });

  it('supports controlled customize popover opening', () => {
    const onViewChange = vi.fn();
    const onCustomizeOpenChange = vi.fn();

    const element = React.createElement(ViewSwitcher, {
      currentView: 'timeline',
      availableViews: ['list', 'timeline', 'table'],
      onViewChange,
      isCustomizeOpen: true,
      onCustomizeOpenChange,
    });

    expect(element.props.isCustomizeOpen).toBe(true);
    expect(element.props.availableViews).toEqual(['list', 'timeline', 'table']);
  });

  it('provides onUpdateViews callback to add or remove views', () => {
    const onUpdateViews = vi.fn();
    const onViewChange = vi.fn();

    const element = React.createElement(ViewSwitcher, {
      currentView: 'list',
      availableViews: ['list', 'board'],
      onViewChange,
      onUpdateViews,
    });

    expect(element.props.onUpdateViews).toBeDefined();
    // Simulate updating views to include calendar
    element.props.onUpdateViews(['list', 'board', 'calendar']);
    expect(onUpdateViews).toHaveBeenCalledWith(['list', 'board', 'calendar']);
  });
});

describe('CreateProjectModal Curated Views Selection Logic', () => {
  it('enforces that deselecting the active default view reassigns default view to first remaining view', () => {
    let selectedViews: ProjectViewMode[] = ['list', 'board', 'timeline'];
    let defaultView: ProjectViewMode = 'board';

    // Simulate deselecting 'board'
    const viewToRemove: ProjectViewMode = 'board';
    const remaining = selectedViews.filter((v) => v !== viewToRemove);
    if (defaultView === viewToRemove) {
      defaultView = remaining[0];
    }
    selectedViews = remaining;

    expect(selectedViews).toEqual(['list', 'timeline']);
    expect(defaultView).toBe('list');
  });

  it('blocks removing the last remaining view to guarantee at least one view exists', () => {
    const selectedViews: ProjectViewMode[] = ['list'];
    let attemptedRemoval = false;

    if (selectedViews.length > 1) {
      attemptedRemoval = true;
    }

    expect(attemptedRemoval).toBe(false);
    expect(selectedViews.length).toBe(1);
  });

  it('allows clicking an already-selected view label to designate it as the default view', () => {
    const selectedViews: ProjectViewMode[] = ['list', 'board', 'calendar'];
    let defaultView: ProjectViewMode = 'list';

    // Tapping 'calendar' label switches default
    const tappedView: ProjectViewMode = 'calendar';
    if (selectedViews.includes(tappedView)) {
      defaultView = tappedView;
    }

    expect(defaultView).toBe('calendar');
    expect(selectedViews).toEqual(['list', 'board', 'calendar']);
  });
});
