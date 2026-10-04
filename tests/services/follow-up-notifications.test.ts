import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { runMigrations } from '../../src/main/migrations/runner.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { ReminderService } from '../../src/main/services/reminder/ReminderService.js';

describe('GTD Follow-Up Notifications', () => {
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

    const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');
    runMigrations(db, migrationsDir);

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

  it('notifies for due follow-ups and updates follow_up_notified_on', () => {
    const today = '2026-10-04';
    const task = taskRepo.create({
      title: 'Approve vendor contract',
      waiting_since: '2026-10-01',
      waiting_on: 'Alice',
      follow_up_date: '2026-10-04',
    });

    const notifiedCount = reminderService.checkDueFollowUps(today);
    expect(notifiedCount).toBe(1);

    // Verify notification was recorded in notification_history
    const notifs = notifRepo.getAll();
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('Waiting For: Alice');
    expect(notifs[0].body).toBe('Approve vendor contract');
    expect(notifs[0].task_id).toBe(task.id);

    // Running again today should NOT duplicate notification
    const secondPassCount = reminderService.checkDueFollowUps(today);
    expect(secondPassCount).toBe(0);
    expect(notifRepo.getAll().length).toBe(1);
  });

  it('does not notify if follow_up_date is in the future', () => {
    const today = '2026-10-04';
    taskRepo.create({
      title: 'Review PR',
      waiting_since: '2026-10-01',
      waiting_on: 'Bob',
      follow_up_date: '2026-10-06',
    });

    const notifiedCount = reminderService.checkDueFollowUps(today);
    expect(notifiedCount).toBe(0);
    expect(notifRepo.getAll().length).toBe(0);
  });

  it('does not notify if task is completed or trashed', () => {
    const today = '2026-10-04';
    const t1 = taskRepo.create({
      title: 'Already finished',
      waiting_since: '2026-10-01',
      waiting_on: 'Charlie',
      follow_up_date: '2026-10-04',
    });
    taskRepo.update(t1.id, { is_completed: 1 });

    const t2 = taskRepo.create({
      title: 'Already deleted',
      waiting_since: '2026-10-01',
      waiting_on: 'Dave',
      follow_up_date: '2026-10-04',
    });
    taskRepo.trash(t2.id);

    const notifiedCount = reminderService.checkDueFollowUps(today);
    expect(notifiedCount).toBe(0);
  });

  it('uses fallback title when waiting_on is empty', () => {
    const today = '2026-10-04';
    taskRepo.create({
      title: 'Waiting with no contact specified',
      waiting_since: '2026-10-01',
      follow_up_date: '2026-10-04',
    });

    reminderService.checkDueFollowUps(today);
    const notifs = notifRepo.getAll();
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('Waiting For Follow-Up');
  });
});
