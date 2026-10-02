import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

describe('Integration: Migration Data Paths (0008 & 0009)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Run migrations 0001 through 0007 to populate legacy structures
    const baseMigrations = [
      '0001_initial_schema.sql',
      '0005_project_group_id.sql',
      '0006_pin_lists_and_projects.sql',
      '0007_inbox_default_smart_list.sql',
    ];

    for (const mig of baseMigrations) {
      const p = path.resolve(__dirname, '../../src/main/migrations', mig);
      if (fs.existsSync(p)) {
        db.exec(fs.readFileSync(p, 'utf8'));
      }
    }
  });

  afterEach(() => {
    db.close();
  });

  it('transforms legacy lists, list_groups, and list_inbox tasks through migrations 0008 & 0009', () => {
    // Populate legacy data:
    // 1. A custom list group (e.g. "Work Stuff")
    const customGroupId = 'group-work-123';
    db.prepare(`
      INSERT INTO list_groups (id, name, sort_order, is_collapsed, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(customGroupId, 'Work Stuff', 100, 0);

    // 2. A custom list inside that group
    const customListId = 'list-work-project-1';
    db.prepare(`
      INSERT INTO lists (id, name, color, icon, group_id, sort_order, is_smart, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(customListId, 'Client Launch', '#3498DB', '🚀', customGroupId, 10);

    // 3. A standalone list without a group
    const standaloneListId = 'list-groceries';
    db.prepare(`
      INSERT INTO lists (id, name, color, icon, group_id, sort_order, is_smart, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, 0, datetime('now'), datetime('now'))
    `).run(standaloneListId, 'Groceries', '#2ECC71', '🛒', 20);

    // 4. Tasks:
    // Task A in list_inbox
    const inboxTaskId = 'task-inbox-item';
    db.prepare(`
      INSERT INTO tasks (id, title, list_id, sort_order, created_at, updated_at)
      VALUES (?, ?, 'list_inbox', 1, datetime('now'), datetime('now'))
    `).run(inboxTaskId, 'Buy coffee');

    // Task B in grouped list
    const groupedTaskId = 'task-grouped-item';
    db.prepare(`
      INSERT INTO tasks (id, title, list_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(groupedTaskId, 'Prepare launch slides', customListId);

    // Task C in standalone list
    const standaloneTaskId = 'task-standalone-item';
    db.prepare(`
      INSERT INTO tasks (id, title, list_id, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(standaloneTaskId, 'Milk & eggs', standaloneListId);

    // NOW APPLY MIGRATION 0008 (Area Model) & 0009 (Hardening)
    const mig0008 = path.resolve(__dirname, '../../src/main/migrations/0008_area_model.sql');
    db.exec(fs.readFileSync(mig0008, 'utf8'));

    const mig0009 = path.resolve(__dirname, '../../src/main/migrations/0009_area_model_hardening.sql');
    db.exec(fs.readFileSync(mig0009, 'utf8'));

    // --- VERIFICATION 1: Default Area & Group Areas ---
    // Default area must exist and be flagged is_default = 1
    const defaultArea = db.prepare(`SELECT * FROM areas WHERE id = 'area_default'`).get() as {
      id: string;
      name: string;
      is_default: number;
    };
    expect(defaultArea).toBeDefined();
    expect(defaultArea.is_default).toBe(1);
    expect(defaultArea.name).toBe('Personal');

    // Legacy list group must become an Area with same id and name
    const migratedGroupArea = db.prepare(`SELECT * FROM areas WHERE id = ?`).get(customGroupId) as {
      id: string;
      name: string;
      is_default: number;
    };
    expect(migratedGroupArea).toBeDefined();
    expect(migratedGroupArea.name).toBe('Work Stuff');
    expect(migratedGroupArea.is_default).toBe(0);

    // --- VERIFICATION 2: Lists migrated to Projects ---
    // Custom list inside group became a project in that Area
    const projectA = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(customListId) as {
      id: string;
      name: string;
      area_id: string;
      default_view: string;
    };
    expect(projectA).toBeDefined();
    expect(projectA.name).toBe('Client Launch');
    expect(projectA.area_id).toBe(customGroupId);
    expect(projectA.default_view).toBe('list');

    // Standalone list became a project in the default Area
    const projectB = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(standaloneListId) as {
      id: string;
      name: string;
      area_id: string;
      default_view: string;
    };
    expect(projectB).toBeDefined();
    expect(projectB.name).toBe('Groceries');
    expect(projectB.area_id).toBe('area_default');
    expect(projectB.default_view).toBe('list');

    // --- VERIFICATION 3: Tasks migrated correctly ---
    // Task A (list_inbox): project_id is NULL and area_id is NULL
    const taskA = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(inboxTaskId) as {
      id: string;
      area_id: string | null;
      project_id: string | null;
    };
    expect(taskA.project_id).toBeNull();
    expect(taskA.area_id).toBeNull();

    // Task B: project_id = customListId, area_id = customGroupId
    const taskB = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(groupedTaskId) as {
      id: string;
      area_id: string | null;
      project_id: string | null;
    };
    expect(taskB.project_id).toBe(customListId);
    expect(taskB.area_id).toBe(customGroupId);

    // Task C: project_id = standaloneListId, area_id = area_default
    const taskC = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(standaloneTaskId) as {
      id: string;
      area_id: string | null;
      project_id: string | null;
    };
    expect(taskC.project_id).toBe(standaloneListId);
    expect(taskC.area_id).toBe('area_default');
  });
});
