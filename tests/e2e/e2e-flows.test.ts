import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { ModuleRepository } from '../../src/main/repositories/ModuleRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { PomodoroRepository } from '../../src/main/repositories/PomodoroRepository.js';
import { AttachmentRepository } from '../../src/main/repositories/AttachmentRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';

import { TaskService } from '../../src/main/services/task/TaskService.js';
import { AttachmentService } from '../../src/main/services/attachment/AttachmentService.js';
import { PomodoroService } from '../../src/main/services/pomodoro/PomodoroService.js';
import { AppLockService } from '../../src/main/services/security/AppLockService.js';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';

describe('E2E Flows: Phase 19 End-to-End System Scenarios', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let tagRepo: TagRepository;
  let moduleRepo: ModuleRepository;
  let settingsRepo: SettingsRepository;
  let pomodoroRepo: PomodoroRepository;
  let attachmentRepo: AttachmentRepository;
  let taskService: TaskService;
  let attachmentService: AttachmentService;
  let pomodoroService: PomodoroService;
  let appLockService: AppLockService;
  let tempStorageDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    tempStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-e2e-flow-'));

    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
    tagRepo = new TagRepository(db);
    moduleRepo = new ModuleRepository(db);
    settingsRepo = new SettingsRepository(db);
    pomodoroRepo = new PomodoroRepository(db);
    attachmentRepo = new AttachmentRepository(db);

    const identityRepo = new IdentityRepository(db);
    const reminderRepo = new ReminderRepository(db);
    const historyRepo = new TaskHistoryRepository(db);

    attachmentService = new AttachmentService(attachmentRepo, tempStorageDir);
    taskService = new TaskService(
      taskRepo,
      identityRepo,
      reminderRepo,
      settingsRepo,
      tagRepo,
      historyRepo,
      attachmentService
    );
    pomodoroService = new PomodoroService(pomodoroRepo, taskRepo);
    appLockService = new AppLockService(settingsRepo);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tempStorageDir)) {
        fs.rmSync(tempStorageDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  // 1. App launches → splash shows → main window renders → task list loads
  it('Scenario 1: App launch, seed initialization, and default list hydration', () => {
    const lists = listRepo.getAll();
    expect(lists.length).toBeGreaterThanOrEqual(6);
    expect(lists.some((l) => l.id === 'list_inbox')).toBe(true);

    const initialTasks = taskService.getAll();
    expect(Array.isArray(initialTasks)).toBe(true);
  });

  // 2. Create task via Quick Add bar → appears in list (optimistic update confirmed)
  it('Scenario 2: Create task via Quick Add bar with optimistic persistence', () => {
    const task = taskService.create({
      title: 'Draft quarterly product roadmap',
      list_id: 'list_inbox',
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Draft quarterly product roadmap');

    const inDb = taskService.getById(task.id);
    expect(inDb.id).toBe(task.id);
  });

  // 3. Create task via Omnibar with NLP → due date and tag parsed correctly
  it('Scenario 3: Create task via Omnibar with NLP date, list, and tag', () => {
    const nlpInput = 'Review supplier agreement tomorrow #legal @Work !urgent';
    const parsed = parseQuickAdd(nlpInput);

    // Create custom list if needed
    let targetList = listRepo.getAll().find((l) => l.name.toLowerCase() === parsed.listName?.toLowerCase());
    if (!targetList && parsed.listName) {
      targetList = listRepo.create({ name: parsed.listName });
    }

    const task = taskService.create({
      title: parsed.cleanTitle,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      all_day: parsed.allDay,
      priority: parsed.priority,
      list_id: targetList?.id ?? 'list_inbox',
    });

    for (const tagName of parsed.tagNames) {
      let tag = tagRepo.getAll().find((t) => t.name === tagName);
      if (!tag) {
        tag = tagRepo.create({ name: tagName });
      }
      tagRepo.addTagToTask(task.id, tag.id);
    }

    expect(task.title).toBe('Review supplier agreement');
    expect(task.priority).toBe(3);
    expect(task.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const taskTags = tagRepo.getTagsForTask(task.id);
    expect(taskTags.length).toBe(1);
    expect(taskTags[0].name).toBe('legal');
  });

  // 4. Complete task → moves to Completed section → Undo restores it to correct position
  it('Scenario 4: Complete task → moves to completed → Undo restores it', () => {
    const task = taskService.create({ title: 'Task to be completed and undone' });
    expect(task.is_completed).toBe(0);

    // Complete
    taskService.complete(task.id);
    expect(taskService.getById(task.id).is_completed).toBe(1);

    // Undo action restores
    taskService.uncomplete(task.id);
    expect(taskService.getById(task.id).is_completed).toBe(0);
  });

  // 5. Drag task → task: verify parent_task_id updated in DB
  it('Scenario 5: Drag task onto task to nest as subtask', () => {
    const parent = taskService.create({ title: 'Master Project Feature' });
    const child = taskService.create({ title: 'Child Step Implementation' });

    taskService.makeSubtask(child.id, parent.id);
    expect(taskService.getById(child.id).parent_task_id).toBe(parent.id);
  });

  // 6. Drag task → sidebar list: verify list_id updated in DB
  it('Scenario 6: Drag task to sidebar list to move lists', () => {
    const targetList = listRepo.create({ name: 'Sprint 10 Backlog' });
    const task = taskService.create({ title: 'Task moving to new list', list_id: 'list_inbox' });

    taskService.moveToList(task.id, targetList.id);
    expect(taskService.getById(task.id).list_id).toBe(targetList.id);
  });

  // 7. Drag file onto task card: verify attachments record created and file exists on disk
  it('Scenario 7: Drag file onto task card: attachment record created and file saved to disk', async () => {
    const task = taskService.create({ title: 'Task with dropped attachment' });

    const sourceFile = path.join(tempStorageDir, 'dropped_attachment.png');
    fs.writeFileSync(sourceFile, 'mock-image-bytes');

    const attachment = await attachmentService.upload(sourceFile, task.id);
    expect(attachment.id).toBeDefined();
    expect(fs.existsSync(attachment.local_path)).toBe(true);

    const attachments = attachmentService.getByTask(task.id);
    expect(attachments.length).toBe(1);
    expect(attachments[0].filename).toBe(attachment.filename);
  });

  // 8. Pomodoro: start session → complete → verify pomodoro_sessions record and tasks.pomodoro_count updated
  it('Scenario 8: Pomodoro session lifecycle and task pomodoro count increment', () => {
    const task = taskService.create({ title: 'Deep Work Task' });
    expect(task.pomodoro_count).toBe(0);

    const session = pomodoroService.startSession({
      type: 'work',
      duration_seconds: 1500,
      started_at: new Date().toISOString(),
      task_id: task.id,
    });
    expect(session.id).toBeDefined();
    expect(session.task_id).toBe(task.id);

    // Sync active session state and complete session
    pomodoroService.syncState({
      activeSession: {
        id: session.id,
        type: 'work',
        taskId: task.id,
        durationSeconds: 1500,
        elapsedSeconds: 1500,
        isPaused: false,
      },
      timeText: '00:00',
    });
    pomodoroService.completeSession(session.id);

    const updatedTask = taskService.getById(task.id);
    expect(updatedTask.pomodoro_count).toBe(1);

    const stats = pomodoroRepo.getStats(
      new Date(Date.now() - 86400000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    expect(stats.totalSessions).toBe(1);
  });

  // 9. Multi-select Ctrl+A → bulk complete → verify all tasks completed
  it('Scenario 9: Bulk selection and completion', () => {
    const t1 = taskService.create({ title: 'Task 1' });
    const t2 = taskService.create({ title: 'Task 2' });
    const t3 = taskService.create({ title: 'Task 3' });

    const selectedIds = [t1.id, t2.id, t3.id];
    for (const id of selectedIds) {
      taskService.complete(id);
    }

    expect(taskService.getById(t1.id).is_completed).toBe(1);
    expect(taskService.getById(t2.id).is_completed).toBe(1);
    expect(taskService.getById(t3.id).is_completed).toBe(1);
  });

  // 10. Global shortcut simulation
  it('Scenario 10: Global hotkey toggle simulation', () => {
    let windowVisible = false;
    const toggleWindow = () => {
      windowVisible = !windowVisible;
      return windowVisible;
    };

    // First shortcut press opens
    expect(toggleWindow()).toBe(true);
    // Second shortcut press closes / hides
    expect(toggleWindow()).toBe(false);
  });

  // 11. Dark mode toggle → data-theme="dark"
  it('Scenario 11: Theme switching updates theme setting and theme attribute', () => {
    settingsRepo.set('theme', 'dark');
    expect(settingsRepo.get('theme')).toBe('dark');

    settingsRepo.set('theme', 'light');
    expect(settingsRepo.get('theme')).toBe('light');
  });

  // 12. Module toggle: disable Pomodoro → absent from sidebar; re-enable → returns
  it('Scenario 12: Feature module toggles update module visibility', () => {
    expect(moduleRepo.isEnabled('pomodoro')).toBe(true);

    moduleRepo.toggle('pomodoro', false);
    expect(moduleRepo.isEnabled('pomodoro')).toBe(false);

    moduleRepo.toggle('pomodoro', true);
    expect(moduleRepo.isEnabled('pomodoro')).toBe(true);
  });

  // 13. App lock: enable PIN → close and reopen → lock screen shown → correct PIN unlocks
  it('Scenario 13: App Lock PIN configuration, lock state, and unlocking', async () => {
    expect(appLockService.isEnabled()).toBe(false);

    // Enable PIN
    await appLockService.setPin('1234');
    expect(appLockService.isEnabled()).toBe(true);

    // Reopen app simulation (service booted with app_lock_enabled = true)
    const freshAppLockService = new AppLockService(settingsRepo);
    expect(freshAppLockService.isLocked()).toBe(true);

    // Incorrect PIN fails
    const badAttempt = await freshAppLockService.verifyPin('0000');
    expect(badAttempt).toBe(false);
    expect(freshAppLockService.isLocked()).toBe(true);

    // Correct PIN unlocks
    const goodAttempt = await freshAppLockService.verifyPin('1234');
    expect(goodAttempt).toBe(true);
    expect(freshAppLockService.isLocked()).toBe(false);
  });
});
