import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ProjectService } from '../../src/main/services/project/ProjectService.js';
import type { ProjectViewMode } from '../../src/shared/types/index.js';

describe('Project Views Domain Model & Service Validation', () => {
  let db: Database.Database;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let projectService: ProjectService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        icon TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        due_date TEXT,
        default_view TEXT NOT NULL DEFAULT 'list',
        views TEXT NOT NULL DEFAULT '["list","board","timeline","calendar","table"]',
        sort_order INTEGER NOT NULL DEFAULT 0,
        group_id TEXT,
        area_id TEXT DEFAULT 'area_default',
        is_pinned INTEGER DEFAULT 0,
        pinned_sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        area_id TEXT,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_trashed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    projectRepo = new ProjectRepository(db);
    taskRepo = new TaskRepository(db);
    projectService = new ProjectService(projectRepo, taskRepo);
  });

  afterEach(() => {
    db.close();
  });

  it('persists and deserializes curated views in ProjectRepository', () => {
    const curatedViews: ProjectViewMode[] = ['list', 'board'];
    const created = projectRepo.create({
      name: 'Curated Project',
      default_view: 'board',
      views: curatedViews,
    });

    expect(created.views).toEqual(['list', 'board']);
    expect(created.default_view).toBe('board');

    const fetched = projectRepo.getById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.views).toEqual(['list', 'board']);
    expect(fetched!.default_view).toBe('board');
  });

  it('defaults to all 5 views when views are not provided in ProjectRepository', () => {
    const created = projectRepo.create({
      name: 'Legacy Style Project',
    });

    expect(created.views).toEqual(['list', 'board', 'timeline', 'calendar', 'table']);
    expect(created.default_view).toBe('list');
  });

  it('throws an error in ProjectService when creating a project with empty views', () => {
    expect(() => {
      projectService.create({
        name: 'Empty Views Project',
        views: [],
      });
    }).toThrow('A project must have at least one view enabled.');
  });

  it('throws an error in ProjectService when updating a project with empty views', () => {
    const project = projectService.create({
      name: 'Valid Project',
      views: ['list', 'table'],
    });

    expect(() => {
      projectService.update(project.id, {
        views: [],
      });
    }).toThrow('A project must have at least one view enabled.');
  });

  it('falls back default_view to views[0] if provided default_view is not in views', () => {
    const created = projectService.create({
      name: 'Fallback Default Project',
      default_view: 'calendar',
      views: ['list', 'board'],
    });

    expect(created.views).toEqual(['list', 'board']);
    expect(created.default_view).toBe('list');
  });

  it('auto-adjusts default_view on update when current default view is removed from views', () => {
    const created = projectService.create({
      name: 'Multi View Project',
      default_view: 'timeline',
      views: ['timeline', 'calendar', 'table'],
    });

    expect(created.default_view).toBe('timeline');

    // Remove 'timeline' from views
    const updated = projectService.update(created.id, {
      views: ['calendar', 'table'],
    });

    expect(updated.views).toEqual(['calendar', 'table']);
    expect(updated.default_view).toBe('calendar');
  });
});
