import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { ReminderService } from '../../src/main/services/reminder/ReminderService.js';
import { TaskSchedulingService } from '../../src/main/services/task/TaskSchedulingService.js';

describe('Architecture: Single-Writer Scheduling Discipline', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let reminderRepo: ReminderRepository;
  let reminderService: ReminderService;
  let schedulingService: TaskSchedulingService;

  const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, migrationsDir);
    taskRepo = new TaskRepository(db);
    reminderRepo = new ReminderRepository(db);
    reminderService = new ReminderService(reminderRepo);
    schedulingService = new TaskSchedulingService(db, taskRepo, undefined, reminderRepo, reminderService);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Static Code Analysis: Only TaskSchedulingService (and TaskService completion/promotion) updates scheduling fields', () => {
    it('verifies updateSchedulingFields is not called outside allowed services', () => {
      const servicesDir = path.resolve(__dirname, '../../src/main/services');
      const files: string[] = [];

      function walk(dir: string) {
        for (const item of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
          } else if (item.endsWith('.ts')) {
            files.push(fullPath);
          }
        }
      }
      walk(servicesDir);

      const allowedFiles = [
        'TaskSchedulingService.ts',
        'TaskService.ts', // complete() auto-clear waiting and addToMyDay() someday promotion
      ];

      for (const file of files) {
        const baseName = path.basename(file);
        const content = fs.readFileSync(file, 'utf8');

        if (content.includes('updateSchedulingFields')) {
          expect(
            allowedFiles.includes(baseName),
            `Unexpected call to updateSchedulingFields in ${baseName}`
          ).toBe(true);
        }
      }
    });
  });

  describe('Single-Writer Functional Enforcement', () => {
    it('transitions dated task to Someday and strips reminders', async () => {
      const task = taskRepo.create({
        title: 'Call Accountant',
        due_date: '2026-10-15',
      });

      // Add a reminder
      reminderRepo.create({
        task_id: task.id,
        remind_at: '2026-10-15T09:00:00.000Z',
      });
      expect(reminderRepo.getByTaskId(task.id)).toHaveLength(1);

      // Execute transition to Someday via TaskSchedulingService
      const result = await schedulingService.setBucket({ taskId: task.id, bucket: 'someday' });

      expect(result.changeReport.previousState.bucket).toBeNull();
      expect(result.changeReport.previousState.due_date).toBe('2026-10-15');
      expect(result.changeReport.newState.bucket).toBe('someday');
      expect(result.changeReport.newState.due_date).toBeNull();
      expect(result.changeReport.cancelledReminderIds).toHaveLength(1);

      const updated = taskRepo.getById(task.id)!;
      expect(updated.bucket).toBe('someday');
      expect(updated.due_date).toBeNull();
      expect(reminderRepo.getByTaskId(task.id)).toHaveLength(0);
    });

    it('sets date on Someday task and clears bucket', async () => {
      const task = taskRepo.create({
        title: 'Read Book',
        bucket: 'someday',
      });

      const result = await schedulingService.setDate({ taskId: task.id, dueDate: '2026-10-20' });
      expect(result.changeReport.previousState.bucket).toBe('someday');
      expect(result.changeReport.newState.bucket).toBeNull();
      expect(result.changeReport.newState.due_date).toBe('2026-10-20');

      const updated = taskRepo.getById(task.id)!;
      expect(updated.bucket).toBeNull();
      expect(updated.due_date).toBe('2026-10-20');
    });

    it('sets waiting overlay without altering bucket', async () => {
      const task = taskRepo.create({
        title: 'Review PR',
        bucket: 'anytime',
      });

      const result = await schedulingService.setWaiting({
        taskId: task.id,
        waitingOn: 'Alice',
        followUpDate: '2026-10-10',
      });

      expect(result.changeReport.newState.bucket).toBe('anytime');
      expect(result.changeReport.newState.waiting_on).toBe('Alice');
      expect(result.changeReport.newState.follow_up_date).toBe('2026-10-10');

      const updated = taskRepo.getById(task.id)!;
      expect(updated.bucket).toBe('anytime');
      expect(updated.waiting_on).toBe('Alice');
    });

    it('restores previous scheduling state atomically', async () => {
      const task = taskRepo.create({
        title: 'Original Task',
        bucket: 'someday',
      });

      const result = await schedulingService.setBucket({ taskId: task.id, bucket: 'anytime' });
      expect(result.changeReport.newState.bucket).toBe('anytime');

      // Undo by restoring changeReport.previousState
      const restoreResult = await schedulingService.restoreSchedulingState(
        task.id,
        result.changeReport.previousState
      );
      expect(restoreResult.changeReport.newState.bucket).toBe('someday');

      const restored = taskRepo.getById(task.id)!;
      expect(restored.bucket).toBe('someday');
    });

    it('calculates GTD counts correctly', () => {
      taskRepo.create({ title: 'Inbox 1' });
      taskRepo.create({ title: 'Inbox 2' });
      taskRepo.create({ title: 'Anytime 1', bucket: 'anytime' });
      taskRepo.create({ title: 'Someday 1', bucket: 'someday' });
      taskRepo.create({
        title: 'Waiting 1',
        bucket: 'anytime',
        waiting_on: 'Bob',
        waiting_since: '2026-10-04',
      });

      const counts = schedulingService.getGtdCounts();
      expect(counts.inbox).toBe(2);
      expect(counts.anytime).toBe(2); // Anytime 1 + Waiting 1
      expect(counts.someday).toBe(1);
      expect(counts.waitingFor).toBe(1);
    });
  });
});
