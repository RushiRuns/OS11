import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';

describe('Integration: Complete Task Lifecycle Flow', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let identityRepo: IdentityRepository;
  let reminderRepo: ReminderRepository;
  let settingsRepo: SettingsRepository;
  let tagRepo: TagRepository;
  let historyRepo: TaskHistoryRepository;
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
    settingsRepo = new SettingsRepository(db);
    tagRepo = new TagRepository(db);
    historyRepo = new TaskHistoryRepository(db);

    taskService = new TaskService(
      taskRepo,
      identityRepo,
      reminderRepo,
      settingsRepo,
      tagRepo,
      historyRepo
    );
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('executes full lifecycle: Create → Complete (recurring) → Undo → Trash → Restore → Permanent Delete', () => {
    // 1. Create recurring task
    const recurringTask = taskService.create({
      title: 'Daily engineering sync',
      recurrence_rule: 'RRULE:FREQ=DAILY',
      due_date: '2026-09-14',
      priority: 2,
    });
    expect(recurringTask.id).toBeDefined();
    expect(recurringTask.is_completed).toBe(0);

    // Create a reminder for this task
    reminderRepo.create({
      task_id: recurringTask.id,
      remind_at: '2026-09-14T09:00:00Z',
    });
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(1);

    // 2. Complete recurring task
    taskService.complete(recurringTask.id);

    // Initial task is marked completed
    const completedInitial = taskService.getById(recurringTask.id);
    expect(completedInitial.is_completed).toBe(1);
    expect(completedInitial.completed_at).not.toBeNull();

    // Verify next occurrence was generated
    const allTasks = taskService.getAll();
    const nextOccurrences = allTasks.filter(
      (t) => t.title === 'Daily engineering sync' && t.id !== recurringTask.id
    );
    expect(nextOccurrences.length).toBe(1);
    expect(nextOccurrences[0].is_completed).toBe(0);
    expect(nextOccurrences[0].due_date).toBe('2026-09-15');
    expect(nextOccurrences[0].recurrence_rule).toBe('RRULE:FREQ=DAILY');

    // 3. Undo (uncomplete) the completed initial task
    taskService.uncomplete(recurringTask.id);
    const uncompleted = taskService.getById(recurringTask.id);
    expect(uncompleted.is_completed).toBe(0);
    expect(uncompleted.completed_at).toBeNull();

    // 4. Trash the task
    taskService.trash(recurringTask.id);
    const trashed = taskService.getById(recurringTask.id);
    expect(trashed.is_trashed).toBe(1);
    expect(trashed.trashed_at).not.toBeNull();
    // Reminders must be cancelled when moved to trash
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);

    // 5. Restore task from trash
    taskService.restore(recurringTask.id);
    const restored = taskService.getById(recurringTask.id);
    expect(restored.is_trashed).toBe(0);
    expect(restored.trashed_at).toBeNull();

    // 6. Permanent delete
    const deleteResult = taskService.delete(recurringTask.id);
    expect(deleteResult).toBe(true);
    expect(() => taskService.getById(recurringTask.id)).toThrow();
  });
});
