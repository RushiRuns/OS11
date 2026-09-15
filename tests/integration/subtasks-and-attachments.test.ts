import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { AttachmentRepository } from '../../src/main/repositories/AttachmentRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { AttachmentService } from '../../src/main/services/attachment/AttachmentService.js';

describe('Integration: Subtasks and Attachments Lifecycle', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let attachmentRepo: AttachmentRepository;
  let taskService: TaskService;
  let attachmentService: AttachmentService;
  let tempDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-subtask-attach-'));

    taskRepo = new TaskRepository(db);
    attachmentRepo = new AttachmentRepository(db);
    attachmentService = new AttachmentService(attachmentRepo, tempDir);

    const identityRepo = new IdentityRepository(db);
    const reminderRepo = new ReminderRepository(db);
    const settingsRepo = new SettingsRepository(db);
    const tagRepo = new TagRepository(db);
    const historyRepo = new TaskHistoryRepository(db);

    taskService = new TaskService(
      taskRepo,
      identityRepo,
      reminderRepo,
      settingsRepo,
      tagRepo,
      historyRepo,
      attachmentService
    );
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  it('verifies subtask creation, nesting, and promotion', () => {
    // 1. Create parent task
    const parent = taskService.create({ title: 'Parent task' });
    expect(parent.parent_task_id).toBeNull();

    // 2. Create child subtask
    const child = taskService.create({
      title: 'Child subtask',
      parent_task_id: parent.id,
    });
    expect(child.parent_task_id).toBe(parent.id);

    // Verify subtasks query
    const subtasks = taskService.getSubtasks(parent.id);
    expect(subtasks.length).toBe(1);
    expect(subtasks[0].id).toBe(child.id);

    // 3. Promote child subtask to top-level task
    const promoted = taskService.promoteToTask(child.id);
    expect(promoted.parent_task_id).toBeNull();

    // Verify parent has no more subtasks
    expect(taskService.getSubtasks(parent.id).length).toBe(0);
  });

  it('verifies attachment upload and automatic disk cleanup on task deletion', async () => {
    // 1. Create task
    const task = taskService.create({ title: 'Task with attachment' });

    // 2. Create a source file to attach
    const sampleSourceFile = path.join(tempDir, 'sample_attachment.pdf');
    fs.writeFileSync(sampleSourceFile, 'PDF file content mockup');

    // 3. Upload file via AttachmentService
    const attachment = await attachmentService.upload(sampleSourceFile, task.id);
    expect(attachment.id).toBeDefined();
    expect(attachment.local_path).toBeDefined();
    expect(fs.existsSync(attachment.local_path)).toBe(true);

    // Verify attachment in DB
    const listBefore = attachmentService.getByTask(task.id);
    expect(listBefore.length).toBe(1);

    // 4. Delete the task
    taskService.delete(task.id);

    // 5. Verify DB record removed and file physically removed from disk
    expect(fs.existsSync(attachment.local_path)).toBe(false);
    expect(attachmentService.getByTask(task.id).length).toBe(0);
  });
});
