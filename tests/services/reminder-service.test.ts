import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { ReminderService } from '../../src/main/services/reminder/ReminderService.js';

describe('Phase 3: ReminderService Scheduling & Overdue Processing', () => {
  let db: Database.Database;
  let reminderRepo: ReminderRepository;
  let taskRepo: TaskRepository;
  let notifRepo: NotificationRepository;
  let notifService: NotificationService;
  let reminderService: ReminderService;

  beforeEach(() => {
    vi.useFakeTimers();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    reminderRepo = new ReminderRepository(db);
    taskRepo = new TaskRepository(db);
    notifRepo = new NotificationRepository(db);
    notifService = new NotificationService(notifRepo);
    reminderService = new ReminderService(reminderRepo, notifService, taskRepo);
  });

  afterEach(() => {
    reminderService.dispose();
    vi.useRealTimers();
  });

  it('triggers immediate alert for overdue reminders on startup', () => {
    const task = taskRepo.create({ title: 'Overdue task' });
    reminderRepo.create({
      task_id: task.id,
      remind_at: new Date(Date.now() - 60000).toISOString(),
    });

    reminderService.processOverdueAtStartup();
    // Overdue reminder is marked triggered immediately
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);
  });

  it('schedules future reminder and triggers when time elapses', () => {
    const task = taskRepo.create({ title: 'Upcoming alarm' });
    const futureTime = new Date(Date.now() + 5000).toISOString();
    const reminder = reminderService.create({
      task_id: task.id,
      remind_at: futureTime,
    });

    expect(reminder.id).toBeDefined();
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(1);

    // Fast-forward time by 6 seconds
    vi.advanceTimersByTime(6000);

    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);
  });

  it('snoozes reminder to a future time', () => {
    const task = taskRepo.create({ title: 'Snooze task' });
    const reminder = reminderService.create({
      task_id: task.id,
      remind_at: new Date(Date.now() + 1000).toISOString(),
    });

    const snoozedUntil = new Date(Date.now() + 60000).toISOString();
    reminderService.snooze(reminder.id, snoozedUntil);

    // After 2 seconds, it should NOT trigger yet because it was snoozed to 60s
    vi.advanceTimersByTime(2000);
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(1);

    // Advance remaining 59 seconds
    vi.advanceTimersByTime(59000);
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);
  });

  it('cancels reminder', () => {
    const task = taskRepo.create({ title: 'To be cancelled' });
    const reminder = reminderService.create({
      task_id: task.id,
      remind_at: new Date(Date.now() + 10000).toISOString(),
    });

    reminderService.cancel(reminder.id);
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);
  });
});
