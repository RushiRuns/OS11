import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/main/migrations/runner.js';
import path from 'node:path';

describe('Migration 0017: Custom Groups', () => {
  it('applies cleanly on an in-memory database and passes foreign_key_check', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationsDir = path.join(process.cwd(), 'src/main/migrations');
    runMigrations(db, migrationsDir);

    const version = db.pragma('user_version', { simple: true });
    expect(version).toBeGreaterThanOrEqual(17);

    // Foreign key integrity check
    const fkErrors = db.pragma('foreign_key_check');
    expect(fkErrors).toEqual([]);

    // Check table creations
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r: any) => r.name);

    expect(tables).toContain('custom_groups');
    expect(tables).toContain('custom_group_sections');
    expect(tables).toContain('project_group_overrides');
    expect(tables).toContain('task_custom_values');

    db.close();
  });
});
