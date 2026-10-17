import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runMigrations } from '../../src/main/migrations/runner.js';

describe('Integration: OKR Migration 0018 & Runner Reconciliation', () => {
  let db: Database.Database;
  let tempMigrationsDir: string;
  const realMigrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-okr-migration-test-'));

    // Copy all migrations 0001 to 0018 into temp dir
    const files = fs.readdirSync(realMigrationsDir).filter((f) => f.endsWith('.sql'));
    for (const f of files) {
      fs.copyFileSync(path.join(realMigrationsDir, f), path.join(tempMigrationsDir, f));
    }
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    if (fs.existsSync(tempMigrationsDir)) {
      fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
    }
  });

  it('runs all migrations 0001 to 0018 on fresh database and ends at user_version = 18', () => {
    runMigrations(db, tempMigrationsDir);
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(18);

    // Verify objectives, key_results, kr_check_ins, kr_habit_logs exist
    const hasObjectives = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='objectives'").get();
    const hasKeyResults = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='key_results'").get();
    const hasCheckIns = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kr_check_ins'").get();
    const hasHabitLogs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kr_habit_logs'").get();
    expect(hasObjectives).toBeTruthy();
    expect(hasKeyResults).toBeTruthy();
    expect(hasCheckIns).toBeTruthy();
    expect(hasHabitLogs).toBeTruthy();

    // Verify old goal tables dropped
    const hasGoals = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='goals'").get();
    const hasGoalLinks = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='goal_links'").get();
    expect(hasGoals).toBeFalsy();
    expect(hasGoalLinks).toBeFalsy();
  });

  it('reopening that database applies no migration and keeps user_version at 18', () => {
    // 1. Initial run
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(18);

    // 2. Re-run migrations on the same DB instance (simulates app reopen / reconcile)
    runMigrations(db, tempMigrationsDir);
    const versionAfterReopen = db.pragma('user_version', { simple: true }) as number;
    expect(versionAfterReopen).toBe(18);
  });

  it('reconciles and heals a database where OKR migration 18 ran but user_version was desynchronized to 12', () => {
    // 1. Initial run: runs all migrations to v18
    runMigrations(db, tempMigrationsDir);
    expect(db.pragma('user_version', { simple: true })).toBe(18);

    // 2. Simulate desynchronization: user_version downgraded to 12 (as occurred when legacy goal checks failed)
    db.pragma('user_version = 12');
    expect(db.pragma('user_version', { simple: true })).toBe(12);

    // 3. Re-running migrations should detect v18 schema, realign user_version to 18, and NOT fail on 0013
    expect(() => runMigrations(db, tempMigrationsDir)).not.toThrow();
    const healedVersion = db.pragma('user_version', { simple: true }) as number;
    expect(healedVersion).toBe(18);
  });
});

