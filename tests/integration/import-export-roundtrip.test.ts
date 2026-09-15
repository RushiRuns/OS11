import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { ExportService } from '../../src/main/services/export/ExportService.js';
import { ImportService } from '../../src/main/services/import/ImportService.js';

describe('Integration: Import/Export Round-Trip Fidelity', () => {
  let db1: Database.Database;
  let db2: Database.Database;

  const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  beforeEach(() => {
    db1 = new Database(':memory:');
    db1.pragma('foreign_keys = ON');
    db1.exec(schemaSql);

    db2 = new Database(':memory:');
    db2.pragma('foreign_keys = ON');
    db2.exec(schemaSql);
  });

  afterEach(() => {
    try {
      db1.close();
      db2.close();
    } catch {
      // ignore
    }
  });

  it('exports full database snapshot as JSON and imports into a fresh DB with 100% fidelity', async () => {
    // 1. Populate DB1 with rich data
    const taskRepo1 = new TaskRepository(db1);
    const listRepo1 = new ListRepository(db1);
    const projectRepo1 = new ProjectRepository(db1);
    const tagRepo1 = new TagRepository(db1);
    const settingsRepo1 = new SettingsRepository(db1);

    const project = projectRepo1.create({ name: 'Alpha Project', color: '#336699' });
    const list = listRepo1.create({ name: 'Roadmap Tasks', color: '#ff6600' });
    const tag = tagRepo1.create({ name: 'v1.0-release', color: '#00cc66' });

    settingsRepo1.set('theme', 'dark');
    settingsRepo1.set('accent_color', '#007acc');

    const task1 = taskRepo1.create({
      title: 'Finalize v1.0 architecture',
      notes: 'Ensure all tests pass cleanly',
      priority: 3,
      due_date: '2026-09-30',
      due_time: '18:00',
      list_id: list.id,
      project_id: project.id,
    });
    tagRepo1.addTagToTask(task1.id, tag.id);

    const task2 = taskRepo1.create({
      title: 'Write release announcement',
      notes: 'Post to internal channels',
      priority: 2,
      list_id: list.id,
    });

    const exportService1 = new ExportService({
      db: db1,
      taskRepo: taskRepo1,
      listRepo: listRepo1,
      projectRepo: projectRepo1,
      tagRepo: tagRepo1,
      settingsRepo: settingsRepo1,
    });

    // 2. Export full JSON snapshot from DB1
    const exportedSnapshot = exportService1.exportJson();
    expect(exportedSnapshot.version).toBe(1);
    expect(exportedSnapshot.tasks.length).toBeGreaterThanOrEqual(2);
    expect(exportedSnapshot.lists.length).toBeGreaterThan(0);
    expect(exportedSnapshot.projects.length).toBeGreaterThan(0);
    expect(exportedSnapshot.tags.length).toBeGreaterThan(0);

    // 3. Import JSON snapshot into clean DB2
    const importService2 = new ImportService(db2);
    const importResult = await importService2.importData({
      format: 'os11_json',
      content: JSON.stringify(exportedSnapshot),
    });

    expect(importResult.success).toBe(true);

    // 4. Verify DB2 record counts and field values
    const taskRepo2 = new TaskRepository(db2);
    const listRepo2 = new ListRepository(db2);
    const projectRepo2 = new ProjectRepository(db2);
    const tagRepo2 = new TagRepository(db2);
    const settingsRepo2 = new SettingsRepository(db2);

    // Check tasks count
    const tasksInDb2 = taskRepo2.getAll();
    expect(tasksInDb2.length).toBe(taskRepo1.getAll().length);

    // Check specific task field values
    const importedTask1 = taskRepo2.getById(task1.id);
    expect(importedTask1).not.toBeNull();
    expect(importedTask1!.title).toBe('Finalize v1.0 architecture');
    expect(importedTask1!.notes).toBe('Ensure all tests pass cleanly');
    expect(importedTask1!.priority).toBe(3);
    expect(importedTask1!.due_date).toBe('2026-09-30');
    expect(importedTask1!.due_time).toBe('18:00');
    expect(importedTask1!.project_id).toBe(project.id);
    expect(importedTask1!.list_id).toBe(list.id);

    const importedTask2 = taskRepo2.getById(task2.id);
    expect(importedTask2).not.toBeNull();
    expect(importedTask2!.title).toBe('Write release announcement');
    expect(importedTask2!.priority).toBe(2);

    // Check project
    const importedProject = projectRepo2.getById(project.id);
    expect(importedProject).not.toBeNull();
    expect(importedProject!.name).toBe('Alpha Project');

    // Check list
    const importedList = listRepo2.getById(list.id);
    expect(importedList).not.toBeNull();
    expect(importedList!.name).toBe('Roadmap Tasks');

    // Check tag
    const importedTags = tagRepo2.getAll();
    expect(importedTags.some((t) => t.name === 'v1.0-release')).toBe(true);

    // Check tag associations
    const task1TagsInDb2 = tagRepo2.getTagsForTask(task1.id);
    expect(task1TagsInDb2.length).toBe(1);
    expect(task1TagsInDb2[0].name).toBe('v1.0-release');

    // Check settings
    expect(settingsRepo2.get('theme')).toBe('dark');
    expect(settingsRepo2.get('accent_color')).toBe('#007acc');
  });
});
