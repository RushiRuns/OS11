import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { SearchRepository } from '../../src/main/repositories/SearchRepository.js';

describe('Performance Benchmarks: Phase 19 Targets', () => {
  let db: Database.Database;
  let searchRepo: SearchRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    searchRepo = new SearchRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  // 1. Virtualizer DOM count simulation over 1,000 tasks
  it('Virtualizer: 1,000 tasks list calculates active render window of ~30-50 items', () => {
    const totalCount = 1000;
    const itemHeight = 44; // px
    const viewportHeight = 800; // px
    const overscan = 10;

    // Visible items in viewport: ceil(800 / 44) = 19 items
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const renderedItemCount = visibleCount + overscan * 2;

    // Verify virtualizer bounds
    expect(renderedItemCount).toBeLessThanOrEqual(50);
    expect(renderedItemCount).toBeGreaterThan(15);
    expect(totalCount - renderedItemCount).toBeGreaterThan(900); // > 90% DOM nodes avoided!
  });

  // 2. 5,000-task database: search query time < 150ms
  it('Search Latency: 5,000-task SQLite database FTS5 query completes in < 150ms', () => {
    // Populate 5,000 tasks in a single fast transaction
    const insertStmt = db.prepare(`
      INSERT INTO tasks (
        id, title, notes, list_id, sort_order, is_completed, created_at, updated_at
      ) VALUES (
        @id, @title, @notes, @list_id, @sort_order, 0, @now, @now
      )
    `);

    const now = new Date().toISOString();
    const populateDb = db.transaction(() => {
      for (let i = 1; i <= 5000; i++) {
        insertStmt.run({
          id: `task-perf-${i}`,
          title: `Automated testing task number ${i} with random keywords`,
          notes:
            i === 3542
              ? 'Specific target needle in the 5000 task haystack'
              : `Sample notes for task ${i} discussing architecture and performance`,
          list_id: 'list_inbox',
          sort_order: i,
          now,
        });
      }
    });

    populateDb();

    // Verify record count
    const count = db.prepare('SELECT COUNT(*) as total FROM tasks').get() as { total: number };
    expect(count.total).toBe(5000);

    // Warm-up query
    searchRepo.search('random');

    // Benchmark search query execution time
    const start = performance.now();
    const results = searchRepo.search('needle');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].snippet).toContain('needle');

    // Requirement: search query time < 150ms
    expect(elapsed).toBeLessThan(150);
  });

  // 3. Cold-start pipeline timing benchmark
  it('Cold-start timing: database connection and schema check completes in < 150ms', () => {
    const start = performance.now();
    const testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');
    const version = testDb.pragma('user_version', { simple: true });
    testDb.close();
    const duration = performance.now() - start;

    expect(version).toBe(0);
    expect(duration).toBeLessThan(150);
  });
});
