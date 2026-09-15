import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { SearchRepository } from '../../src/main/repositories/SearchRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';

describe('Repositories: Parameterized Statements & SQL Injection Safety', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let tagRepo: TagRepository;
  let searchRepo: SearchRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
    tagRepo = new TagRepository(db);
    searchRepo = new SearchRepository(db);
    settingsRepo = new SettingsRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('TaskRepository SQL Injection Immunity', () => {
    it('safely handles drop table attacks in task creation and update', () => {
      const maliciousTitle = "'; DROP TABLE tasks; --";
      const maliciousNotes = "1' OR '1'='1'; DELETE FROM tasks; --";

      const task = taskRepo.create({
        title: maliciousTitle,
        notes: maliciousNotes,
        list_id: 'list_inbox',
      });

      expect(task.id).toBeDefined();

      // Verify table still exists and record stored exact payload literally
      const fetched = taskRepo.getById(task.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe(maliciousTitle);
      expect(fetched!.notes).toBe(maliciousNotes);

      // Verify table was not dropped
      const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number };
      expect(count.c).toBeGreaterThanOrEqual(1);

      // Updating with injection payload
      const updatePayload = "Updated'; UPDATE tasks SET is_completed = 1; --";
      const updated = taskRepo.update(task.id, { title: updatePayload });
      expect(updated.title).toBe(updatePayload);

      // Ensure other fields were not mutated by injection
      const checkAfter = taskRepo.getById(task.id);
      expect(checkAfter!.is_completed).toBe(0);
    });

    it('returns null gracefully on non-existent task lookups', () => {
      expect(taskRepo.getById('non-existent-uuid-12345')).toBeNull();
      expect(taskRepo.getById("'; SELECT 1; --")).toBeNull();
    });
  });

  describe('ListRepository & TagRepository SQL Injection Immunity', () => {
    it('safely handles malicious list names', () => {
      const maliciousName = "Inbox'; DROP TABLE lists; --";
      const list = listRepo.create({ name: maliciousName });
      expect(list.id).toBeDefined();

      const retrieved = listRepo.getById(list.id);
      expect(retrieved?.name).toBe(maliciousName);

      // Verify lists table is intact
      const listCount = listRepo.getAll();
      expect(listCount.length).toBeGreaterThanOrEqual(7);
    });

    it('safely handles malicious tag names and associations', () => {
      const maliciousTagName = "Urgent' OR '1'='1";
      const tag = tagRepo.create({ name: maliciousTagName });
      expect(tag.id).toBeDefined();

      const allTags = tagRepo.getAll();
      expect(allTags.some((t) => t.name === maliciousTagName)).toBe(true);

      const task = taskRepo.create({ title: 'Task with injection tag', list_id: 'list_inbox' });
      tagRepo.addTagToTask(task.id, tag.id);

      const taskTags = tagRepo.getTagsForTask(task.id);
      expect(taskTags.length).toBe(1);
      expect(taskTags[0].name).toBe(maliciousTagName);
    });
  });

  describe('SearchRepository FTS5 Injection Immunity', () => {
    it('safely handles FTS5 special characters and query injections', () => {
      taskRepo.create({
        title: 'Normal task for search test',
        notes: 'Important secret keywords',
        list_id: 'list_inbox',
      });

      // Special FTS characters and injection attempts
      const injections = [
        "'; DROP TABLE tasks; --",
        '" OR 1=1 --',
        '***',
        'NOT AND OR NEAR',
        '"""""',
        ';;;;;',
        '../../etc/passwd',
      ];

      for (const injection of injections) {
        expect(() => searchRepo.search(injection)).not.toThrow();
      }

      // Legitimate search still works
      const results = searchRepo.search('secret keywords');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Normal task for search test');
    });
  });

  describe('SettingsRepository SQL Injection Immunity', () => {
    it('safely stores and retrieves keys with special characters', () => {
      const injectionKey = "custom_key'; DROP TABLE settings; --";
      settingsRepo.set(injectionKey, 'safe_value');

      expect(settingsRepo.get(injectionKey)).toBe('safe_value');

      const count = db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
      expect(count.c).toBeGreaterThan(0);
    });
  });
});
