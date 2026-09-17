import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { ListGroupRepository } from '../../src/main/repositories/ListGroupRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { SectionRepository } from '../../src/main/repositories/SectionRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { AttachmentRepository } from '../../src/main/repositories/AttachmentRepository.js';
import { PomodoroRepository } from '../../src/main/repositories/PomodoroRepository.js';
import { GoalRepository } from '../../src/main/repositories/GoalRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { ModuleRepository } from '../../src/main/repositories/ModuleRepository.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { SearchRepository } from '../../src/main/repositories/SearchRepository.js';

describe('Phase 2 Repositories & Database Layer', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Load and execute 0001_initial_schema.sql
    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  });

  it('verifies seeds from initial migration', () => {
    const listRepo = new ListRepository(db);
    const lists = listRepo.getAll();
    expect(lists.length).toBeGreaterThanOrEqual(6);

    const moduleRepo = new ModuleRepository(db);
    const modules = moduleRepo.getAll();
    expect(modules.length).toBe(13);
    expect(moduleRepo.isEnabled('my_day')).toBe(true);
    expect(moduleRepo.isEnabled('vim_keybindings')).toBe(false);

    const settingsRepo = new SettingsRepository(db);
    const theme = settingsRepo.get('theme', 'fallback');
    expect(theme).toBe('auto');
  });

  it('tests TaskRepository CRUD, subtasks, My Day, trash and order', () => {
    const taskRepo = new TaskRepository(db);

    // Create task
    const task = taskRepo.create({
      title: 'Repository unit test',
      list_id: 'list_inbox',
      priority: 2,
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Repository unit test');
    expect(task.priority).toBe(2);

    // Read by id
    const found = taskRepo.getById(task.id);
    expect(found?.id).toBe(task.id);

    // Create task with non-existent list_id (verifies fallback to list_inbox without FOREIGN KEY error)
    const fallbackTask = taskRepo.create({
      title: 'Task with invalid list',
      list_id: 'non_existent_list_xyz',
    });
    expect(fallbackTask.id).toBeDefined();
    expect(fallbackTask.list_id).toBe('list_inbox');

    // Update task
    const updated = taskRepo.update(task.id, { title: 'Updated unit test title' });
    expect(updated.title).toBe('Updated unit test title');

    // Complete / uncomplete
    taskRepo.complete(task.id);
    expect(taskRepo.getById(task.id)?.is_completed).toBe(1);
    taskRepo.uncomplete(task.id);
    expect(taskRepo.getById(task.id)?.is_completed).toBe(0);

    // Star / unstar
    taskRepo.star(task.id);
    expect(taskRepo.getById(task.id)?.is_starred).toBe(1);
    expect(taskRepo.getImportant().length).toBe(1);
    taskRepo.unstar(task.id);
    expect(taskRepo.getById(task.id)?.is_starred).toBe(0);

    // My Day
    taskRepo.addToMyDay(task.id, '2026-09-13');
    expect(taskRepo.getMyDay('2026-09-13').length).toBe(1);
    taskRepo.removeFromMyDay(task.id);
    expect(taskRepo.getMyDay('2026-09-13').length).toBe(0);

    // Subtasks
    const subtask = taskRepo.create({
      title: 'Subtask 1',
      list_id: 'list_inbox',
      parent_task_id: task.id,
    });
    const subtasks = taskRepo.getSubtasks(task.id);
    expect(subtasks.length).toBe(1);
    expect(subtasks[0].id).toBe(subtask.id);

    // Trash and restore
    taskRepo.trash(task.id);
    expect(taskRepo.getById(task.id)?.is_trashed).toBe(1);
    expect(taskRepo.getTrashed().length).toBe(1);
    taskRepo.restore(task.id);
    expect(taskRepo.getById(task.id)?.is_trashed).toBe(0);

    // Update sort order
    taskRepo.updateSortOrder(task.id, 500);
    expect(taskRepo.getById(task.id)?.sort_order).toBe(500);

    // Permanent delete
    taskRepo.permanentDelete(subtask.id);
    expect(taskRepo.getById(subtask.id)).toBeNull();
  });

  it('tests ListRepository and ListGroupRepository', () => {
    const groupRepo = new ListGroupRepository(db);
    const group = groupRepo.create({ name: 'Work Folders', sort_order: 1 });
    expect(group.id).toBeDefined();
    expect(groupRepo.getAll().length).toBe(1);

    const listRepo = new ListRepository(db);
    const list = listRepo.create({
      name: 'Sprint Backlog',
      color: '#ff0000',
      group_id: group.id,
    });
    expect(list.id).toBeDefined();
    expect(list.name).toBe('Sprint Backlog');

    listRepo.update(list.id, { name: 'Sprint 42 Backlog' });
    expect(listRepo.getById(list.id)?.name).toBe('Sprint 42 Backlog');

    listRepo.reorder([{ id: list.id, sortOrder: 99 }]);
    expect(listRepo.getById(list.id)?.sort_order).toBe(99);

    listRepo.delete(list.id);
    expect(listRepo.getById(list.id)).toBeNull();

    groupRepo.delete(group.id);
    expect(groupRepo.getAll().length).toBe(0);
  });

  it('tests ProjectRepository and SectionRepository', () => {
    const projectRepo = new ProjectRepository(db);
    const project = projectRepo.create({ name: 'Redesign UI' });
    expect(project.id).toBeDefined();
    expect(projectRepo.getAll().length).toBe(1);

    const sectionRepo = new SectionRepository(db);
    const section = sectionRepo.create({
      project_id: project.id,
      name: 'In Progress',
      sort_order: 1,
    });
    expect(section.id).toBeDefined();
    expect(sectionRepo.getByProjectId(project.id).length).toBe(1);

    sectionRepo.update(section.id, { name: 'Done' });
    expect(sectionRepo.getByProjectId(project.id)[0].name).toBe('Done');

    projectRepo.archive(project.id);
    expect(projectRepo.getById(project.id)?.status).toBe('archived');

    sectionRepo.delete(section.id);
    expect(sectionRepo.getByProjectId(project.id).length).toBe(0);
  });

  it('tests TagRepository and task association', () => {
    const taskRepo = new TaskRepository(db);
    const tagRepo = new TagRepository(db);

    const task = taskRepo.create({ title: 'Tag testing task', list_id: 'list_inbox' });
    const tag = tagRepo.create({ name: 'Urgent', color: '#ff3333' });

    expect(tagRepo.getAll().length).toBe(1);

    tagRepo.addTagToTask(task.id, tag.id);
    const taskTags = tagRepo.getTagsForTask(task.id);
    expect(taskTags.length).toBe(1);
    expect(taskTags[0].name).toBe('Urgent');

    const tasksForTag = tagRepo.getTasksForTag(tag.id);
    expect(tasksForTag.length).toBe(1);
    expect(tasksForTag[0].id).toBe(task.id);

    tagRepo.removeTagFromTask(task.id, tag.id);
    expect(tagRepo.getTagsForTask(task.id).length).toBe(0);
  });

  it('tests ReminderRepository', () => {
    const taskRepo = new TaskRepository(db);
    const reminderRepo = new ReminderRepository(db);

    const task = taskRepo.create({ title: 'Task with reminder', list_id: 'list_inbox' });
    const reminder = reminderRepo.create({
      task_id: task.id,
      remind_at: '2026-09-13T16:00:00Z',
    });
    expect(reminder.id).toBeDefined();
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(1);

    reminderRepo.snooze(reminder.id, '2026-09-13T17:00:00Z');
    reminderRepo.markTriggered(reminder.id);
    expect(reminderRepo.getUpcomingAndOverdue().length).toBe(0);

    reminderRepo.deleteByTaskId(task.id);
  });

  it('tests AttachmentRepository', () => {
    const taskRepo = new TaskRepository(db);
    const attachmentRepo = new AttachmentRepository(db);

    const task = taskRepo.create({ title: 'Task with attachment', list_id: 'list_inbox' });
    const attachment = attachmentRepo.create({
      task_id: task.id,
      filename: 'report.pdf',
      original_name: 'Quarterly Report.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      local_path: '/path/to/report.pdf',
    });
    expect(attachment.id).toBeDefined();
    expect(attachmentRepo.getByTaskId(task.id).length).toBe(1);

    const deleted = attachmentRepo.delete(attachment.id);
    expect(deleted?.filename).toBe('report.pdf');
    expect(attachmentRepo.getByTaskId(task.id).length).toBe(0);
  });

  it('tests PomodoroRepository', () => {
    const pomodoroRepo = new PomodoroRepository(db);
    const session = pomodoroRepo.create({
      type: 'work',
      duration_seconds: 1500,
      started_at: '2026-09-13T10:00:00Z',
    });
    expect(session.id).toBeDefined();

    pomodoroRepo.complete(session.id, '2026-09-13T10:25:00Z');

    const stats = pomodoroRepo.getStats('2026-09-01', '2026-09-30');
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalMinutes).toBe(25);
  });

  it('tests GoalRepository and GoalLink', () => {
    const goalRepo = new GoalRepository(db);
    const goal = goalRepo.create({
      title: 'Read 12 books',
      goal_type: 'habit',
      target_value: 12,
    });
    expect(goal.id).toBeDefined();

    goalRepo.update(goal.id, { current_value: 3 });
    expect(goalRepo.getAll()[0].current_value).toBe(3);

    goalRepo.addLink(goal.id, 'task', 'task-123');
    const links = goalRepo.getLinks(goal.id);
    expect(links.length).toBe(1);
    expect(links[0].resource_id).toBe('task-123');

    goalRepo.removeLink(goal.id, 'task-123');
    expect(goalRepo.getLinks(goal.id).length).toBe(0);

    goalRepo.delete(goal.id);
    expect(goalRepo.getAll().length).toBe(0);
  });

  it('tests NotificationRepository', () => {
    const notifRepo = new NotificationRepository(db);
    notifRepo.add({
      type: 'due',
      title: 'Task Due',
      body: 'Task is due right now',
    });
    const items = notifRepo.getAll();
    expect(items.length).toBe(1);
    expect(items[0].read_at).toBeNull();

    notifRepo.markRead(items[0].id);
    expect(notifRepo.getAll()[0].read_at).not.toBeNull();

    notifRepo.add({
      type: 'reminder',
      title: 'Reminder 2',
      body: 'Body 2',
    });
    notifRepo.markAllRead();
    expect(notifRepo.getAll().every((item) => item.read_at !== null)).toBe(true);
  });

  it('tests IdentityRepository', () => {
    const identityRepo = new IdentityRepository(db);
    const identity = identityRepo.get();
    expect(identity.id).toBeDefined();
    expect(identity.display_name).toBe('Local User');

    identityRepo.updateDisplayName('Alice');
    expect(identityRepo.get().display_name).toBe('Alice');
  });

  it('tests SearchRepository with FTS5 and triggers', () => {
    const taskRepo = new TaskRepository(db);
    const searchRepo = new SearchRepository(db);

    taskRepo.create({
      title: 'Write comprehensive integration tests',
      notes: 'Ensure FTS5 full-text indexing works with snippet generation',
      list_id: 'list_inbox',
    });

    taskRepo.create({
      title: 'Buy fresh apples',
      notes: 'From farmer market',
      list_id: 'list_inbox',
    });

    const results = searchRepo.search('comprehensive');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Write comprehensive integration tests');
    expect(results[0].snippet).toContain('comprehensive');
    expect(results[0].listId).toBe('list_inbox');

    const appleResults = searchRepo.search('apples');
    expect(appleResults.length).toBe(1);
    expect(appleResults[0].title).toBe('Buy fresh apples');

    // Trashed tasks should not be returned by search
    taskRepo.trash(results[0].id);
    expect(searchRepo.search('comprehensive').length).toBe(0);
  });
});
