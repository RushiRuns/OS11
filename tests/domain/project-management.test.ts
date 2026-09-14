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
});
