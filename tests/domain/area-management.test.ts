import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { AreaRepository } from '../../src/main/repositories/AreaRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { AreaService } from '../../src/main/services/area/AreaService.js';
import { ProjectService } from '../../src/main/services/project/ProjectService.js';
import { TaskService } from '../../src/main/services/task/TaskService.js';
import { useAreaStore } from '../../src/renderer/stores/areaStore.js';
import { IPC } from '../../src/shared/ipc-channels.js';

describe('OS11 Unified Area Data Model (Workspace → Area → Project → Task → Subtask)', () => {
  let db: Database.Database;
  let areaRepo: AreaRepository;
  let projectRepo: ProjectRepository;
  let taskRepo: TaskRepository;
  let areaService: AreaService;
  let projectService: ProjectService;
  let taskService: TaskService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Apply initial schema and incremental migrations
    const initialSchema = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    db.exec(fs.readFileSync(initialSchema, 'utf8'));

    const incrementalMigrations = [
      '0005_project_group_id.sql',
      '0006_pin_lists_and_projects.sql',
      '0007_inbox_default_smart_list.sql',
      '0008_area_model.sql',
    ];

    for (const file of incrementalMigrations) {
      const filePath = path.resolve(__dirname, '../../src/main/migrations', file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        db.exec(sql);
      }
    }

    areaRepo = new AreaRepository(db);
    projectRepo = new ProjectRepository(db);
    taskRepo = new TaskRepository(db);
    areaService = new AreaService(areaRepo, projectRepo, taskRepo);
    projectService = new ProjectService(projectRepo, taskRepo);
    taskService = new TaskService(taskRepo, undefined, undefined, undefined, undefined, undefined, undefined, projectRepo);
  });

  describe('Migration 0008: Schema & Seed Verification', () => {
    it('creates workspaces table and seeds default workspace', () => {
      const ws = db.prepare('SELECT * FROM workspaces WHERE id = ?').get('ws_default') as { id: string; name: string };
      expect(ws).toBeDefined();
      expect(ws.id).toBe('ws_default');
      expect(ws.name).toBe('Personal Workspace');
    });

    it('creates areas table and seeds default "Personal" area', () => {
      const area = areaRepo.getById('area_default');
      expect(area).toBeDefined();
      expect(area?.name).toBe('Personal');
      expect(area?.workspace_id).toBe('ws_default');
    });

    it('adds area_id column to projects and tasks', () => {
      const projectCols = db.prepare("PRAGMA table_info('projects')").all() as Array<{ name: string }>;
      expect(projectCols.some((c) => c.name === 'area_id')).toBe(true);

      const taskCols = db.prepare("PRAGMA table_info('tasks')").all() as Array<{ name: string }>;
      expect(taskCols.some((c) => c.name === 'area_id')).toBe(true);
    });
  });

  describe('AreaRepository CRUD & Ordering', () => {
    it('creates and retrieves areas', () => {
      const area = areaRepo.create({
        name: 'Work',
        icon: '💼',
        color: '#27AE60',
      });

      expect(area.id).toBeDefined();
      expect(area.name).toBe('Work');
      expect(area.icon).toBe('💼');
      expect(area.color).toBe('#27AE60');

      const fetched = areaRepo.getById(area.id);
      expect(fetched).toEqual(area);
    });

    it('updates area properties', () => {
      const area = areaRepo.create({ name: 'Health' });
      const updated = areaRepo.update(area.id, {
        name: 'Wellness & Fitness',
        icon: '🏋️',
        color: '#E67E22',
      });

      expect(updated?.name).toBe('Wellness & Fitness');
      expect(updated?.icon).toBe('🏋️');
      expect(updated?.color).toBe('#E67E22');
    });

    it('reorders areas correctly', () => {
      const a1 = areaRepo.create({ name: 'Area 1' });
      const a2 = areaRepo.create({ name: 'Area 2' });

      areaRepo.reorder([
        { id: a2.id, sortOrder: 0 },
        { id: a1.id, sortOrder: 1 },
      ]);

      const all = areaRepo.getAll();
      const a2Pos = all.findIndex((a) => a.id === a2.id);
      const a1Pos = all.findIndex((a) => a.id === a1.id);
      expect(a2Pos).toBeLessThan(a1Pos);
    });
  });

  describe('Area Deletion Safeguards (AreaService)', () => {
    it('allows renaming the default area', () => {
      const renamed = areaService.update('area_default', { name: 'My Life' });
      expect(renamed.name).toBe('My Life');
    });

    it('blocks deleting the last remaining area', () => {
      // Currently only area_default exists
      expect(areaRepo.count()).toBe(1);
      expect(() => areaService.delete('area_default')).toThrow('At least one Area must always exist.');
    });

    it('blocks deleting an area that contains active projects', () => {
      const workArea = areaService.create({ name: 'Work' });
      projectRepo.create({
        name: 'Project Alpha',
        area_id: workArea.id,
      });

      expect(() => areaService.delete(workArea.id)).toThrow(
        "Move or delete this Area's projects first."
      );
    });

    it('blocks deleting an area that contains loose tasks', () => {
      const healthArea = areaService.create({ name: 'Health' });
      taskRepo.create({
        title: 'Morning Yoga',
        area_id: healthArea.id,
        project_id: null,
      });

      expect(() => areaService.delete(healthArea.id)).toThrow(
        "Move or delete this Area's projects first."
      );
    });

    it('allows deleting an empty non-default area', () => {
      const hobbyArea = areaService.create({ name: 'Hobbies' });
      areaService.delete(hobbyArea.id);
      expect(areaRepo.getById(hobbyArea.id)).toBeNull();
    });
  });

  describe('Project & Task Area Hierarchy & Auto-Sync', () => {
    it('creates a loose task directly in an area', () => {
      const task = taskService.create({
        title: 'Loose task in personal',
        area_id: 'area_default',
        project_id: null,
      });

      expect(task.area_id).toBe('area_default');
      expect(task.project_id).toBeNull();

      const looseTasks = taskRepo.getByAreaId('area_default');
      expect(looseTasks.some((t) => t.id === task.id)).toBe(true);
      expect(taskRepo.countLooseByAreaId('area_default')).toBe(1);
    });

    it('creates a project task and automatically inherits project.area_id', () => {
      const workArea = areaService.create({ name: 'Work Area' });
      const project = projectRepo.create({
        name: 'OS11 Launch',
        area_id: workArea.id,
      });

      // Creating without explicit area_id inherits project's area_id
      const task = taskService.create({
        title: 'Prepare release notes',
        project_id: project.id,
      });

      expect(task.project_id).toBe(project.id);
      expect(task.area_id).toBe(workArea.id);
    });

    it('automatically updates task.area_id when moving a task into a project', () => {
      const personalArea = areaRepo.getById('area_default')!;
      const workArea = areaService.create({ name: 'Work Area' });
      const workProject = projectRepo.create({
        name: 'Work Project',
        area_id: workArea.id,
      });

      // Create loose task in personal area
      const task = taskService.create({
        title: 'Check server logs',
        area_id: personalArea.id,
        project_id: null,
      });
      expect(task.area_id).toBe(personalArea.id);

      // Move into work project
      const updated = taskService.update({
        id: task.id,
        project_id: workProject.id,
      });

      expect(updated.project_id).toBe(workProject.id);
      expect(updated.area_id).toBe(workArea.id);
    });

    it('handles Inbox tasks with area_id = NULL and project_id = NULL', () => {
      const inboxTask = taskService.create({
        title: 'Zero friction quick capture',
        area_id: null,
        project_id: null,
      });

      expect(inboxTask.area_id).toBeNull();
      expect(inboxTask.project_id).toBeNull();

      const inbox = taskRepo.getInbox();
      expect(inbox.some((t) => t.id === inboxTask.id)).toBe(true);
    });

    it('soft-deletes project tasks to trash when project is deleted', () => {
      const proj = projectRepo.create({
        name: 'Temporary Project',
        area_id: 'area_default',
      });

      const t1 = taskService.create({ title: 'Task 1', project_id: proj.id });
      const t2 = taskService.create({ title: 'Task 2', project_id: proj.id });

      const result = projectService.delete(proj.id);
      expect(result.trashedCount).toBe(2);
      expect(result.trashedTaskIds).toContain(t1.id);
      expect(result.trashedTaskIds).toContain(t2.id);

      // Tasks are in trash
      const checkT1 = taskRepo.getById(t1.id);
      expect(checkT1?.is_trashed).toBe(1);
      expect(checkT1?.trashed_at).toBeDefined();

      const checkT2 = taskRepo.getById(t2.id);
      expect(checkT2?.is_trashed).toBe(1);
    });
  });

  describe('Renderer areaStore (Zustand)', () => {
    beforeEach(() => {
      (global as any).window = {
        electron: {
          invoke: async (channel: string, payload?: any) => {
            if (channel === IPC.AREAS.GET_ALL) {
              return { ok: true, data: areaRepo.getAll() };
            }
            if (channel === IPC.AREAS.CREATE) {
              return { ok: true, data: areaRepo.create(payload) };
            }
            if (channel === IPC.AREAS.UPDATE) {
              return { ok: true, data: areaRepo.update(payload.id, payload.fields) };
            }
            if (channel === IPC.AREAS.DELETE) {
              try {
                const idToDelete = typeof payload === 'string' ? payload : payload?.id;
                areaService.delete(idToDelete);
                return { ok: true, data: true };
              } catch (err: any) {
                return { ok: false, error: err.message };
              }
            }
            return { ok: true, data: null };
          },
        },
      };

      useAreaStore.setState({
        areasById: {},
        orderedAreaIds: [],
        isLoading: false,
        error: null,
      });
    });

    it('loads and stores areas in Zustand', async () => {
      await useAreaStore.getState().loadAreas();
      const state = useAreaStore.getState();
      expect(state.orderedAreaIds.length).toBeGreaterThanOrEqual(1);
      expect(state.areasById['area_default']?.name).toBe('Personal');
    });

    it('creates a new area via areaStore', async () => {
      const created = await useAreaStore.getState().createArea({
        name: 'Finance',
        icon: '💰',
      });

      expect(created.name).toBe('Finance');
      const state = useAreaStore.getState();
      expect(state.areasById[created.id]).toBeDefined();
    });

    it('fails to delete area with contents through areaStore and propagates error', async () => {
      const health = areaService.create({ name: 'Health' });
      taskRepo.create({ title: 'Loose task', area_id: health.id, project_id: null });

      await useAreaStore.getState().loadAreas();
      await expect(useAreaStore.getState().deleteArea(health.id)).rejects.toThrow(
        "Move or delete this Area's projects first."
      );
    });
  });
});
