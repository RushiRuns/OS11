import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';

describe('Integration: Tag System Cascade Delete', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let tagRepo: TagRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    taskRepo = new TaskRepository(db);
    tagRepo = new TagRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('verifies creating tag → assigning to task → deleting tag → task_tags CASCADE', () => {
    // 1. Create tasks
    const task1 = taskRepo.create({ title: 'Task 1', list_id: 'list_inbox' });
    const task2 = taskRepo.create({ title: 'Task 2', list_id: 'list_inbox' });

    // 2. Create tag
    const tag = tagRepo.create({ name: 'Urgent', color: '#ff4444' });
    expect(tag.id).toBeDefined();

    // 3. Assign tag to both tasks
    tagRepo.addTagToTask(task1.id, tag.id);
    tagRepo.addTagToTask(task2.id, tag.id);

    // Verify task_tags table has 2 rows
    const beforeCount = db
      .prepare('SELECT COUNT(*) as count FROM task_tags WHERE tag_id = ?')
      .get(tag.id) as { count: number };
    expect(beforeCount.count).toBe(2);

    expect(tagRepo.getTagsForTask(task1.id).length).toBe(1);
    expect(tagRepo.getTagsForTask(task2.id).length).toBe(1);

    // 4. Delete the tag
    tagRepo.delete(tag.id);

    // 5. Verify task_tags associations were CASCADE deleted
    const afterCount = db
      .prepare('SELECT COUNT(*) as count FROM task_tags WHERE tag_id = ?')
      .get(tag.id) as { count: number };
    expect(afterCount.count).toBe(0);

    expect(tagRepo.getTagsForTask(task1.id).length).toBe(0);
    expect(tagRepo.getTagsForTask(task2.id).length).toBe(0);

    // 6. Verify tasks themselves remain completely intact
    expect(taskRepo.getById(task1.id)).not.toBeNull();
    expect(taskRepo.getById(task2.id)).not.toBeNull();
  });
});
