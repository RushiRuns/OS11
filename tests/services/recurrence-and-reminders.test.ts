import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { ModuleRepository } from '../../src/main/repositories/ModuleRepository.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { ReminderService } from '../../src/main/services/reminder/ReminderService.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { CalendarService } from '../../src/main/services/calendar/CalendarService.js';
import {
  isValidRRule,
  humanReadableRRule,
  buildCustomRRule,
  calculateNextOccurrence,
} from '../../src/shared/utils/recurrence.js';

describe('Phase 11: Scheduling, Recurrence, Reminders & Calendar Integration', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let identityRepo: IdentityRepository;
  let reminderRepo: ReminderRepository;
  let moduleRepo: ModuleRepository;
  let notifRepo: NotificationRepository;
  let notifService: NotificationService;
  let reminderService: ReminderService;
  let taskService: TaskService;
  let calendarService: CalendarService;

  beforeEach(() => {
    vi.useFakeTimers();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    taskRepo = new TaskRepository(db);
    identityRepo = new IdentityRepository(db);
    reminderRepo = new ReminderRepository(db);
    moduleRepo = new ModuleRepository(db);
    notifRepo = new NotificationRepository(db);
    notifService = new NotificationService(notifRepo);
    reminderService = new ReminderService(reminderRepo, notifService, taskRepo);
    taskService = new TaskService(taskRepo, identityRepo, reminderRepo);
    calendarService = new CalendarService(moduleRepo, taskRepo);
  });

  afterEach(() => {
    reminderService.dispose();
    vi.useRealTimers();
  });

  describe('Recurrence Engine Utilities', () => {
    it('validates rules and provides human-readable summary', () => {
      expect(isValidRRule('RRULE:FREQ=DAILY')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=WEEKLY;BYDAY=TU,TH')).toBe(true);
      expect(isValidRRule('INVALID')).toBe(false);

      const text = humanReadableRRule('RRULE:FREQ=DAILY');
      expect(text.toLowerCase()).toContain('every day');
    });

    it('builds custom recurrence rules accurately', () => {
      const rule = buildCustomRRule({
        frequency: 'WEEKLY',
        interval: 2,
        daysOfWeek: ['TU', 'TH'],
      });
      expect(rule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH');
      expect(isValidRRule(rule)).toBe(true);
    });

    it('calculates fixed recurrence based on due_date', () => {
      const next = calculateNextOccurrence(
        'RRULE:FREQ=DAILY',
        'fixed',
        '2026-09-10',
        new Date('2026-09-14T10:00:00Z')
      );
      expect(next).not.toBeNull();
      // Daily recurrence from 2026-09-10 -> 2026-09-11
      expect(next?.toISOString().startsWith('2026-09-11')).toBe(true);
    });

    it('calculates after_completion recurrence based on completion time', () => {
      const completionDate = new Date('2026-09-20T10:00:00Z');
      const next = calculateNextOccurrence(
        'RRULE:FREQ=DAILY',
        'after_completion',
        '2026-09-10', // old overdue due_date
        completionDate
      );
      expect(next).not.toBeNull();
      // Should calculate after 2026-09-20
      expect(next?.toISOString().startsWith('2026-09-21')).toBe(true);
    });
  });

  describe('TaskService.complete() Recurrence Scenarios', () => {
    it('generates next fixed occurrence inheriting parent properties and resetting progress', () => {
      const parentTask = taskService.create({
        title: 'Weekly Team Sync',
        notes: 'Review sprint progress',
        due_date: '2026-09-10',
        due_time: '14:00',
        priority: 3,
        is_starred: true,
        estimated_minutes: 45,
        recurrence_rule: 'RRULE:FREQ=WEEKLY',
        recurrence_basis: 'fixed',
        my_day_date: '2026-09-10',
      });

      // Update pomodoro_count in DB to test reset
      db.prepare('UPDATE tasks SET pomodoro_count = 5 WHERE id = ?').run(parentTask.id);

      // Complete the recurring task
      taskService.complete(parentTask.id);

      // Verify parent task is completed
      const completedParent = taskService.getById(parentTask.id);
      expect(completedParent.is_completed).toBe(1);
      expect(completedParent.completed_at).toBeDefined();

      // Verify newly created next instance
      const allTasks = taskService.getAll();
      const nextTask = allTasks.find(
        (t) => t.title === 'Weekly Team Sync' && t.id !== parentTask.id
      );

      expect(nextTask).toBeDefined();
      expect(nextTask?.is_completed).toBe(0);
      expect(nextTask?.completed_at).toBeNull();
      expect(nextTask?.my_day_date).toBeNull();
      expect(nextTask?.pomodoro_count).toBe(0);

      // Preserved fields
      expect(nextTask?.notes).toBe('Review sprint progress');
      expect(nextTask?.priority).toBe(3);
      expect(nextTask?.is_starred).toBe(1);
      expect(nextTask?.estimated_minutes).toBe(45);
      expect(nextTask?.due_time).toBe('14:00');
      expect(nextTask?.recurrence_rule).toBe('RRULE:FREQ=WEEKLY');
      expect(nextTask?.recurrence_basis).toBe('fixed');
      // Next weekly date from 2026-09-10 is 2026-09-17
      expect(nextTask?.due_date).toBe('2026-09-17');
    });

    it('generates next after-completion occurrence from today', () => {
      const parentTask = taskService.create({
        title: 'Water the plants',
        due_date: '2026-08-01', // old overdue date
        recurrence_rule: 'RRULE:FREQ=DAILY;INTERVAL=3',
        recurrence_basis: 'after_completion',
      });

      taskService.complete(parentTask.id);

      const allTasks = taskService.getAll();
      const nextTask = allTasks.find(
        (t) => t.title === 'Water the plants' && t.id !== parentTask.id
      );

      expect(nextTask).toBeDefined();
      expect(nextTask?.is_completed).toBe(0);
      expect(nextTask?.recurrence_basis).toBe('after_completion');
      // Should not be 2026-08-04, but rather scheduled 3 days from today
      const nowStr = new Date().toISOString().split('T')[0];
      expect(nextTask?.due_date).not.toBe('2026-08-04');
      expect(new Date(nextTask!.due_date!).getTime()).toBeGreaterThan(new Date(nowStr).getTime());
    });

    it('skips next occurrence when skipRecurrence option is passed', () => {
      const recurringTask = taskService.create({
        title: 'One-off Skip Test',
        recurrence_rule: 'RRULE:FREQ=DAILY',
        due_date: '2026-09-14',
      });

      taskService.complete(recurringTask.id, { skipRecurrence: true });

      const completed = taskService.getById(recurringTask.id);
      expect(completed.is_completed).toBe(1);

      // No new task should be spawned
      const allTasks = taskService.getAll();
      const extraTasks = allTasks.filter((t) => t.title === 'One-off Skip Test');
      expect(extraTasks.length).toBe(1);
    });
  });

  describe('Reminder System Wiring & Snooze Presets', () => {
    it('manages multiple reminders per task and deletes reminder', () => {
      const task = taskRepo.create({ title: 'Task with 3 reminders' });

      const r1 = reminderRepo.create({ task_id: task.id, remind_at: '2026-09-15T09:00:00Z' });
      const r2 = reminderRepo.create({ task_id: task.id, remind_at: '2026-09-15T12:00:00Z' });

      const forTask = reminderService.getByTaskId(task.id);
      expect(forTask.length).toBe(2);

      reminderService.delete(r1.id);
      expect(reminderService.getByTaskId(task.id).length).toBe(1);
      expect(reminderService.getByTaskId(task.id)[0].id).toBe(r2.id);
    });

    it('supports snooze presets (15m, 1h, tomorrow 8am)', () => {
      const task = taskRepo.create({ title: 'Snooze test' });
      const reminder = reminderService.create({
        task_id: task.id,
        remind_at: new Date(Date.now() + 1000).toISOString(),
      });

      // Snooze 15m
      reminderService.snoozePreset(reminder.id, '15m');
      let upcoming = reminderRepo.getUpcomingAndOverdue().find((r) => r.id === reminder.id);
      expect(upcoming?.snoozed_until).toBeDefined();

      // Snooze 1h
      reminderService.snoozePreset(reminder.id, '1h');
      upcoming = reminderRepo.getUpcomingAndOverdue().find((r) => r.id === reminder.id);
      expect(upcoming?.snoozed_until).toBeDefined();

      // Snooze tomorrow 8am
      reminderService.snoozePreset(reminder.id, 'tomorrow_8am');
      upcoming = reminderRepo.getUpcomingAndOverdue().find((r) => r.id === reminder.id);
      expect(new Date(upcoming!.snoozed_until!).getHours()).toBe(8);
    });

    it('reschedules after sleep', () => {
      const task = taskRepo.create({ title: 'Sleep Wake Test' });
      reminderService.create({
        task_id: task.id,
        remind_at: new Date(Date.now() + 60000).toISOString(),
      });

      // Simulate powerMonitor resume
      expect(() => reminderService.rescheduleAfterSleep()).not.toThrow();
    });
  });

  describe('CalendarService (Optional Module)', () => {
    it('is disabled by default and returns empty events', async () => {
      expect(calendarService.isEnabled()).toBe(false);
      const events = await calendarService.getEvents();
      expect(events).toEqual([]);

      const status = calendarService.getStatus();
      expect(status.enabled).toBe(false);
      expect(status.connectedProviders).toEqual([]);
    });

    it('connects provider when module is enabled and returns external events', async () => {
      moduleRepo.toggle('calendar_integration', true);
      expect(calendarService.isEnabled()).toBe(true);

      const conn = await calendarService.connectProvider('google');
      expect(conn.success).toBe(true);

      const status = calendarService.getStatus();
      expect(status.connectedProviders).toContain('google');

      const events = await calendarService.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].provider).toBe('google');
    });

    it('performs two-way sync: creates calendar event from scheduled task', async () => {
      moduleRepo.toggle('calendar_integration', true);

      const task = taskService.create({
        title: 'Quarterly Financial Review',
        notes: 'Bring balance sheet',
        due_date: '2026-09-25',
        due_time: '15:30',
        estimated_minutes: 60,
      });

      const event = await calendarService.syncTaskToCalendar(task.id, 'google');
      expect(event).toBeDefined();
      expect(event.title).toBe('Quarterly Financial Review');
      expect(event.start_time).toContain('2026-09-25T15:30:00');
      expect(event.provider).toBe('google');
      expect(event.task_id).toBe(task.id);
    });

    it('throws error when syncing unscheduled task or when module disabled', async () => {
      moduleRepo.toggle('calendar_integration', true);

      const unscheduledTask = taskService.create({ title: 'Someday task without date' });
      await expect(calendarService.syncTaskToCalendar(unscheduledTask.id)).rejects.toThrow(
        'Cannot sync a task without a due date to calendar.'
      );

      moduleRepo.toggle('calendar_integration', false);
      await expect(calendarService.syncTaskToCalendar(unscheduledTask.id)).rejects.toThrow(
        'Calendar integration module is disabled.'
      );
    });
  });
});
