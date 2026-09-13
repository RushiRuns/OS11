import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { ValidationError } from '../../src/main/domain/task-validation.js';

describe('Phase 3: TaskService Workflow & Business Rules', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let identityRepo: IdentityRepository;
  let reminderRepo: ReminderRepository;
  let taskService: TaskService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    taskRepo = new TaskRepository(db);
    identityRepo = new IdentityRepository(db);
    reminderRepo = new ReminderRepository(db);
    taskService = new TaskService(taskRepo, identityRepo, reminderRepo);
  });

  it('validates task creation and assigns local device identity', () => {
    expect(() => taskService.create({ title: '' })).toThrow(ValidationError);

    const task = taskService.create({
      title: 'Valid Task',
      priority: 3,
      notes: '<script>alert("xss")</script>Hello Notes',
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Valid Task');
    expect(task.priority).toBe(3);
    expect(task.notes).not.toContain('<script>');
    expect(task.notes).toContain('Hello Notes');
    expect(task.assignee_device_id).toBeDefined();
  });

  it('automatically creates next occurrence when completing recurring task', () => {
    const recurringTask = taskService.create({
      title: 'Daily Standup Meeting',
      recurrence_rule: 'RRULE:FREQ=DAILY',
      due_date: '2026-09-13',
    });

    taskService.complete(recurringTask.id);

    // Initial task is completed
    const completed = taskService.getById(recurringTask.id);
    expect(completed.is_completed).toBe(1);

    // New recurring instance should have been generated
    const allTasks = taskService.getAll();
    const nextTasks = allTasks.filter(
      (t) => t.title === 'Daily Standup Meeting' && t.id !== recurringTask.id
    );
    expect(nextTasks.length).toBe(1);
    expect(nextTasks[0].is_completed).toBe(0);
    expect(nextTasks[0].recurrence_rule).toBe('RRULE:FREQ=DAILY');
  });

  it('prevents cyclic subtask hierarchies', () => {
    const parent = taskService.create({ title: 'Parent Task' });
    const child = taskService.create({ title: 'Child Task', parent_task_id: parent.id });

    // A task cannot be subtask of itself
    expect(() => taskService.makeSubtask(parent.id, parent.id)).toThrow(ValidationError);

    // Parent cannot become a subtask of its own child
    expect(() => taskService.makeSubtask(parent.id, child.id)).toThrow(ValidationError);
  });

  it('cancels scheduled reminders when task is moved to trash', () => {
    const task = taskService.create({ title: 'Task with Reminders' });
    reminderRepo.create({
      task_id: task.id,
      remind_at: '2026-09-14T10:00:00Z',
    });

    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(1);

    taskService.trash(task.id);
    expect(taskService.getById(task.id).is_trashed).toBe(1);
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);
  });

  it('adds and removes task from My Day', () => {
    const task = taskService.create({ title: 'Important Project Milestone' });
    taskService.addToMyDay(task.id, '2026-09-13');
    expect(taskService.getMyDay('2026-09-13').length).toBe(1);

    taskService.removeFromMyDay(task.id);
    expect(taskService.getMyDay('2026-09-13').length).toBe(0);
  });
});
