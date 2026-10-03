import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';

describe('Repository: Time-Blocking & Invariant Choke Point', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');
    runMigrations(db, migrationsDir);

    taskRepo = new TaskRepository(db);
  });

  const assertInvariant = (task: { scheduled_start_min?: number | null; scheduled_duration_min?: number | null }) => {
    const start = task.scheduled_start_min;
    const duration = task.scheduled_duration_min;
    const bothNull = (start === null || start === undefined) && (duration === null || duration === undefined);
    const bothSet = typeof start === 'number' && typeof duration === 'number';
    expect(bothNull || bothSet).toBe(true);
  };

  it('initializes tasks with both time block columns as null', () => {
    const task = taskRepo.create({
      title: 'New Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    expect(task.scheduled_start_min).toBeNull();
    expect(task.scheduled_duration_min).toBeNull();
    assertInvariant(task);
  });

  it('setTimeBlock atomically sets both columns', () => {
    const task = taskRepo.create({
      title: 'Scheduled Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    const updated = taskRepo.setTimeBlock(task.id, 540, 60);
    expect(updated.scheduled_start_min).toBe(540);
    expect(updated.scheduled_duration_min).toBe(60);
    assertInvariant(updated);

    const reloaded = taskRepo.getById(task.id)!;
    expect(reloaded.scheduled_start_min).toBe(540);
    expect(reloaded.scheduled_duration_min).toBe(60);
    assertInvariant(reloaded);
  });

  it('clearTimeBlock atomically clears both columns', () => {
    const task = taskRepo.create({
      title: 'Scheduled Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task.id, 600, 30);
    const cleared = taskRepo.clearTimeBlock(task.id);

    expect(cleared.scheduled_start_min).toBeNull();
    expect(cleared.scheduled_duration_min).toBeNull();
    assertInvariant(cleared);
  });

  it('removeFromMyDay clears my_day_date and both time block columns in one transaction', () => {
    const task = taskRepo.create({
      title: 'My Day Scheduled Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task.id, 600, 45);
    taskRepo.removeFromMyDay(task.id);

    const reloaded = taskRepo.getById(task.id)!;
    expect(reloaded.my_day_date).toBeNull();
    expect(reloaded.scheduled_start_min).toBeNull();
    expect(reloaded.scheduled_duration_min).toBeNull();
    assertInvariant(reloaded);
  });

  it('rollOverToToday updates my_day_date and clears both columns atomically', () => {
    const task1 = taskRepo.create({
      title: 'Yesterday Task 1',
      list_id: 'list_inbox',
      my_day_date: '2026-10-02',
    });
    const task2 = taskRepo.create({
      title: 'Yesterday Task 2',
      list_id: 'list_inbox',
      my_day_date: '2026-10-02',
    });

    taskRepo.setTimeBlock(task1.id, 480, 60);
    taskRepo.setTimeBlock(task2.id, 540, 30);

    taskRepo.rollOverToToday([task1.id, task2.id], '2026-10-03');

    const reloaded1 = taskRepo.getById(task1.id)!;
    const reloaded2 = taskRepo.getById(task2.id)!;

    expect(reloaded1.my_day_date).toBe('2026-10-03');
    expect(reloaded1.scheduled_start_min).toBeNull();
    expect(reloaded1.scheduled_duration_min).toBeNull();
    assertInvariant(reloaded1);

    expect(reloaded2.my_day_date).toBe('2026-10-03');
    expect(reloaded2.scheduled_start_min).toBeNull();
    expect(reloaded2.scheduled_duration_min).toBeNull();
    assertInvariant(reloaded2);
  });

  it('clearAllTimeBlocks clears stale time blocks not belonging to effective today', () => {
    const todayTask = taskRepo.create({
      title: 'Today Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });
    const yesterdayTask = taskRepo.create({
      title: 'Yesterday Task',
      list_id: 'list_inbox',
      my_day_date: '2026-10-02',
    });

    taskRepo.setTimeBlock(todayTask.id, 540, 60);
    taskRepo.setTimeBlock(yesterdayTask.id, 600, 30);

    const clearedCount = taskRepo.clearAllTimeBlocks('2026-10-03');
    expect(clearedCount).toBe(1);

    const reloadedToday = taskRepo.getById(todayTask.id)!;
    expect(reloadedToday.scheduled_start_min).toBe(540);
    assertInvariant(reloadedToday);

    const reloadedYesterday = taskRepo.getById(yesterdayTask.id)!;
    expect(reloadedYesterday.scheduled_start_min).toBeNull();
    expect(reloadedYesterday.scheduled_duration_min).toBeNull();
    assertInvariant(reloadedYesterday);
  });

  it('generic update() strips scheduled_start_min and scheduled_duration_min', () => {
    const task = taskRepo.create({
      title: 'Original Title',
      list_id: 'list_inbox',
      my_day_date: '2026-10-03',
    });

    taskRepo.setTimeBlock(task.id, 540, 60);

    // Attempt to corrupt state with one column or new values via generic update
    const corruptPayload = {
      id: task.id,
      title: 'Updated Title',
      scheduled_start_min: 720,
      scheduled_duration_min: null,
    };

    const updated = taskRepo.update(corruptPayload as any);
    expect(updated.title).toBe('Updated Title');
    // Original time block should be preserved untouched!
    expect(updated.scheduled_start_min).toBe(540);
    expect(updated.scheduled_duration_min).toBe(60);
    assertInvariant(updated);

    const reloaded = taskRepo.getById(task.id)!;
    expect(reloaded.scheduled_start_min).toBe(540);
    expect(reloaded.scheduled_duration_min).toBe(60);
    assertInvariant(reloaded);
  });
});
