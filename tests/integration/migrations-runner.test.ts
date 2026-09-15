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
});
