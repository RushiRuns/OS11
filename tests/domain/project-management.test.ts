import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { SectionRepository } from '../../src/main/repositories/SectionRepository.js';
import { MilestoneRepository } from '../../src/main/repositories/MilestoneRepository.js';
import { DependencyRepository } from '../../src/main/repositories/DependencyRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { MilestoneService } from '../../src/main/services/project/MilestoneService.js';
import { DependencyService } from '../../src/main/services/project/DependencyService.js';
import { createProjectTemplate } from '../../src/renderer/features/projects/projectExport.js';
import { useProjectStore } from '../../src/renderer/stores/projectStore.js';
import { between } from '../../src/shared/utils/fractional-index.js';

describe('Phase 10: Project Management Domain & Repositories', () => {
  let db: Database.Database;
  let projectRepo: ProjectRepository;
  let sectionRepo: SectionRepository;
  let milestoneRepo: MilestoneRepository;
  let dependencyRepo: DependencyRepository;
  let taskRepo: TaskRepository;
  let notifRepo: NotificationRepository;
  let milestoneService: MilestoneService;
  let dependencyService: DependencyService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    const m5Path = path.resolve(__dirname, '../../src/main/migrations/0005_project_group_id.sql');
    if (fs.existsSync(m5Path)) {
      db.exec(fs.readFileSync(m5Path, 'utf8'));
    }

    projectRepo = new ProjectRepository(db);
    sectionRepo = new SectionRepository(db);
    milestoneRepo = new MilestoneRepository(db);
    dependencyRepo = new DependencyRepository(db);
    taskRepo = new TaskRepository(db);
    notifRepo = new NotificationRepository(db);

    milestoneService = new MilestoneService(milestoneRepo);
    dependencyService = new DependencyService(dependencyRepo);
  });

  it('manages milestones lifecycle (create, update, complete, query, delete)', () => {
    const project = projectRepo.create({ name: 'Alpha Launch' });

    const m1 = milestoneService.create({
      project_id: project.id,
      title: 'MVP Scope Frozen',
      due_date: '2026-10-01',
    });
    expect(m1.id).toBeDefined();
    expect(m1.is_completed).toBe(0);

    const m2 = milestoneService.create({
      project_id: project.id,
      title: 'Public Beta',
      due_date: '2026-11-15',
    });

    const list = milestoneService.getByProjectId(project.id);
    expect(list.length).toBe(2);
    expect(list[0].title).toBe('MVP Scope Frozen');
    expect(sectionRepo.getByProjectId(project.id).length).toBe(0);

    // Toggle completion
    const updated = milestoneService.update(m1.id, { is_completed: true });
    expect(updated.is_completed).toBe(1);

    // Delete milestone
    milestoneService.delete(m2.id);
    const afterDelete = milestoneService.getByProjectId(project.id);
    expect(afterDelete.length).toBe(1);
  });

  it('manages task dependencies and blocks circular dependency', () => {
    const project = projectRepo.create({ name: 'Dependency Test Project' });
    const listId = 'smart_all';

    const t1 = taskRepo.create({ title: 'Task 1: Spec', list_id: listId, project_id: project.id });
    const t2 = taskRepo.create({ title: 'Task 2: Dev', list_id: listId, project_id: project.id });
    const t3 = taskRepo.create({ title: 'Task 3: QA', list_id: listId, project_id: project.id });

    // Task 2 depends on Task 1
    dependencyService.add(t2.id, t1.id);
    expect(dependencyService.getByTaskId(t2.id)).toEqual([t1.id]);

    // Task 3 depends on Task 2
    dependencyService.add(t3.id, t2.id);
    expect(dependencyService.getByTaskId(t3.id)).toEqual([t2.id]);

    // Attempt circular dependency: Task 1 depending on Task 3 must throw error!
    expect(() => {
      dependencyService.add(t1.id, t3.id);
    }).toThrow(/Circular dependency detected/);

    // Self-dependency must also be rejected
    expect(() => {
      dependencyService.add(t1.id, t1.id);
    }).toThrow(/cannot depend on itself/);

    // Removal
    dependencyService.remove(t2.id, t1.id);
    expect(dependencyService.getByTaskId(t2.id)).toEqual([]);
  });

  it('queries project activity feed from notification_history', () => {
    const project = projectRepo.create({ name: 'Audit Log Project' });
    const task = taskRepo.create({
      title: 'Important Milestone Task',
      list_id: 'smart_all',
      project_id: project.id,
    });

    notifRepo.add({
      type: 'goal',
      task_id: task.id,
      title: 'Task Created',
      body: 'Task added to project',
    });

    const activity = projectRepo.getActivity(project.id);
    expect(activity.length).toBe(1);
    expect(activity[0].task_id).toBe(task.id);
    expect(activity[0].title).toBe('Task Created');
  });

  it('generates a clean project template stripping IDs and dates', () => {
    const project = {
      id: 'p-1',
      name: 'Mobile App',
      description: 'Native client',
      color: 'var(--tag-blue)',
      icon: '📱',
      status: 'active' as const,
      default_view: 'board' as const,
      sort_order: 1,
      created_at: '',
      updated_at: '',
    };

    const sections = [
      { id: 's-1', project_id: 'p-1', name: 'Design', sort_order: 0, is_collapsed: 0, created_at: '' },
      { id: 's-2', project_id: 'p-1', name: 'Dev', sort_order: 1, is_collapsed: 0, created_at: '' },
    ];

    const tasks = [
      {
        id: 't-1',
        title: 'Figma prototypes',
        notes: 'Review with team',
        list_id: 'smart_all',
        project_id: 'p-1',
        section_id: 's-1',
        priority: 2,
        estimated_minutes: 180,
        all_day: 1,
        is_starred: 0,
        is_completed: 0,
        sort_order: 0,
        my_day_date: null,
        created_by_device: 'local',
        pomodoro_count: 0,
        is_trashed: 0,
        created_at: '',
        updated_at: '',
      },
    ];

    const template = createProjectTemplate(project, sections, tasks);
    expect(template.name).toBe('Mobile App Template');
    expect(template.sections.length).toBe(2);
    expect(template.sections[0].tasks.length).toBe(1);
    expect(template.sections[0].tasks[0].title).toBe('Figma prototypes');
    expect(template.sections[0].tasks[0].estimated_minutes).toBe(180);
  });

  it('creates projects within a folder/group and updates group_id properly', () => {
    // 1. Create a group in list_groups
    const groupId = 'group_work_projects';
    db.prepare(`
      INSERT INTO list_groups (id, name, sort_order, is_collapsed, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(groupId, 'Client Projects', 0, 0, new Date().toISOString());

    // 2. Create project assigned to that group
    const project = projectRepo.create({
      name: 'Client Redesign',
      group_id: groupId,
    });
    expect(project.id).toBeDefined();
    expect(project.group_id).toBe(groupId);

    // 3. Verify retrieval by ID
    const retrieved = projectRepo.getById(project.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.group_id).toBe(groupId);

    // 4. Update project: move to another folder or remove to root
    const moved = projectRepo.update(project.id, {
      group_id: null,
    });
    expect(moved.group_id).toBeNull();

    const retrievedAfterMove = projectRepo.getById(project.id);
    expect(retrievedAfterMove?.group_id).toBeNull();
  });

  it('manages projectFolderIds in useProjectStore reactively', () => {
    const { addProjectFolder, removeProjectFolder } = useProjectStore.getState();
    addProjectFolder('grp_test_folder_1');
    expect(useProjectStore.getState().projectFolderIds).toContain('grp_test_folder_1');

    removeProjectFolder('grp_test_folder_1');
    expect(useProjectStore.getState().projectFolderIds).not.toContain('grp_test_folder_1');
  });

  it('creates tasks directly within project list without sections (flat list view)', () => {
    const project = projectRepo.create({ name: 'Flat List Project' });
    const task = taskRepo.create({
      title: 'Flat Task In Project',
      project_id: project.id,
      list_id: 'smart_all',
    });

    expect(task.id).toBeDefined();
    expect(task.project_id).toBe(project.id);
    expect(task.section_id).toBeNull();

    const tasksInProject = taskRepo.getByProjectId(project.id);
    expect(tasksInProject.length).toBe(1);
    expect(tasksInProject[0].title).toBe('Flat Task In Project');
  });

  it('calculates project progress metrics accurately for progress pill and hover tooltip', () => {
    const project = projectRepo.create({ name: 'Metrics Project' });
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    // 4 tasks: 2 completed, 1 pending tomorrow, 1 overdue yesterday
    const t1 = taskRepo.create({
      title: 'Done 1',
      project_id: project.id,
      list_id: 'smart_all',
    });
    taskRepo.complete(t1.id);

    const t2 = taskRepo.create({
      title: 'Done 2',
      project_id: project.id,
      list_id: 'smart_all',
    });
    taskRepo.complete(t2.id);
    taskRepo.create({
      title: 'Future Task',
      project_id: project.id,
      list_id: 'smart_all',
      is_completed: 0,
      due_date: tomorrow,
    });
    taskRepo.create({
      title: 'Overdue Task',
      project_id: project.id,
      list_id: 'smart_all',
      is_completed: 0,
      due_date: yesterday,
    });

    const projectTasks = taskRepo.getByProjectId(project.id);
    const total = projectTasks.length;
    const completed = projectTasks.filter((t) => t.is_completed === 1).length;
    const overdue = projectTasks.filter(
      (t) => t.is_completed === 0 && t.due_date && t.due_date < today
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    expect(total).toBe(4);
    expect(completed).toBe(2);
    expect(overdue).toBe(1);
    expect(percentage).toBe(50);
  });

  it('supports archiving, unarchiving, and deleting projects', () => {
    const project = projectRepo.create({ name: 'Lifecycle Project' });
    expect(project.status).toBe('active');

    // Archive
    projectRepo.archive(project.id);
    const archived = projectRepo.getById(project.id);
    expect(archived?.status).toBe('archived');

    // Unarchive
    projectRepo.update(project.id, { status: 'active' });
    const unarchived = projectRepo.getById(project.id);
    expect(unarchived?.status).toBe('active');

    // Delete
    projectRepo.delete(project.id);
    const deleted = projectRepo.getById(project.id);
    expect(deleted).toBeNull();
  });

  it('moves task between kanban sections and maintains fractional sort order', () => {
    const project = projectRepo.create({ name: 'Kanban Move Project' });
    const todoCol = sectionRepo.create({ project_id: project.id, name: 'To Do', sort_order: 0 });
    const inProgCol = sectionRepo.create({ project_id: project.id, name: 'In Progress', sort_order: 1 });

    const t1 = taskRepo.create({
      title: 'Task 1',
      project_id: project.id,
      section_id: todoCol.id,
      list_id: 'smart_all',
      sort_order: 1000,
    });
    const t2 = taskRepo.create({
      title: 'Task 2',
      project_id: project.id,
      section_id: todoCol.id,
      list_id: 'smart_all',
      sort_order: 2000,
    });
    const t3 = taskRepo.create({
      title: 'Task 3',
      project_id: project.id,
      section_id: inProgCol.id,
      list_id: 'smart_all',
      sort_order: 1000,
    });

    // Move t1 from To Do to In Progress before t3
    const orderBeforeT3 = between(null, t3.sort_order);
    taskRepo.update(t1.id, { section_id: inProgCol.id, sort_order: orderBeforeT3 });

    const updatedT1 = taskRepo.getById(t1.id);
    expect(updatedT1?.section_id).toBe(inProgCol.id);
    expect(updatedT1!.sort_order).toBeLessThan(t3.sort_order);

    // Move t2 from To Do to In Progress between updated t1 and t3
    const orderBetweenT1AndT3 = between(updatedT1!.sort_order, t3.sort_order);
    taskRepo.update(t2.id, { section_id: inProgCol.id, sort_order: orderBetweenT1AndT3 });

    const updatedT2 = taskRepo.getById(t2.id);
    expect(updatedT2?.section_id).toBe(inProgCol.id);
    expect(updatedT2!.sort_order).toBeGreaterThan(updatedT1!.sort_order);
    expect(updatedT2!.sort_order).toBeLessThan(t3.sort_order);

    // All In Progress tasks ordered by sort_order
    const inProgTasks = taskRepo.getByProjectId(project.id)
      .filter((t) => t.section_id === inProgCol.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    expect(inProgTasks.map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);
  });

  it('calculates fractional indices consistently when reordering within a kanban column', () => {
    // Dropping into an empty column
    const emptyDrop = between(null, null);
    expect(emptyDrop).toBe(1000);

    // Dropping at the very start of a column
    const atStartDrop = between(null, 1000);
    expect(atStartDrop).toBe(0);

    // Dropping at the end of a column
    const atEndDrop = between(2000, null);
    expect(atEndDrop).toBe(3000);

    // Dropping between two cards
    const betweenDrop = between(1000, 2000);
    expect(betweenDrop).toBe(1500);

    // Consecutive drops produce strictly increasing orders
    const first = between(null, null); // 1000
    const second = between(first, null); // 2000
    const middle = between(first, second); // 1500
    expect(middle).toBeGreaterThan(first);
    expect(middle).toBeLessThan(second);
  });

  it('supports table multi-column sorting across title, priority, due date, and status', () => {
    const project = projectRepo.create({ name: 'Table Sort Project' });
    const listId = 'smart_all';

    const t1 = taskRepo.create({
      title: 'Alpha Spec',
      priority: 1,
      due_date: '2026-10-10',
      project_id: project.id,
      list_id: listId,
    });
    const t2 = taskRepo.create({
      title: 'Beta Code',
      priority: 3,
      due_date: '2026-10-05',
      project_id: project.id,
      list_id: listId,
    });
    const t3 = taskRepo.create({
      title: 'Gamma Deploy',
      priority: 2,
      due_date: '2026-10-15',
      project_id: project.id,
      list_id: listId,
    });
    taskRepo.complete(t2.id);

    const projectTasks = taskRepo.getByProjectId(project.id);

    // Sort by priority desc
    const byPriorityDesc = [...projectTasks].sort((a, b) => b.priority - a.priority);
    expect(byPriorityDesc.map((t) => t.id)).toEqual([t2.id, t3.id, t1.id]);

    // Sort by due date asc
    const byDueDateAsc = [...projectTasks].sort((a, b) =>
      (a.due_date || '').localeCompare(b.due_date || '')
    );
    expect(byDueDateAsc.map((t) => t.id)).toEqual([t2.id, t1.id, t3.id]);

    // Sort by title asc
    const byTitleAsc = [...projectTasks].sort((a, b) => a.title.localeCompare(b.title));
    expect(byTitleAsc.map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);

    // Sort by status asc (incomplete first)
    const byStatusAsc = [...projectTasks].sort((a, b) => a.is_completed - b.is_completed);
    expect(byStatusAsc[2].id).toBe(t2.id); // completed task is last
  });

  it('supports table inline fast task creation with project and section defaults', () => {
    const project = projectRepo.create({ name: 'Table Add Project' });
    const section = sectionRepo.create({ project_id: project.id, name: 'Sprint 1', sort_order: 0 });

    const newTask = taskRepo.create({
      title: 'Rapid entry task from table row',
      project_id: project.id,
      section_id: section.id,
      list_id: 'smart_all',
    });

    expect(newTask.id).toBeDefined();
    expect(newTask.project_id).toBe(project.id);
    expect(newTask.section_id).toBe(section.id);
    expect(newTask.is_completed).toBe(0);

    const fetched = taskRepo.getById(newTask.id);
    expect(fetched?.title).toBe('Rapid entry task from table row');
  });
});
