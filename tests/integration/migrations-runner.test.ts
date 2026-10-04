import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { runMigrations } from '../../src/main/migrations/runner.js';

describe('Integration: Database Schema Migration Runner', () => {
  let db: Database.Database;
  let tempMigrationsDir: string;

  const realMigrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-migration-test-'));
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

  it('runs step-by-step migrations: version 0 → v1 → v2 → v3 → v4', () => {
    // 0. Initially version is 0 and no tables exist
    let version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(0);

    // 1. Copy 0001_initial_schema.sql and apply
    fs.copyFileSync(
      path.join(realMigrationsDir, '0001_initial_schema.sql'),
      path.join(tempMigrationsDir, '0001_initial_schema.sql')
    );
    runMigrations(db, tempMigrationsDir);

    version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(1);

    // Verify core tables exist
    const taskTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    expect(taskTable).toBeDefined();

    const listsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lists'")
      .get();
    expect(listsTable).toBeDefined();

    // 2. Copy 0002_habit_flag.sql and apply
    fs.copyFileSync(
      path.join(realMigrationsDir, '0002_habit_flag.sql'),
      path.join(tempMigrationsDir, '0002_habit_flag.sql')
    );
    runMigrations(db, tempMigrationsDir);

    version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(2);

    // Verify is_habit column in tasks
    const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
    expect(taskCols.some((col) => col.name === 'is_habit')).toBe(true);

    // 3. Copy 0003_attachment_links.sql and apply
    fs.copyFileSync(
      path.join(realMigrationsDir, '0003_attachment_links.sql'),
      path.join(tempMigrationsDir, '0003_attachment_links.sql')
    );
    runMigrations(db, tempMigrationsDir);

    version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(3);

    // Verify is_link column in attachments
    const attachCols = db.prepare('PRAGMA table_info(attachments)').all() as Array<{ name: string }>;
    expect(attachCols.some((col) => col.name === 'is_link')).toBe(true);

    // 4. Copy 0004_task_history.sql and apply
    fs.copyFileSync(
      path.join(realMigrationsDir, '0004_task_history.sql'),
      path.join(tempMigrationsDir, '0004_task_history.sql')
    );
    runMigrations(db, tempMigrationsDir);

    version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);

    // Verify task_history table exists
    const historyTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='task_history'")
      .get();
    expect(historyTable).toBeDefined();

    // 5. Re-running migrations is idempotent and does not fail
    expect(() => runMigrations(db, tempMigrationsDir)).not.toThrow();
    version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);
  });

  it('reconciles desynchronized user_version when physical schema lacks migration columns and brings database up to date', () => {
    // 1. Run migrations up to v8 (initial schema through areas)
    for (let i = 1; i <= 8; i++) {
      const pad = String(i).padStart(4, '0');
      const file = fs.readdirSync(realMigrationsDir).find((f) => f.startsWith(`${pad}_`));
      if (file) {
        fs.copyFileSync(path.join(realMigrationsDir, file), path.join(tempMigrationsDir, file));
      }
    }
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(8);

    // 2. Artificially bump user_version to 11 (simulating desync/crash/corrupted version bump)
    db.pragma('user_version = 11');
    expect(db.pragma('user_version', { simple: true })).toBe(11);

    // 3. Add remaining migrations (9, 10, 11) to migrations directory
    for (let i = 9; i <= 11; i++) {
      const pad = String(i).padStart(4, '0');
      const file = fs.readdirSync(realMigrationsDir).find((f) => f.startsWith(`${pad}_`));
      if (file) {
        fs.copyFileSync(path.join(realMigrationsDir, file), path.join(tempMigrationsDir, file));
      }
    }

    // 4. Run migrations again - should detect that columns are missing, re-align version, and apply 9, 10, 11
    runMigrations(db, tempMigrationsDir);

    expect(db.pragma('user_version', { simple: true })).toBe(11);

    // 5. Verify the missing columns from 9, 10, 11 actually exist now
    const areaCols = db.prepare('PRAGMA table_info(areas)').all() as Array<{ name: string }>;
    expect(areaCols.some((c) => c.name === 'is_default')).toBe(true);

    const projectCols = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    expect(projectCols.some((c) => c.name === 'views')).toBe(true);

    const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
    expect(taskCols.some((c) => c.name === 'scheduled_start_min')).toBe(true);
    expect(taskCols.some((c) => c.name === 'scheduled_duration_min')).toBe(true);

    // 6. Verify clearAllTimeBlocks SQL query prepares and executes without SqliteError
    expect(() => {
      db.prepare(`
        UPDATE tasks
        SET scheduled_start_min = NULL,
            scheduled_duration_min = NULL,
            updated_at = ?
        WHERE scheduled_start_min IS NOT NULL
      `).run(new Date().toISOString());
    }).not.toThrow();
  });

  it('applies migration 0012_gtd_scheduling: columns, indexes, module seeds, settings, and reconciles v12', () => {
    // 1. Run migrations up to v11
    for (let i = 1; i <= 11; i++) {
      const pad = String(i).padStart(4, '0');
      const file = fs.readdirSync(realMigrationsDir).find((f) => f.startsWith(`${pad}_`));
      if (file) {
        fs.copyFileSync(path.join(realMigrationsDir, file), path.join(tempMigrationsDir, file));
      }
    }
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(11);

    // 2. Copy 0012_gtd_scheduling.sql and run
    const file12 = fs.readdirSync(realMigrationsDir).find((f) => f.startsWith('0012_'));
    expect(file12).toBeDefined();
    fs.copyFileSync(path.join(realMigrationsDir, file12!), path.join(tempMigrationsDir, file12!));

    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(12);

    // 3. Verify tasks table columns
    const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>;
    expect(taskCols.some((c) => c.name === 'bucket')).toBe(true);
    expect(taskCols.some((c) => c.name === 'waiting_on')).toBe(true);
    expect(taskCols.some((c) => c.name === 'waiting_since')).toBe(true);
    expect(taskCols.some((c) => c.name === 'follow_up_date')).toBe(true);
    expect(taskCols.some((c) => c.name === 'follow_up_notified_on')).toBe(true);
    expect(taskCols.some((c) => c.name === 'reviewed_at')).toBe(true);

    // 4. Verify projects table columns
    const projectCols = db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>;
    expect(projectCols.some((c) => c.name === 'is_someday')).toBe(true);
    expect(projectCols.some((c) => c.name === 'reviewed_at')).toBe(true);

    // 5. Verify indexes
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_tasks_bucket');
    expect(indexNames).toContain('idx_tasks_waiting');
    expect(indexNames).toContain('idx_tasks_inbox');
    expect(indexNames).toContain('idx_projects_someday');

    // 6. Verify seeded module rows
    const modules = db.prepare('SELECT module_name FROM modules').all() as Array<{ module_name: string }>;
    const modNames = modules.map((m) => m.module_name);
    expect(modNames).toContain('anytime');
    expect(modNames).toContain('someday');
    expect(modNames).toContain('waiting_for');

    // 7. Verify seeded settings
    const settingDays = db.prepare("SELECT value FROM settings WHERE key = 'gtd_someday_review_interval_days'").get() as { value: string };
    expect(settingDays).toBeDefined();
    expect(settingDays.value).toBe('14');

    const settingWaiting = db.prepare("SELECT value FROM settings WHERE key = 'gtd_auto_clear_waiting_on_complete'").get() as { value: string };
    expect(settingWaiting).toBeDefined();
    expect(settingWaiting.value).toBe('true');

    // 8. Verify seeded smart lists
    const smartLists = db.prepare("SELECT id, smart_type FROM lists WHERE id IN ('smart_anytime', 'smart_someday', 'smart_waiting_for')").all() as Array<{ id: string; smart_type: string }>;
    expect(smartLists.length).toBe(3);

    // 9. Test reconciler: if user_version is bumped to 12 on a v11 db lacking bucket column, reconciler pulls back to 11
    const testDb = new Database(':memory:');
    const desyncTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-desync-test-'));
    try {
      for (let i = 1; i <= 11; i++) {
        const pad = String(i).padStart(4, '0');
        const file = fs.readdirSync(realMigrationsDir).find((f) => f.startsWith(`${pad}_`));
        if (file) {
          fs.copyFileSync(path.join(realMigrationsDir, file), path.join(desyncTempDir, file));
        }
      }
      runMigrations(testDb, desyncTempDir);
      expect(testDb.pragma('user_version', { simple: true })).toBe(11);
      
      // Artificially bump to 12 when 0012 hasn't run
      testDb.pragma('user_version = 12');
      
      // Now add 0012 to the directory
      fs.copyFileSync(path.join(realMigrationsDir, file12!), path.join(desyncTempDir, file12!));

      // Running migrations should detect missing v12 columns/rows, realign version to 11, then apply 12
      runMigrations(testDb, desyncTempDir);
      expect(testDb.pragma('user_version', { simple: true })).toBe(12);
    } finally {
      testDb.close();
      fs.rmSync(desyncTempDir, { recursive: true, force: true });
    }
  });
});

