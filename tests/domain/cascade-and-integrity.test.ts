import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { AreaRepository } from '../../src/main/repositories/AreaRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { IntegrityRepository } from '../../src/main/repositories/IntegrityRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';
import { AreaService } from '../../src/main/services/area/AreaService.js';
import { ProjectService } from '../../src/main/services/project/ProjectService.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';

describe('Domain: Cascade, Invariants, and Data Integrity', () => {
  let db: Database.Database;
  let areaRepo: AreaRepository;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let integrityRepo: IntegrityRepository;
  let areaService: AreaService;
  let projectService: ProjectService;
  let taskService: TaskService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Run initial schema and incremental migrations
    const initialSchema = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    db.exec(fs.readFileSync(initialSchema, 'utf8'));

    const incrementalMigrations = [
      '0005_project_group_id.sql',
      '0006_pin_lists_and_projects.sql',
      '0007_inbox_default_smart_list.sql',
      '0008_area_model.sql',
      '0009_area_model_hardening.sql',
    ];

    for (const mig of incrementalMigrations) {
      const p = path.resolve(__dirname, '../../src/main/migrations', mig);
      if (fs.existsSync(p)) {
        db.exec(fs.readFileSync(p, 'utf8'));
      }
    }

    areaRepo = new AreaRepository(db);
    projectRepo = new ProjectRepository(db);
    taskRepo = new TaskRepository(db);
    integrityRepo = new IntegrityRepository(db);

    const identityRepo = new IdentityRepository(db);
    const reminderRepo = new ReminderRepository(db);
    const settingsRepo = new SettingsRepository(db);
    const tagRepo = new TagRepository(db);
    const historyRepo = new TaskHistoryRepository(db);

    areaService = new AreaService(areaRepo, projectRepo, taskRepo);
    projectService = new ProjectService(projectRepo, taskRepo);
    taskService = new TaskService(taskRepo, identityRepo, reminderRepo, settingsRepo, tagRepo, historyRepo);
  });

  describe('Project Area Change Cascades', () => {
    it('cascades area_id changes to all tasks and subtasks when project moves area', async () => {
      const area1 = areaRepo.create({ name: 'Area 1' });
      const area2 = areaRepo.create({ name: 'Area 2' });

      const project = projectRepo.create({
        name: 'Alpha Project',
        area_id: area1.id,
      });

      // Create parent task inside project
      const parentTask = taskRepo.create({
        title: 'Project Parent Task',
        project_id: project.id,
        area_id: area1.id,
      });

      // Create subtask
      const subtask = taskRepo.create({
        title: 'Project Subtask',
        parent_task_id: parentTask.id,
        project_id: project.id,
        area_id: area1.id,
      });

      expect(parentTask.area_id).toBe(area1.id);
      expect(subtask.area_id).toBe(area1.id);

      // Move project to Area 2 via ProjectService
      await projectService.update(project.id, { area_id: area2.id });

      const updatedParent = taskRepo.getById(parentTask.id);
      const updatedSubtask = taskRepo.getById(subtask.id);

      expect(updatedParent?.area_id).toBe(area2.id);
      expect(updatedSubtask?.area_id).toBe(area2.id);

      // Verify trigger also cascades if direct DB update occurs
      db.prepare('UPDATE projects SET area_id = ? WHERE id = ?').run(area1.id, project.id);
      const triggerParent = taskRepo.getById(parentTask.id);
      const triggerSubtask = taskRepo.getById(subtask.id);
      expect(triggerParent?.area_id).toBe(area1.id);
      expect(triggerSubtask?.area_id).toBe(area1.id);
    });

    it('cascades container updates recursively to subtasks when moving parent task', async () => {
      const area1 = areaRepo.create({ name: 'Engineering' });
      const project1 = projectRepo.create({ name: 'Feature X', area_id: area1.id });

      // Parent task in inbox
      const parent = await taskService.create({
        title: 'Parent Task',
        area_id: null,
        project_id: null,
      });

      const child = await taskService.create({
        title: 'Child Subtask',
        parent_task_id: parent.id,
        area_id: null,
        project_id: null,
      });

      // Move parent to Feature X project
      await taskService.update(parent.id, {
        id: parent.id,
        project_id: project1.id,
        area_id: area1.id,
      });

      const updatedChild = taskRepo.getById(child.id);
      expect(updatedChild?.project_id).toBe(project1.id);
      expect(updatedChild?.area_id).toBe(area1.id);
    });
  });

  describe('Integrity Invariant Checker', () => {
    it('reports zero mismatched tasks when invariants hold', () => {
      const area = areaRepo.create({ name: 'Operations' });
      const proj = projectRepo.create({ name: 'Infra', area_id: area.id });

      taskRepo.create({ title: 'Task 1', project_id: proj.id, area_id: area.id });
      taskRepo.create({ title: 'Loose Task', area_id: area.id, project_id: null });
      taskRepo.create({ title: 'Inbox Task', area_id: null, project_id: null });

      const report = integrityRepo.checkIntegrity();
      expect(report.isValid).toBe(true);
      expect(report.mismatchedTaskIds.length).toBe(0);
      expect(report.nullAreaProjectIds.length).toBe(0);
    });

    it('detects and repairs mismatched area_id in tasks', () => {
      const area1 = areaRepo.create({ name: 'Area 1' });
      const area2 = areaRepo.create({ name: 'Area 2' });
      const proj = projectRepo.create({ name: 'Project 1', area_id: area1.id });

      // Create a task deliberately with mismatched area_id bypassing triggers
      const task = taskRepo.create({ title: 'Inconsistent Task', project_id: proj.id, area_id: area1.id });
      db.prepare('UPDATE tasks SET area_id = ? WHERE id = ?').run(area2.id, task.id);

      const beforeCheck = integrityRepo.checkIntegrity();
      expect(beforeCheck.mismatchedTaskIds.length).toBe(1);
      expect(beforeCheck.mismatchedTaskIds[0]).toBe(task.id);

      const repairRes = integrityRepo.repairIntegrity();
      expect(repairRes.repairedCount).toBeGreaterThanOrEqual(1);

      const afterCheck = integrityRepo.checkIntegrity();
      expect(afterCheck.mismatchedTaskIds.length).toBe(0);

      const repairedTask = taskRepo.getById(task.id);
      expect(repairedTask?.area_id).toBe(area1.id);
    });
  });

  describe('Loose Task Inheritance & Operations', () => {
    it('preserves area_id when duplicating a loose task', async () => {
      const area = areaRepo.create({ name: 'Personal' });
      const original = await taskService.create({
        title: 'Buy Groceries',
        area_id: area.id,
        project_id: null,
      });

      const duplicate = await taskService.duplicate(original.id);
      expect(duplicate.title).toBe('Buy Groceries (Copy)');
      expect(duplicate.area_id).toBe(area.id);
      expect(duplicate.project_id).toBeNull();
    });

    it('preserves area_id when completing a recurring loose task', async () => {
      const area = areaRepo.create({ name: 'Health' });
      const recurring = await taskService.create({
        title: 'Morning Run',
        area_id: area.id,
        project_id: null,
        recurrence_rule: 'RRULE:FREQ=DAILY;INTERVAL=1',
        due_date: '2026-10-01',
      });

      await taskService.complete(recurring.id);
      const allAreaTasks = taskRepo.getByAreaId(area.id);
      const nextTask = allAreaTasks.find((t) => t.id !== recurring.id);
      expect(nextTask).toBeDefined();
      expect(nextTask?.area_id).toBe(area.id);
      expect(nextTask?.project_id).toBeNull();
    });
  });

  describe('Inbox & Area Top-Level Filtering', () => {
    it('excludes subtasks from Inbox queries', async () => {
      const parent = await taskService.create({
        title: 'Inbox Parent',
        area_id: null,
        project_id: null,
      });

      await taskService.create({
        title: 'Inbox Subtask',
        parent_task_id: parent.id,
        area_id: null,
        project_id: null,
      });

      const inboxTasks = taskRepo.getInbox();
      expect(inboxTasks.some((t) => t.id === parent.id)).toBe(true);
      expect(inboxTasks.some((t) => t.parent_task_id === parent.id)).toBe(false);
    });

    it('excludes subtasks from Area loose tasks queries', async () => {
      const area = areaRepo.create({ name: 'Loose Container' });
      const parent = await taskService.create({
        title: 'Area Parent',
        area_id: area.id,
        project_id: null,
      });

      await taskService.create({
        title: 'Area Subtask',
        parent_task_id: parent.id,
        area_id: area.id,
        project_id: null,
      });

      const looseTasks = taskRepo.getByAreaId(area.id);
      expect(looseTasks.some((t) => t.id === parent.id)).toBe(true);
      expect(looseTasks.some((t) => t.parent_task_id === parent.id)).toBe(false);
    });
  });

  describe('Trash Restore Container Fallback', () => {
    it('restores task to Inbox if its project was deleted while trashed', async () => {
      const area = areaRepo.create({ name: 'Finance' });
      const proj = projectRepo.create({ name: 'Q3 Tax', area_id: area.id });

      const task = await taskService.create({
        title: 'File return',
        project_id: proj.id,
        area_id: area.id,
      });

      // Trash task
      await taskService.trash(task.id);
      expect(taskRepo.getById(task.id)?.is_trashed).toBe(1);

      // Permanently delete the project while retaining task.project_id
      db.prepare('PRAGMA foreign_keys = OFF').run();
      db.prepare('DELETE FROM projects WHERE id = ?').run(proj.id);
      db.prepare('PRAGMA foreign_keys = ON').run();

      // Restore task
      await taskService.restore(task.id);
      const restored = taskRepo.getById(task.id);

      expect(restored?.is_trashed).toBe(0);
      expect(restored?.project_id).toBeNull();
      // Safe fallback to Inbox: area_id is also null
      expect(restored?.area_id).toBeNull();
    });

    it('restores task to Inbox if its loose area was deleted while trashed', async () => {
      const area = areaRepo.create({ name: 'Temporary Area' });
      const task = await taskService.create({
        title: 'Temporary Note',
        area_id: area.id,
        project_id: null,
      });

      await taskService.trash(task.id);
      db.prepare('PRAGMA foreign_keys = OFF').run();
      db.prepare('DELETE FROM areas WHERE id = ?').run(area.id);
      db.prepare('PRAGMA foreign_keys = ON').run();

      await taskService.restore(task.id);
      const restored = taskRepo.getById(task.id);

      expect(restored?.is_trashed).toBe(0);
      expect(restored?.area_id).toBeNull();
      expect(restored?.project_id).toBeNull();
    });
  });

  describe('Area Deletion Safeguards (All Items Counted)', () => {
    it('blocks deleting an area that contains trashed tasks', async () => {
      const area = areaRepo.create({ name: 'Client Work' });
      const task = await taskService.create({
        title: 'Old proposal',
        area_id: area.id,
        project_id: null,
      });

      await taskService.trash(task.id);
      expect(taskRepo.getById(task.id)?.is_trashed).toBe(1);

      // Area deletion must still be blocked because it has trashed loose tasks
      expect(() => areaService.delete(area.id)).toThrow(
        "Move or delete this Area's projects first."
      );
    });

    it('blocks deleting the last remaining area', () => {
      // Clear out all existing areas except 1
      const all = areaRepo.getAll();
      for (let i = 1; i < all.length; i++) {
        db.prepare('DELETE FROM areas WHERE id = ?').run(all[i].id);
      }

      const remaining = areaRepo.getAll();
      expect(remaining.length).toBe(1);

      expect(() => areaService.delete(remaining[0].id)).toThrow(
        'At least one Area must always exist.'
      );
    });
  });
});
