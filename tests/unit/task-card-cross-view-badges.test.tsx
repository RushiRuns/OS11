import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskCard } from '../../src/renderer/features/tasks/TaskCard.js';
import { useAppStore } from '../../src/renderer/stores/app-store.js';
import { useProjectStore } from '../../src/renderer/stores/projectStore.js';
import { useAreaStore } from '../../src/renderer/stores/areaStore.js';
import { useListStore } from '../../src/renderer/stores/listStore.js';
import { toISODateOnly } from '../../src/shared/utils/date.js';

describe('TaskCard Cross-View Membership Badges & Deduplication Regression Tests', () => {
  const dummyTask = {
    id: 'test-task-badge',
    title: 'Test Badge Task',
    notes: 'Badge notes',
    is_completed: 0,
    is_starred: 0,
    priority: 0,
    due_date: null,
    due_time: null,
    all_day: 1,
    list_id: 'default',
    project_id: null,
    area_id: null,
    parent_task_id: null,
    sort_order: 1000,
    pomodoro_count: 0,
    is_habit: 0,
    is_trashed: 0,
    created_at: '2026-09-20T00:00:00.000Z',
    updated_at: '2026-09-20T00:00:00.000Z',
  };

  beforeEach(() => {
    useAppStore.setState({ activeListId: 'smart_my_day' });
    useProjectStore.setState({
      projectsById: {
        'proj-workos': {
          id: 'proj-workos',
          name: 'OS11', // Real projects use `name`, not `title`
          icon: '✅',
          status: 'active',
          color: '#3b82f6',
        } as any,
      },
    });
    useAreaStore.setState({
      areasById: {
        'area-work': {
          id: 'area-work',
          name: 'Personal',
          order: 0,
        } as any,
      },
      orderedAreaIds: ['area-work'],
    });
    useListStore.setState({
      listsById: {
        'list-groceries': {
          id: 'list-groceries',
          name: 'Groceries',
        } as any,
      },
    });
  });

  it('regression 1: renders exactly ONE instance of container and smart badges (below notes, none on far right)', () => {
    useAppStore.setState({ activeListId: 'project:proj-workos' });
    const today = new Date().toISOString().split('T')[0];
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
      my_day_date: today,
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    // Must have exactly one smart-status-badge
    const matches = html.match(/data-testid="smart-status-badge"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);

    // Verify it is located inside metadataRow, and NOT duplicated in metadataWrap
    expect(html).toContain('☀️');
    expect(html).toContain('My Day');
  });

  it('regression 2: renders real project name and custom icon (proj.name & proj.icon), never blank name', () => {
    useAppStore.setState({ activeListId: 'smart_my_day' });
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    expect(html).toContain('data-testid="container-badge"');
    // Must display "OS11" (from proj.name) and "✅" (from proj.icon)
    expect(html).toContain('OS11');
    expect(html).toContain('✅');
    // Must only have one container-badge instance
    const containerMatches = html.match(/data-testid="container-badge"/g);
    expect(containerMatches?.length).toBe(1);
  });

  it('regression 3: suppresses Anytime badge when inside Anytime view', () => {
    useAppStore.setState({ activeListId: 'smart_anytime' });
    const task = {
      ...dummyTask,
      bucket: 'anytime',
      project_id: 'proj-workos',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    // In Anytime view, the container badge (OS11) should show, but NOT an Anytime badge!
    expect(html).toContain('data-testid="container-badge"');
    expect(html).toContain('OS11');
    expect(html).not.toContain('⚡');
    expect(html).not.toContain('Anytime');
    expect(html).not.toContain('data-testid="smart-status-badge"');
  });

  it('regression 4: suppresses Someday badge when inside Someday view', () => {
    useAppStore.setState({ activeListId: 'smart_someday' });
    const task = {
      ...dummyTask,
      bucket: 'someday',
      project_id: 'proj-workos',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    // In Someday view, the container badge (OS11) should show, but NOT a Someday badge!
    expect(html).toContain('data-testid="container-badge"');
    expect(html).toContain('OS11');
    expect(html).not.toContain('📦');
    expect(html).not.toContain('Someday');
    expect(html).not.toContain('data-testid="smart-status-badge"');
  });

  it('regression 5: renders overdue red styling class and waiting badgeType class on Waiting badge when follow_up_date is in past', () => {
    useAppStore.setState({ activeListId: 'project:proj-workos' });
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
      waiting_on: 'Dave',
      follow_up_date: '2026-01-01',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    expect(html).toContain('data-testid="smart-status-badge"');
    expect(html).toContain('Waiting: Dave');
    expect(html).toContain('inlineSmartBadge_waiting');
    expect(html).toContain('inlineSmartBadgeOverdue');
  });

  it('regression 6: renders both bucket and waiting badges concurrently separated by dot', () => {
    useAppStore.setState({ activeListId: 'project:proj-workos' });
    const today = toISODateOnly(new Date());
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
      my_day_date: today,
      waiting_on: 'Sarah',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    expect(html).toContain('My Day');
    expect(html).toContain('Waiting: Sarah');
    // Separator dot must exist between them
    expect(html).toContain('·');
    const matches = html.match(/data-testid="smart-status-badge"/g);
    expect(matches?.length).toBe(2);
  });

  it('regression 7: renders project container badge inside Area view for tasks having both project_id and area_id', () => {
    useAppStore.setState({ activeListId: 'area:area-work' });
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
      area_id: 'area-work',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    expect(html).toContain('data-testid="container-badge"');
    expect(html).toContain('OS11');
    expect(html).toContain('✅');
  });

  it('regression 8: renders no dangling dot when smart badge is suppressed in its own view', () => {
    useAppStore.setState({ activeListId: 'smart_anytime' });
    const task = {
      ...dummyTask,
      project_id: 'proj-workos',
      bucket: 'anytime',
    };

    const html = renderToStaticMarkup(
      React.createElement(TaskCard, {
        task: task as any,
      })
    );

    expect(html).toContain('data-testid="container-badge"');
    expect(html).toContain('OS11');
    // Only container badge is rendered, no subsequent items -> no separator dot
    expect(html).not.toContain('·');
  });
});
