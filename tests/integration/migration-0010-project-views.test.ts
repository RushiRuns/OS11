import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';

describe('Integration: Migration 0010 - Project Curated Views', () => {
  let db: Database.Database;
  let tempMigrationsDir: string;
  const realMigrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-migration-0010-'));
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tempMigrationsDir)) {
        fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('migrates existing projects to have all 5 views enabled and supports new curated views', () => {
    // 1. Copy migrations 0001 to 0009
    const migrationFiles = fs
      .readdirSync(realMigrationsDir)
      .filter((f) => {
        const m = f.match(/^(\d+)_/);
        return m ? parseInt(m[1], 10) < 10 : false;
      })
      .sort();

    for (const file of migrationFiles) {
      fs.copyFileSync(path.join(realMigrationsDir, file), path.join(tempMigrationsDir, file));
    }

    // Run up to v9
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(9);

    // Insert an existing project before migration 0010
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO projects (id, name, description, color, icon, status, due_date, default_view, sort_order, area_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('p-legacy-1', 'Legacy Roadmaps', 'Created before 0010', '#1B88FF', '🚀', 'active', null, 'board', 10, 'area_default', now, now);

    // 2. Now add migration 0010
    fs.copyFileSync(
      path.join(realMigrationsDir, '0010_project_views.sql'),
      path.join(tempMigrationsDir, '0010_project_views.sql')
    );

    // Run migration 0010
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(10);

    const repo = new ProjectRepository(db);

    // 3. Verify the pre-existing project was automatically backfilled with all 5 views
    const legacyProject = repo.getById('p-legacy-1');
    expect(legacyProject).not.toBeNull();
    expect(legacyProject!.views).toEqual(['list', 'board', 'timeline', 'calendar', 'table']);
    expect(legacyProject!.default_view).toBe('board');

    // 4. Verify a newly created project with curated views stores and retrieves only those views
    const curated = repo.create({
      name: 'Curated 2-View Project',
      default_view: 'timeline',
      views: ['list', 'timeline'],
    });

    const fetchedCurated = repo.getById(curated.id);
    expect(fetchedCurated).not.toBeNull();
    expect(fetchedCurated!.views).toEqual(['list', 'timeline']);
    expect(fetchedCurated!.default_view).toBe('timeline');
  });
});
