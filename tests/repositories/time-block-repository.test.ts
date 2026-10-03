import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { runMigrations } from '../../src/main/migrations/runner.js';

describe('TaskRepository - Time Block Choke Points and Constraints', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, migrationsDir);
    taskRepo = new TaskRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('verifies 0011 migration adds columns with CHECK constraints', () => {
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(11);

    const task = taskRepo.create({
      title: 'Check constraint test',
      list_id: 'list_inbox',
    });

    // Valid start and duration
    expect(() => {
      db.prepare(
        'UPDATE tasks SET scheduled_start_min = 540, scheduled_duration_min = 60 WHERE id = ?'
      ).run(task.id);
    }).not.toThrow();

    // Invalid start (< 0)
    expect(() => {
      db.prepare('UPDATE tasks SET scheduled_start_min = -1 WHERE id = ?').run(task.id);
    }).toThrow();

    // Invalid start (>= 1440)
    expect(() => {
      db.prepare('UPDATE tasks SET scheduled_start_min = 1440 WHERE id = ?').run(task.id);
    }).toThrow();

    // Invalid duration (< 15)
    expect(() => {
      db.prepare('UPDATE tasks SET scheduled_duration_min = 10 WHERE id = ?').run(task.id);
    }).toThrow();

    // Invalid duration (> 480)
    expect(() => {
      db.prepare('UPDATE tasks SET scheduled_duration_min = 500 WHERE id = ?').run(task.id);
    }).toThrow();
  });

  it('enforces both columns set or both NULL via setTimeBlock and clearTimeBlock', () => {
    const task = taskRepo.create({
      title: 'Time block test',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    expect(task.scheduled_start_min).toBeNull();
    expect(task.scheduled_duration_min).toBeNull();

    const scheduled = taskRepo.setTimeBlock(task.id, 600, 45);
    expect(scheduled.scheduled_start_min).toBe(600);
    expect(scheduled.scheduled_duration_min).toBe(45);

    const fetched = taskRepo.getById(task.id);
    expect(fetched?.scheduled_start_min).toBe(600);
    expect(fetched?.scheduled_duration_min).toBe(45);

    const cleared = taskRepo.clearTimeBlock(task.id);
    expect(cleared.scheduled_start_min).toBeNull();
    expect(cleared.scheduled_duration_min).toBeNull();

    const fetchedCleared = taskRepo.getById(task.id);
    expect(fetchedCleared?.scheduled_start_min).toBeNull();
    expect(fetchedCleared?.scheduled_duration_min).toBeNull();
  });

  it('ensures generic update() strips scheduled columns and does not alter time blocks', () => {
    const task = taskRepo.create({
      title: 'Generic update test',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task.id, 600, 30);

    // Attempt to mutate scheduled_start_min via generic update
    const updated = taskRepo.update({
      id: task.id,
      title: 'New title',
      scheduled_start_min: 700 as any,
      scheduled_duration_min: 90 as any,
    });

    expect(updated.title).toBe('New title');
    expect(updated.scheduled_start_min).toBe(600);
    expect(updated.scheduled_duration_min).toBe(30);

    // Attempt to set scheduled_start_min to NULL via generic update
    const updated2 = taskRepo.update({
      id: task.id,
      title: 'Another title',
      scheduled_start_min: null as any,
    });

    expect(updated2.title).toBe('Another title');
    expect(updated2.scheduled_start_min).toBe(600);
    expect(updated2.scheduled_duration_min).toBe(30);
  });

  it('removeFromMyDay clears time block columns in the same transaction', () => {
    const task = taskRepo.create({
      title: 'Remove from My Day test',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task.id, 600, 30);
    taskRepo.removeFromMyDay(task.id);
    const updated = taskRepo.getById(task.id);

    expect(updated?.my_day_date).toBeNull();
    expect(updated?.scheduled_start_min).toBeNull();
    expect(updated?.scheduled_duration_min).toBeNull();
  });

  it('rollOverToToday updates date and clears time blocks', () => {
    const task1 = taskRepo.create({
      title: 'Task 1',
      list_id: 'list_inbox',
      my_day_date: '2026-10-02',
    });
    const task2 = taskRepo.create({
      title: 'Task 2',
      list_id: 'list_inbox',
      my_day_date: '2026-10-02',
    });

    taskRepo.setTimeBlock(task1.id, 600, 30);
    taskRepo.setTimeBlock(task2.id, 700, 60);

    taskRepo.rollOverToToday([task1.id, task2.id], '2026-10-03');

    const fetched1 = taskRepo.getById(task1.id);
    const fetched2 = taskRepo.getById(task2.id);

    expect(fetched1?.my_day_date).toBe('2026-10-03');
    expect(fetched1?.scheduled_start_min).toBeNull();
    expect(fetched1?.scheduled_duration_min).toBeNull();

    expect(fetched2?.my_day_date).toBe('2026-10-03');
    expect(fetched2?.scheduled_start_min).toBeNull();
    expect(fetched2?.scheduled_duration_min).toBeNull();
  });

  it('clearAllTimeBlocks resets all tasks with time blocks to NULL', () => {
    const task1 = taskRepo.create({
      title: 'Task 1',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });
    const task2 = taskRepo.create({
      title: 'Task 2',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task1.id, 600, 30);
    taskRepo.setTimeBlock(task2.id, 700, 60);

    taskRepo.clearAllTimeBlocks();

    expect(taskRepo.getById(task1.id)?.scheduled_start_min).toBeNull();
    expect(taskRepo.getById(task1.id)?.scheduled_duration_min).toBeNull();
    expect(taskRepo.getById(task2.id)?.scheduled_start_min).toBeNull();
    expect(taskRepo.getById(task2.id)?.scheduled_duration_min).toBeNull();
  });
});
