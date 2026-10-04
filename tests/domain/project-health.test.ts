import { describe, it, expect } from 'vitest';
import { isStalled } from '../../src/main/domain/project-health.js';

describe('Domain: Project Health (isStalled)', () => {
  const activeProj = { id: 'p1', status: 'active', is_someday: 0 };

  it('returns true when an active project has zero incomplete tasks', () => {
    expect(isStalled(activeProj, [])).toBe(true);

    const completedTasks = [
      { project_id: 'p1', is_completed: 1, is_trashed: 0, bucket: 'anytime' },
      { project_id: 'p1', is_completed: 1, is_trashed: 0, due_date: '2026-10-01' },
    ];
    expect(isStalled(activeProj, completedTasks)).toBe(true);
  });

  it('returns true when all incomplete tasks in an active project are in Someday or Waiting', () => {
    const tasks = [
      { project_id: 'p1', is_completed: 0, is_trashed: 0, bucket: 'someday' },
      { project_id: 'p1', is_completed: 0, is_trashed: 0, waiting_since: '2026-10-01' },
    ];
    expect(isStalled(activeProj, tasks)).toBe(true);
  });

  it('returns false when at least one incomplete task is actionable (Anytime or undated or dated)', () => {
    const tasksWithAnytime = [
      { project_id: 'p1', is_completed: 0, is_trashed: 0, bucket: 'anytime' },
      { project_id: 'p1', is_completed: 0, is_trashed: 0, bucket: 'someday' },
    ];
    expect(isStalled(activeProj, tasksWithAnytime)).toBe(false);

    const tasksWithDated = [
      { project_id: 'p1', is_completed: 0, is_trashed: 0, due_date: '2026-10-20' },
    ];
    expect(isStalled(activeProj, tasksWithDated)).toBe(false);

    const tasksWithUndated = [
      { project_id: 'p1', is_completed: 0, is_trashed: 0, bucket: null, waiting_since: null },
    ];
    expect(isStalled(activeProj, tasksWithUndated)).toBe(false);
  });

  it('ignores trashed tasks', () => {
    const tasks = [
      { project_id: 'p1', is_completed: 0, is_trashed: 1, bucket: 'anytime' },
    ];
    // Since the only actionable task is trashed, project is stalled
    expect(isStalled(activeProj, tasks)).toBe(true);
  });

  it('returns false for non-active or someday projects', () => {
    const parkedProj = { id: 'p2', status: 'parked', is_someday: 0 };
    expect(isStalled(parkedProj, [])).toBe(false);

    const somedayProj = { id: 'p3', status: 'active', is_someday: 1 };
    expect(isStalled(somedayProj, [])).toBe(false);

    const archivedProj = { id: 'p4', status: 'archived', is_someday: 0 };
    expect(isStalled(archivedProj, [])).toBe(false);

    const completedProj = { id: 'p5', status: 'completed', is_someday: 0 };
    expect(isStalled(completedProj, [])).toBe(false);
  });
});
