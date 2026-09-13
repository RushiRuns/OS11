import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { WorkerManager } from '../../src/main/services/worker-manager.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';

describe('Phase 3: WorkerManager & Fallback Search', () => {
  let db: Database.Database;
  let workerMgr: WorkerManager;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    workerMgr = new WorkerManager();
  });

  it('handles search queries in fallback mode gracefully', async () => {
    const taskRepo = new TaskRepository(db);
    taskRepo.create({
      title: 'Deep focus architecture session',
      notes: 'Investigating background search workers',
    });

    const results = await workerMgr.search('architecture');
    expect(Array.isArray(results)).toBe(true);
  });

  it('handles standard ping message', async () => {
    const res = await workerMgr.send('PING');
    expect(res).toBe(true);
  });
});
