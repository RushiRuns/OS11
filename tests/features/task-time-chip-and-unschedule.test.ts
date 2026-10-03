import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { useUndoRedoStore } from '../../src/renderer/hooks/useUndoRedo.js';
import { formatTimeRange } from '../../src/renderer/features/lists/scheduler/useSchedulerLayout.js';

describe('Task Time Chip, Unschedule Gestures & Rollover', () => {
  let db: Database.Database;
  let repo: TaskRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');
    runMigrations(db, migrationsDir);

    repo = new TaskRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('formats time range accurately for time chip display', () => {
    // 9:00 AM to 10:30 AM (540 to 630 min)
    expect(formatTimeRange(540, 90)).toBe('9:00 AM – 10:30 AM');
    // 1:15 PM to 2:00 PM (795 to 840 min)
    expect(formatTimeRange(795, 45)).toBe('1:15 PM – 2:00 PM');
    // Midnight to 12:45 AM (0 to 45 min)
    expect(formatTimeRange(0, 45)).toBe('12:00 AM – 12:45 AM');
  });

  it('clears scheduled_start_min and scheduled_duration_min when removeFromMyDay is called', () => {
    const today = '2026-10-03';
    const task = repo.create({
      title: 'Scheduled Task',
      my_day_date: today,
    });

    repo.setTimeBlock(task.id, 540, 60);
    const scheduled = repo.getById(task.id);
    expect(scheduled?.scheduled_start_min).toBe(540);
    expect(scheduled?.scheduled_duration_min).toBe(60);

    // Call removeFromMyDay
    repo.removeFromMyDay(task.id);
    const removed = repo.getById(task.id);
    expect(removed?.my_day_date).toBeNull();
    expect(removed?.scheduled_start_min).toBeNull();
    expect(removed?.scheduled_duration_min).toBeNull();
  });

  it('clears time block columns when generic update sets my_day_date to null', () => {
    const today = '2026-10-03';
    const task = repo.create({
      title: 'Scheduled Task 2',
      my_day_date: today,
    });

    repo.setTimeBlock(task.id, 600, 30);
    const scheduled = repo.getById(task.id);
    expect(scheduled?.scheduled_start_min).toBe(600);

    // Generic update with my_day_date: null
    repo.update(task.id, { my_day_date: null });
    const updated = repo.getById(task.id);
    expect(updated?.my_day_date).toBeNull();
    expect(updated?.scheduled_start_min).toBeNull();
    expect(updated?.scheduled_duration_min).toBeNull();
  });

  it('rollOverToToday updates date and nulls time blocks in one atomic transaction', () => {
    const yesterday = '2026-10-02';
    const today = '2026-10-03';
    const task1 = repo.create({ title: 'Task 1', my_day_date: yesterday });
    const task2 = repo.create({ title: 'Task 2', my_day_date: yesterday });

    repo.setTimeBlock(task1.id, 480, 60);
    repo.setTimeBlock(task2.id, 600, 45);

    repo.rollOverToToday([task1.id, task2.id], today);

    const rolled1 = repo.getById(task1.id);
    const rolled2 = repo.getById(task2.id);

    expect(rolled1?.my_day_date).toBe(today);
    expect(rolled1?.scheduled_start_min).toBeNull();
    expect(rolled1?.scheduled_duration_min).toBeNull();

    expect(rolled2?.my_day_date).toBe(today);
    expect(rolled2?.scheduled_start_min).toBeNull();
    expect(rolled2?.scheduled_duration_min).toBeNull();
  });

  it('pushAction records undo/redo for scheduling actions and executes correctly', async () => {
    useUndoRedoStore.setState({ undoStack: [], redoStack: [] });

    let currentStart: number | null = 540;
    let currentDur: number | null = 60;

    // Simulate unschedule action
    useUndoRedoStore.getState().pushAction({
      description: 'Unscheduled "Test Task"',
      undoFn: () => {
        currentStart = 540;
        currentDur = 60;
      },
      redoFn: () => {
        currentStart = null;
        currentDur = null;
      },
    });

    currentStart = null;
    currentDur = null;

    expect(useUndoRedoStore.getState().undoStack).toHaveLength(1);
    expect(useUndoRedoStore.getState().undoStack[0].description).toBe('Unscheduled "Test Task"');

    // Perform undo
    await useUndoRedoStore.getState().undo();
    expect(currentStart).toBe(540);
    expect(currentDur).toBe(60);
    expect(useUndoRedoStore.getState().redoStack).toHaveLength(1);

    // Perform redo
    await useUndoRedoStore.getState().redo();
    expect(currentStart).toBeNull();
    expect(currentDur).toBeNull();
  });
});
