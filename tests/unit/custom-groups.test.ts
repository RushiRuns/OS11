import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { CustomGroupRepository } from '../../src/main/repositories/CustomGroupRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { IdentityRepository } from '../../src/main/repositories/IdentityRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { SettingsRepository } from '../../src/main/repositories/SettingsRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { TaskHistoryRepository } from '../../src/main/repositories/TaskHistoryRepository.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import {
  createCustomGroup,
  softDeleteCustomGroup,
  restoreCustomGroup,
  createCustomGroupSection,
  softDeleteCustomGroupSection,
  restoreCustomGroupSection,
  setProjectGroupOverride,
  moveTasks,
  getDeleteImpact,
  CustomGroupValidationError,
  MAX_SECTIONS_PER_GROUP,
} from '../../src/main/domain/custom-groups.js';

describe('Custom Groups: Repository & Domain Rules', () => {
  let db: Database.Database;
  let customGroupRepo: CustomGroupRepository;
  let taskRepo: TaskRepository;
  let taskService: TaskService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schema1 = fs.readFileSync(path.join(process.cwd(), 'src/main/migrations/0001_initial_schema.sql'), 'utf8');
    db.exec(schema1);

    const schema17 = fs.readFileSync(path.join(process.cwd(), 'src/main/migrations/0017_custom_groups.sql'), 'utf8');
    db.exec(schema17);

    // Seed dummy project and list
    db.prepare(`
      INSERT INTO lists (id, name, created_at, updated_at)
      VALUES ('list-1', 'Test List', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES ('proj-1', 'Test Project', datetime('now'), datetime('now'))
    `).run();

    customGroupRepo = new CustomGroupRepository(db);
    taskRepo = new TaskRepository(db);
    const identityRepo = new IdentityRepository(db);
    const projectRepo = new ProjectRepository(db);
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
      undefined,
      projectRepo,
      customGroupRepo
    );
  });

  afterEach(() => {
    db.close();
  });

  // 1. Name validation & 40 char limit
  it('enforces 1-40 character name limit and disallows empty names', () => {
    expect(() => createCustomGroup(customGroupRepo, { name: '' })).toThrowError(CustomGroupValidationError);
    expect(() => createCustomGroup(customGroupRepo, { name: '   ' })).toThrowError(CustomGroupValidationError);
    expect(() => createCustomGroup(customGroupRepo, { name: 'a'.repeat(41) })).toThrowError(CustomGroupValidationError);

    const valid = createCustomGroup(customGroupRepo, { name: 'a'.repeat(40) });
    expect(valid.name).toBe('a'.repeat(40));
  });

  // 2. Case-insensitive name uniqueness
  it('enforces case-insensitive name uniqueness for groups and ignores soft-deleted groups', () => {
    createCustomGroup(customGroupRepo, { name: 'Coding' });

    expect(() => createCustomGroup(customGroupRepo, { name: 'coding' })).toThrowError(/already exists/);
    expect(() => createCustomGroup(customGroupRepo, { name: 'CODING' })).toThrowError(/already exists/);

    const group = customGroupRepo.getGroupByName('Coding')!;
    softDeleteCustomGroup(customGroupRepo, group.id);

    // Now 'Coding' should be reusable because old one is soft-deleted
    const newGroup = createCustomGroup(customGroupRepo, { name: 'coding' });
    expect(newGroup.id).not.toBe(group.id);

    // Restoring the old group should now be refused with a clear error
    expect(() => restoreCustomGroup(customGroupRepo, group.id)).toThrowError(/already exists/);
  });

  // 3. 12 section cap per group
  it('enforces the 12 section cap per group', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Workflow' });

    for (let i = 1; i <= MAX_SECTIONS_PER_GROUP; i++) {
      createCustomGroupSection(customGroupRepo, {
        group_id: group.id,
        name: `Section ${i}`,
      });
    }

    expect(customGroupRepo.countActiveSections(group.id)).toBe(12);

    // 13th section must be refused
    expect(() =>
      createCustomGroupSection(customGroupRepo, {
        group_id: group.id,
        name: 'Section 13',
      })
    ).toThrowError(/maximum limit of 12 sections/);
  });

  // 4. Section delete, soft delete & restore
  it('soft-deletes section, allows restore, and refuses restore if name was re-taken', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Coding' });
    const sec1 = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Bugs' });

    softDeleteCustomGroupSection(customGroupRepo, sec1.id);
    expect(customGroupRepo.getSectionById(sec1.id)?.deleted_at).not.toBeNull();

    // Create another section named 'Bugs'
    createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'bugs' });

    // Restoring sec1 should fail
    expect(() => restoreCustomGroupSection(customGroupRepo, sec1.id)).toThrowError(/already exists/);
  });

  // 5. Project override: Hide blocked when section holds open tasks
  it('blocks hiding a section while it holds open tasks in that project', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Coding' });
    const sec = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Bugs' });

    // Create task in proj-1 and assign to sec
    const task = taskService.create({
      title: 'Fix issue',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    // Attempt to hide section in proj-1 should throw
    expect(() =>
      setProjectGroupOverride(customGroupRepo, {
        project_id: 'proj-1',
        section_id: sec.id,
        is_hidden: true,
      })
    ).toThrowError(/holds 1 open task/);

    // Complete the task
    taskRepo.update(task.id, { is_completed: 1 });

    // Now hiding should succeed!
    const override = setProjectGroupOverride(customGroupRepo, {
      project_id: 'proj-1',
      section_id: sec.id,
      is_hidden: true,
    });
    expect(override.is_hidden).toBe(1);
  });

  // 6. Delete impact query
  it('calculates delete impact across distinct tasks and projects accurately', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Sprint' });
    const sec = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'In Progress' });

    // Add another project
    db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES ('proj-2', 'Second Project', datetime('now'), datetime('now'))
    `).run();

    taskService.create({
      title: 'Task 1 in proj 1',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    taskService.create({
      title: 'Task 2 in proj 1',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    taskService.create({
      title: 'Task 3 in proj 2',
      project_id: 'proj-2',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    const impact = getDeleteImpact(customGroupRepo, group.id);
    expect(impact.taskCount).toBe(3);
    expect(impact.projectCount).toBe(2);
  });

  // 7. Atomic moveTasks & previous locations for undo
  it('moves tasks atomically and returns previous location and sort order for undo', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Kanban' });
    const secTodo = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Todo' });
    const secDone = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Done' });

    const task1 = taskService.create({
      title: 'Task 1',
      project_id: 'proj-1',
      list_id: 'list-1',
      sort_order: 100,
      customValue: { groupId: group.id, sectionId: secTodo.id },
    });

    const task2 = taskService.create({
      title: 'Task 2',
      project_id: 'proj-1',
      list_id: 'list-1',
      sort_order: 200,
      customValue: { groupId: group.id, sectionId: secTodo.id },
    });

    // Move both tasks to secDone
    const res = moveTasks(customGroupRepo, {
      taskIds: [task1.id, task2.id],
      groupId: group.id,
      sectionId: secDone.id,
    });

    expect(res.updatedCount).toBe(2);
    expect(res.previousLocations).toEqual([
      { taskId: task1.id, previousSectionId: secTodo.id, previousSortOrder: 100 },
      { taskId: task2.id, previousSectionId: secTodo.id, previousSortOrder: 200 },
    ]);

    // Check new values in DB
    expect(customGroupRepo.getValue(task1.id, group.id)?.section_id).toBe(secDone.id);
    expect(customGroupRepo.getValue(task2.id, group.id)?.section_id).toBe(secDone.id);

    // Disallow sortOrder when multiple tasks are passed
    expect(() =>
      moveTasks(customGroupRepo, {
        taskIds: [task1.id, task2.id],
        groupId: group.id,
        sectionId: secDone.id,
        sortOrder: 150,
      })
    ).toThrowError(/sortOrder can only be specified when moving a single task/);

    // Move single task with sortOrder
    moveTasks(customGroupRepo, {
      taskIds: [task1.id],
      groupId: group.id,
      sectionId: secTodo.id,
      sortOrder: 50,
    });

    expect(customGroupRepo.getValue(task1.id, group.id)?.section_id).toBe(secTodo.id);
    expect(taskRepo.getById(task1.id)?.sort_order).toBe(50);
  });

  // 8. Nesting rules & promotion
  it('clears custom values when a task becomes a subtask, and inherits parent section on promotion', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Coding' });
    const sec = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Bugs' });

    const parent = taskService.create({
      title: 'Parent Task',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    const child = taskService.create({
      title: 'Child Task',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    // Make child a subtask of parent
    taskService.makeSubtask(child.id, parent.id);

    // Verify child's custom values were deleted
    expect(customGroupRepo.getValuesByTaskId(child.id)).toEqual([]);

    // Now promote child to top level
    taskService.promoteToTask(child.id, group.id);

    // Verify child inherited former parent's section
    const childVal = customGroupRepo.getValue(child.id, group.id);
    expect(childVal?.section_id).toBe(sec.id);
  });

  // 9. Task duplication copies custom values
  it('copies custom values when duplicating a task', () => {
    const group = createCustomGroup(customGroupRepo, { name: 'Coding' });
    const sec = createCustomGroupSection(customGroupRepo, { group_id: group.id, name: 'Features' });

    const original = taskService.create({
      title: 'Original Task',
      project_id: 'proj-1',
      list_id: 'list-1',
      customValue: { groupId: group.id, sectionId: sec.id },
    });

    const copy = taskService.duplicate(original.id);
    expect(copy.id).not.toBe(original.id);

    const copyVal = customGroupRepo.getValue(copy.id, group.id);
    expect(copyVal?.section_id).toBe(sec.id);
  });
});
