import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TagService } from '../../src/main/services/tag/TagService.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { buildTagTree } from '../../src/renderer/stores/tagStore.js';
import { groupNotificationsByDate } from '../../src/renderer/features/notifications/NotificationCenter.js';
import type { Tag } from '../../src/shared/types/Tag.js';
import type { NotificationHistoryItem } from '../../src/shared/types/NotificationHistoryItem.js';

describe('Phase 9: Tags, Priority & Notification Center', () => {
  let db: Database.Database;
  let tagRepo: TagRepository;
  let tagService: TagService;
  let notifRepo: NotificationRepository;
  let notifService: NotificationService;
  let taskRepo: TaskRepository;
  let settingsRepo: SettingsRepository;
  let taskService: TaskService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    // Insert test list for auto-tag tests
    db.prepare(`
      INSERT INTO lists (id, name, sort_order, created_at, updated_at)
      VALUES ('list-work', 'Work List', 10, datetime('now'), datetime('now'))
    `).run();

    tagRepo = new TagRepository(db);
    tagService = new TagService(tagRepo);
    notifRepo = new NotificationRepository(db);
    notifService = new NotificationService(notifRepo);
    taskRepo = new TaskRepository(db);
    const identityRepo = new IdentityRepository(db);
    const reminderRepo = new ReminderRepository(db);
    settingsRepo = new SettingsRepository(db);
    taskService = new TaskService(taskRepo, identityRepo, reminderRepo, settingsRepo, tagRepo);
  });

  afterEach(() => {
    db.close();
  });

  describe('Tag Tree Parsing (Hierarchical Nested Tags)', () => {
    it('correctly parses slash-delimited tags into hierarchical tree structure', () => {
      const mockTags: Tag[] = [
        { id: '1', name: 'work/client/Acme', color: 'var(--tag-blue)', sort_order: 1, created_at: '' },
        { id: '2', name: 'work/client/Beta', color: 'var(--tag-cyan)', sort_order: 2, created_at: '' },
        { id: '3', name: 'work/internal', color: 'var(--tag-teal)', sort_order: 3, created_at: '' },
        { id: '4', name: 'personal', color: 'var(--tag-green)', sort_order: 4, created_at: '' },
      ];

      const tree = buildTagTree(mockTags);
      expect(tree).toHaveLength(2); // 'work' and 'personal'

      const workNode = tree.find((n) => n.name === 'work');
      expect(workNode).toBeDefined();
      expect(workNode?.children).toHaveLength(2); // 'client' and 'internal'

      const clientNode = workNode?.children.find((n) => n.name === 'client');
      expect(clientNode).toBeDefined();
      expect(clientNode?.children).toHaveLength(2); // 'Acme' and 'Beta'

      const acmeNode = clientNode?.children.find((n) => n.name === 'Acme');
      expect(acmeNode?.tag?.id).toBe('1');
    });
  });

  describe('Tag Merging', () => {
    it('merges source tag into target tag and batch updates task associations without duplicate keys', () => {
      // Create tags
      const tagSource = tagService.create({ name: 'old-tag', color: 'var(--tag-red)' });
      const tagTarget = tagService.create({ name: 'new-tag', color: 'var(--tag-blue)' });

      // Create tasks
      const task1 = taskRepo.create({ title: 'Task 1' });
      const task2 = taskRepo.create({ title: 'Task 2' });

      // Associate task1 with both old and new, and task2 with old only
      tagService.addTagToTask(task1.id, tagSource.id);
      tagService.addTagToTask(task1.id, tagTarget.id);
      tagService.addTagToTask(task2.id, tagSource.id);

      // Execute merge
      tagService.mergeTags(tagSource.id, tagTarget.id);

      // Verify source tag deleted
      expect(tagRepo.getById(tagSource.id)).toBeNull();

      // Verify task associations
      const task1Tags = tagService.getTagsForTask(task1.id);
      const task2Tags = tagService.getTagsForTask(task2.id);

      expect(task1Tags).toHaveLength(1);
      expect(task1Tags[0].id).toBe(tagTarget.id);

      expect(task2Tags).toHaveLength(1);
      expect(task2Tags[0].id).toBe(tagTarget.id);
    });
  });

  describe('Auto-Tagging Rules', () => {
    it('automatically attaches configured tags to tasks created in matching list', () => {
      const tag = tagService.create({ name: 'urgent', color: 'var(--tag-red)' });

      // Set auto_tag_rules in settings: tasks in 'list-work' get auto-tagged with 'urgent'
      settingsRepo.set('auto_tag_rules', {
        'list-work': [tag.id],
      });

      // Create task in list-work
      const taskInWork = taskService.create({
        title: 'Project Roadmap Review',
        list_id: 'list-work',
      });

      const tagsForWorkTask = tagService.getTagsForTask(taskInWork.id);
      expect(tagsForWorkTask).toHaveLength(1);
      expect(tagsForWorkTask[0].id).toBe(tag.id);

      // Create task without list_id
      const taskWithoutList = taskService.create({
        title: 'Random Quick Note',
      });
      expect(tagService.getTagsForTask(taskWithoutList.id)).toHaveLength(0);
    });
  });

  describe('Notification Center History & Date Grouping', () => {
    it('records notifications, supports marking read, mark all read, and clearing history', () => {
      notifService.send('due', 'Task Overdue', 'Your report is overdue', null);
      notifService.send('pomodoro', 'Pomodoro Completed', '25 minutes finished!', null);

      let history = notifService.getAll();
      expect(history).toHaveLength(2);
      expect(history[0].read_at).toBeNull();
      expect(history[1].read_at).toBeNull();

      // Mark single item read
      notifService.markRead(history[0].id);
      history = notifService.getAll();
      expect(history[0].read_at).not.toBeNull();
      expect(history[1].read_at).toBeNull();

      // Mark all read
      notifService.markAllRead();
      history = notifService.getAll();
      expect(history[0].read_at).not.toBeNull();
      expect(history[1].read_at).not.toBeNull();

      // Clear history
      notifService.clear();
      expect(notifService.getAll()).toHaveLength(0);
    });

    it('groups notifications by Today, Yesterday, and Earlier', () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const earlier = new Date(now);
      earlier.setDate(earlier.getDate() - 5);

      const mockItems: NotificationHistoryItem[] = [
        { id: '1', type: 'due', title: 'Due today', body: '', created_at: now.toISOString() },
        { id: '2', type: 'reminder', title: 'Yesterday alert', body: '', created_at: yesterday.toISOString() },
        { id: '3', type: 'streak', title: 'Earlier streak', body: '', created_at: earlier.toISOString() },
      ];

      const grouped = groupNotificationsByDate(mockItems);
      expect(grouped.today).toHaveLength(1);
      expect(grouped.today[0].id).toBe('1');
      expect(grouped.yesterday).toHaveLength(1);
      expect(grouped.yesterday[0].id).toBe('2');
      expect(grouped.earlier).toHaveLength(1);
      expect(grouped.earlier[0].id).toBe('3');
    });
  });
});
