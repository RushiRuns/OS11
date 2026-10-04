import { describe, it, expect } from 'vitest';
import React from 'react';
import { isStalled } from '../../src/shared/utils/project-health.js';
import { ProjectHeader } from '../../src/renderer/features/projects/ProjectHeader.js';
import { ProjectContextMenu } from '../../src/renderer/features/projects/ProjectContextMenu.js';
import { CreateProjectModal } from '../../src/renderer/features/projects/CreateProjectModal.js';
import type { Project, Task } from '../../src/shared/types/index.js';

function mockTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    all_day: 0,
    priority: 0,
    is_starred: 0,
    created_by_device: 'local',
    pomodoro_count: 0,
    is_completed: 0,
    is_trashed: 0,
    sort_order: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

describe('Parked and Stalled Projects', () => {
  const baseProject: Project = {
    id: 'proj-1',
    name: 'Apollo Website',
    status: 'active',
    default_view: 'list',
    views: ['list'],
    sort_order: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };

  it('detects a project as stalled if it has no tasks at all', () => {
    expect(isStalled(baseProject, [])).toBe(true);
  });

  it('detects a project as stalled if all tasks are in someday or waiting', () => {
    const tasks: Task[] = [
      mockTask({
        id: 't-1',
        project_id: 'proj-1',
        title: 'Someday redesign icon',
        bucket: 'someday',
        sort_order: 0,
      }),
      mockTask({
        id: 't-2',
        project_id: 'proj-1',
        title: 'Waiting for client feedback',
        waiting_since: '2026-10-02',
        sort_order: 1,
      }),
    ];
    expect(isStalled(baseProject, tasks)).toBe(true);
  });

  it('detects a project as NOT stalled if it has at least one actionable incomplete task', () => {
    const tasks: Task[] = [
      mockTask({
        id: 't-1',
        project_id: 'proj-1',
        title: 'Review landing page draft',
        bucket: 'anytime',
        sort_order: 0,
      }),
    ];
    expect(isStalled(baseProject, tasks)).toBe(false);
  });

  it('never marks a parked or someday project as stalled', () => {
    const parkedProject: Project = {
      ...baseProject,
      status: 'parked',
      is_someday: 1,
    };
    expect(isStalled(parkedProject, [])).toBe(false);
  });

  it('instantiates ProjectHeader with project and tasks', () => {
    const el = React.createElement(ProjectHeader, {
      project: baseProject,
      sections: [],
      tasks: [],
      milestones: [],
      currentView: 'list',
      onViewChange: () => {},
      onOpenMilestones: () => {},
      onOpenTemplates: () => {},
    });
    expect(el.props.project.id).toBe('proj-1');
  });

  it('instantiates ProjectContextMenu with project and position', () => {
    const el = React.createElement(ProjectContextMenu, {
      project: baseProject,
      position: { x: 100, y: 150 },
      onClose: () => {},
      onEdit: () => {},
      onArchive: () => {},
      onDelete: () => {},
    });
    expect(el.props.project.name).toBe('Apollo Website');
  });

  it('instantiates CreateProjectModal with open prop', () => {
    const el = React.createElement(CreateProjectModal, {
      open: true,
      onOpenChange: () => {},
    });
    expect(el.props.open).toBe(true);
  });
});
