import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { ListGroupRepository } from '../../src/main/repositories/ListGroupRepository.js';
import { ListService } from '../../src/main/services/list/ListService.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { ProjectService } from '../../src/main/services/project/ProjectService.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TagService } from '../../src/main/services/tag/TagService.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { SettingsService } from '../../src/main/services/settings/SettingsService.js';
import { invoke, invokeRaw } from '../../src/renderer/services/ipc.js';

describe('Phase 3: Domain Services & IPC Client Adapter', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  });

  it('ListService refuses deletion of built-in smart lists', () => {
    const listRepo = new ListRepository(db);
    const listService = new ListService(listRepo);

    const smartLists = listService.getAll().filter((l) => l.is_smart === 1);
    expect(smartLists.length).toBeGreaterThan(0);

    expect(() => listService.delete(smartLists[0].id)).toThrow('Cannot delete built-in smart lists.');
  });

  it('ListService partially updates list fields without overwriting name with undefined', () => {
    const listRepo = new ListRepository(db);
    const groupRepo = new ListGroupRepository(db);
    const listService = new ListService(listRepo);

    const group = groupRepo.create({ name: 'Work Folder' });
    const created = listService.create({ name: 'Personal Tasks' });
    expect(created.name).toBe('Personal Tasks');

    const updated = listService.update(created.id, { group_id: group.id });
    expect(updated.name).toBe('Personal Tasks');
    expect(updated.group_id).toBe(group.id);
  });

  it('ProjectService creates and archives projects', () => {
    const projectRepo = new ProjectRepository(db);
    const projectService = new ProjectService(projectRepo);

    const project = projectService.create({ name: 'OS11 Launch' });
    expect(project.id).toBeDefined();

    projectService.archive(project.id);
    expect(projectService.getById(project.id).status).toBe('archived');
  });

  it('ProjectService partially updates project fields without overwriting name with undefined', () => {
    const projectRepo = new ProjectRepository(db);
    const projectService = new ProjectService(projectRepo);

    const project = projectService.create({ name: 'Alpha Redesign' });
    expect(project.name).toBe('Alpha Redesign');

    const updated = projectService.update(project.id, { sort_order: 5 });
    expect(updated.name).toBe('Alpha Redesign');
    expect(updated.sort_order).toBe(5);
  });

  it('TagService associates and disassociates tags', () => {
    const taskRepo = new TaskRepository(db);
    const task = taskRepo.create({ title: 'Task with tags' });

    const tagRepo = new TagRepository(db);
    const tagService = new TagService(tagRepo);

    const tag = tagService.create({ name: 'Urgent' });
    expect(tag.id).toBeDefined();

    tagService.addTagToTask(task.id, tag.id);
    expect(tagService.getTagsForTask(task.id).length).toBe(1);

    tagService.removeTagFromTask(task.id, tag.id);
    expect(tagService.getTagsForTask(task.id).length).toBe(0);
  });

  it('SettingsService updates preferences and handles system info', () => {
    const settingsRepo = new SettingsRepository(db);
    const settingsService = new SettingsService(settingsRepo);

    settingsService.applyTheme('dark');
    expect(settingsService.get('theme', 'light')).toBe('dark');

    settingsService.applyAccentColor('#FF5500');
    expect(settingsService.get('accent_color', '#000')).toBe('#FF5500');

    const info = settingsService.getSystemInfo();
    expect(info.platform).toBeDefined();
  });

  it('Renderer IPC adapter unwraps ok/data and throws on error', async () => {
    // Mock window.electron
    const originalWindow = global.window;
    (global as any).window = {
      electron: {
        invoke: async (channel: string, payload?: any) => {
          if (channel === 'test:success') {
            return { ok: true, data: { status: 'success', echo: payload } };
          }
          return { ok: false, error: 'Simulated IPC failure' };
        },
        on: () => () => {},
      },
    };

    const data = await invoke<{ status: string; echo: string }>('test:success', 'hello');
    expect(data.status).toBe('success');
    expect(data.echo).toBe('hello');

    await expect(invoke('test:failure')).rejects.toThrow('Simulated IPC failure');

    const raw = await invokeRaw('test:failure');
    expect(raw.ok).toBe(false);

    global.window = originalWindow;
  });
});
