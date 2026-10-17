import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { KeyResultNotFoundError } from '../../src/main/repositories/key-result-validation.js';

describe('Integration: Tasks and Projects key_result_id links and validation', () => {
  let db: Database.Database;
  let tempMigrationsDir: string;
  let taskRepo: TaskRepository;
  let projectRepo: ProjectRepository;
  let taskService: TaskService;

  const realMigrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os11-okr-task-test-'));
    const files = fs.readdirSync(realMigrationsDir).filter((f) => f.endsWith('.sql'));
    for (const f of files) {
      fs.copyFileSync(path.join(realMigrationsDir, f), path.join(tempMigrationsDir, f));
    }
    runMigrations(db, tempMigrationsDir);

    taskRepo = new TaskRepository(db);
    projectRepo = new ProjectRepository(db);
    taskService = new TaskService(taskRepo, undefined, undefined, undefined, undefined, undefined, undefined, projectRepo);

    // Create an objective and two key results
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO objectives (id, title, period_start, period_end, cadence, status, created_at, updated_at)
      VALUES ('obj-1', 'Test Objective', '2026-10-01', '2026-12-31', 'weekly', 'active', ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO key_results (id, objective_id, title, kind, current_value, target_value, sort_order, created_at, updated_at)
      VALUES ('kr-1', 'obj-1', 'Key Result 1', 'metric', 0, 100, 1000, ?, ?)
    `).run(now, now);

    db.prepare(`
      INSERT INTO key_results (id, objective_id, title, kind, current_value, target_value, sort_order, created_at, updated_at)
      VALUES ('kr-2', 'obj-1', 'Key Result 2', 'work', 0, 10, 2000, ?, ?)
    `).run(now, now);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    if (fs.existsSync(tempMigrationsDir)) {
      fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
    }
  });

  it('persists and updates key_result_id on tasks', () => {
    const task = taskRepo.create({
      title: 'Task linked to KR1',
      key_result_id: 'kr-1',
    });
    expect(task.key_result_id).toBe('kr-1');

    const fetched = taskRepo.getById(task.id);
    expect(fetched?.key_result_id).toBe('kr-1');

    const updated = taskRepo.update(task.id, { key_result_id: 'kr-2' });
    expect(updated.key_result_id).toBe('kr-2');
    expect(taskRepo.getById(task.id)?.key_result_id).toBe('kr-2');

    const cleared = taskRepo.update(task.id, { key_result_id: null });
    expect(cleared.key_result_id).toBeNull();
    expect(taskRepo.getById(task.id)?.key_result_id).toBeNull();
  });

  it('rejects unknown key_result_id on task create and update', () => {
    expect(() => {
      taskRepo.create({
        title: 'Task with bad KR',
        key_result_id: 'kr-non-existent',
      });
    }).toThrow(KeyResultNotFoundError);

    const task = taskRepo.create({ title: 'Valid task' });
    expect(() => {
      taskRepo.update(task.id, { key_result_id: 'kr-non-existent' });
    }).toThrow(KeyResultNotFoundError);
  });

  it('subtasks cannot carry key_result_id', () => {
    const parent = taskRepo.create({ title: 'Parent Task', key_result_id: 'kr-1' });

    // Creating task with parent_task_id forces key_result_id to null
    const subtask = taskRepo.create({
      title: 'Child Task',
      parent_task_id: parent.id,
      key_result_id: 'kr-1',
    });
    expect(subtask.key_result_id).toBeNull();

    // Updating a top-level task into a subtask clears key_result_id
    const task2 = taskRepo.create({ title: 'Task to be demoted', key_result_id: 'kr-1' });
    expect(task2.key_result_id).toBe('kr-1');

    const demoted = taskService.makeSubtask(task2.id, parent.id);
    expect(demoted.key_result_id).toBeNull();
    expect(taskRepo.getById(task2.id)?.key_result_id).toBeNull();
  });

  it('duplicate copies key_result_id for top-level tasks', () => {
    const original = taskService.create({
      title: 'Original Top Task',
      key_result_id: 'kr-1',
    });

    const copy = taskService.duplicate(original.id);
    expect(copy.key_result_id).toBe('kr-1');
  });

  it('restoreVersion nulls dangling key_result_id if key result was deleted', () => {
    const task = taskService.create({
      title: 'Versioned Task',
      key_result_id: 'kr-1',
    });

    // Update task to KR2, creating a history snapshot with from: 'kr-1'
    taskService.update(task.id, { id: task.id, key_result_id: 'kr-2' });

    const history = taskService.getHistory(task.id);
    expect(history.length).toBeGreaterThan(0);
    const snapshotId = history[0].id;

    // Delete kr-1 from database
    db.prepare('DELETE FROM key_results WHERE id = ?').run('kr-1');

    // Restoring the previous version should not fail with foreign key error; it should null key_result_id
    const restored = taskService.restoreVersion(snapshotId);
    expect(restored.key_result_id).toBeNull();
  });

  it('persists and updates key_result_id on projects', () => {
    const project = projectRepo.create({
      name: 'Project linked to KR1',
      key_result_id: 'kr-1',
    });
    expect(project.key_result_id).toBe('kr-1');

    const fetched = projectRepo.getById(project.id);
    expect(fetched?.key_result_id).toBe('kr-1');

    const updated = projectRepo.update(project.id, { key_result_id: 'kr-2' });
    expect(updated.key_result_id).toBe('kr-2');
    expect(projectRepo.getById(project.id)?.key_result_id).toBe('kr-2');

    const cleared = projectRepo.update(project.id, { key_result_id: null });
    expect(cleared.key_result_id).toBeNull();
    expect(projectRepo.getById(project.id)?.key_result_id).toBeNull();
  });

  it('rejects unknown key_result_id on project create and update', () => {
    expect(() => {
      projectRepo.create({
        name: 'Project with bad KR',
        key_result_id: 'kr-non-existent',
      });
    }).toThrow(KeyResultNotFoundError);

    const project = projectRepo.create({ name: 'Valid Project' });
    expect(() => {
      projectRepo.update(project.id, { key_result_id: 'kr-non-existent' });
    }).toThrow(KeyResultNotFoundError);
  });
});
