import { BaseRepository } from './base-repository.js';
import type {
  CustomGroup,
  CustomGroupSection,
  ProjectGroupOverride,
  TaskCustomValue,
  DeleteImpactResult,
  TaskPreviousLocation,
} from '../../shared/types/CustomGroup.js';

export class CustomGroupRepository extends BaseRepository {
  // ==========================================
  // CUSTOM GROUPS
  // ==========================================

  public getAllGroups(includeDeleted = false): CustomGroup[] {
    const sql = `
      SELECT * FROM custom_groups
      ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}
      ORDER BY 
        CASE WHEN last_used_at IS NOT NULL THEN 0 ELSE 1 END,
        last_used_at DESC,
        sort_order ASC,
        created_at ASC
    `;
    const groups = this.db.prepare(sql).all() as CustomGroup[];

    const sectionsStmt = this.db.prepare(`
      SELECT * FROM custom_group_sections
      WHERE group_id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
      ORDER BY sort_order ASC, created_at ASC
    `);

    for (const group of groups) {
      group.sections = sectionsStmt.all(group.id) as CustomGroupSection[];
    }

    return groups;
  }

  public getGroupById(id: string): CustomGroup | null {
    const group = this.db.prepare('SELECT * FROM custom_groups WHERE id = ?').get(id) as CustomGroup | undefined;
    if (!group) return null;

    const sections = this.db.prepare(`
      SELECT * FROM custom_group_sections
      WHERE group_id = ? AND deleted_at IS NULL
      ORDER BY sort_order ASC, created_at ASC
    `).all(id) as CustomGroupSection[];

    group.sections = sections;
    return group;
  }

  public getGroupByName(name: string, excludeId?: string): CustomGroup | null {
    let sql = 'SELECT * FROM custom_groups WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL';
    const params: unknown[] = [name.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = this.db.prepare(sql).get(...params) as CustomGroup | undefined;
    return res ?? null;
  }

  public createGroup(record: {
    id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }): CustomGroup {
    this.db.prepare(`
      INSERT INTO custom_groups (id, name, sort_order, created_at, updated_at)
      VALUES (@id, @name, @sort_order, @created_at, @updated_at)
    `).run(record);

    return {
      ...record,
      last_used_at: null,
      deleted_at: null,
      sections: [],
    };
  }

  public updateGroup(id: string, fields: { name?: string; sort_order?: number; updated_at: string }): CustomGroup | null {
    const existing = this.getGroupById(id);
    if (!existing) return null;

    const name = fields.name !== undefined ? fields.name.trim() : existing.name;
    const sortOrder = fields.sort_order !== undefined ? fields.sort_order : existing.sort_order;

    this.db.prepare(`
      UPDATE custom_groups
      SET name = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(name, sortOrder, fields.updated_at, id);

    return this.getGroupById(id);
  }

  public softDeleteGroup(id: string, deletedAt: string): boolean {
    const res = this.db.prepare(`
      UPDATE custom_groups
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(deletedAt, deletedAt, id);
    return res.changes > 0;
  }

  public restoreGroup(id: string, updatedAt: string): boolean {
    const res = this.db.prepare(`
      UPDATE custom_groups
      SET deleted_at = NULL, updated_at = ?
      WHERE id = ? AND deleted_at IS NOT NULL
    `).run(updatedAt, id);
    return res.changes > 0;
  }

  public markUsed(id: string, timestamp: string): void {
    this.db.prepare(`
      UPDATE custom_groups
      SET last_used_at = ?, updated_at = ?
      WHERE id = ?
    `).run(timestamp, timestamp, id);
  }

  public getDeleteImpact(groupId: string): DeleteImpactResult {
    const row = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT tcv.task_id) as taskCount,
        COUNT(DISTINCT t.project_id) as projectCount
      FROM task_custom_values tcv
      JOIN tasks t ON t.id = tcv.task_id
      WHERE tcv.group_id = ? AND t.is_trashed = 0
    `).get(groupId) as { taskCount: number; projectCount: number } | undefined;

    return {
      taskCount: Number(row?.taskCount ?? 0),
      projectCount: Number(row?.projectCount ?? 0),
    };
  }

  // ==========================================
  // CUSTOM GROUP SECTIONS
  // ==========================================

  public getSectionsByGroupId(groupId: string, includeDeleted = false): CustomGroupSection[] {
    const sql = `
      SELECT * FROM custom_group_sections
      WHERE group_id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
      ORDER BY sort_order ASC, created_at ASC
    `;
    return this.db.prepare(sql).all(groupId) as CustomGroupSection[];
  }

  public getSectionById(id: string): CustomGroupSection | null {
    const row = this.db.prepare('SELECT * FROM custom_group_sections WHERE id = ?').get(id) as CustomGroupSection | undefined;
    return row ?? null;
  }

  public getSectionByName(groupId: string, name: string, excludeId?: string): CustomGroupSection | null {
    let sql = 'SELECT * FROM custom_group_sections WHERE group_id = ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL';
    const params: unknown[] = [groupId, name.trim()];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    const res = this.db.prepare(sql).get(...params) as CustomGroupSection | undefined;
    return res ?? null;
  }

  public countActiveSections(groupId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM custom_group_sections
      WHERE group_id = ? AND deleted_at IS NULL
    `).get(groupId) as { cnt: number } | undefined;
    return Number(row?.cnt ?? 0);
  }

  public createSection(record: {
    id: string;
    group_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }): CustomGroupSection {
    this.db.prepare(`
      INSERT INTO custom_group_sections (id, group_id, name, sort_order, created_at, updated_at)
      VALUES (@id, @group_id, @name, @sort_order, @created_at, @updated_at)
    `).run(record);

    return {
      ...record,
      deleted_at: null,
    };
  }

  public updateSection(id: string, fields: { name?: string; sort_order?: number; updated_at: string }): CustomGroupSection | null {
    const existing = this.getSectionById(id);
    if (!existing) return null;

    const name = fields.name !== undefined ? fields.name.trim() : existing.name;
    const sortOrder = fields.sort_order !== undefined ? fields.sort_order : existing.sort_order;

    this.db.prepare(`
      UPDATE custom_group_sections
      SET name = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(name, sortOrder, fields.updated_at, id);

    return this.getSectionById(id);
  }

  public softDeleteSection(id: string, deletedAt: string): boolean {
    const res = this.db.prepare(`
      UPDATE custom_group_sections
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(deletedAt, deletedAt, id);
    return res.changes > 0;
  }

  public restoreSection(id: string, updatedAt: string): boolean {
    const res = this.db.prepare(`
      UPDATE custom_group_sections
      SET deleted_at = NULL, updated_at = ?
      WHERE id = ? AND deleted_at IS NOT NULL
    `).run(updatedAt, id);
    return res.changes > 0;
  }

  public reorderSections(groupId: string, updates: Array<{ id: string; sort_order: number }>, updatedAt: string): void {
    const stmt = this.db.prepare(`
      UPDATE custom_group_sections
      SET sort_order = ?, updated_at = ?
      WHERE id = ? AND group_id = ?
    `);

    const runReorder = this.db.transaction(() => {
      for (const item of updates) {
        stmt.run(item.sort_order, updatedAt, item.id, groupId);
      }
    });

    runReorder();
  }

  // ==========================================
  // PROJECT GROUP OVERRIDES
  // ==========================================

  public getOverridesForProject(projectId: string): ProjectGroupOverride[] {
    return this.db.prepare(`
      SELECT * FROM project_group_overrides
      WHERE project_id = ?
    `).all(projectId) as ProjectGroupOverride[];
  }

  public setProjectOverride(record: {
    project_id: string;
    section_id: string;
    is_hidden: number;
    name_override: string | null;
    sort_override: number | null;
    created_at: string;
    updated_at: string;
  }): ProjectGroupOverride {
    this.db.prepare(`
      INSERT INTO project_group_overrides (project_id, section_id, is_hidden, name_override, sort_override, created_at, updated_at)
      VALUES (@project_id, @section_id, @is_hidden, @name_override, @sort_override, @created_at, @updated_at)
      ON CONFLICT(project_id, section_id) DO UPDATE SET
        is_hidden = excluded.is_hidden,
        name_override = excluded.name_override,
        sort_override = excluded.sort_override,
        updated_at = excluded.updated_at
    `).run(record);

    return record;
  }

  public clearProjectOverride(projectId: string, sectionId: string): boolean {
    const res = this.db.prepare(`
      DELETE FROM project_group_overrides
      WHERE project_id = ? AND section_id = ?
    `).run(projectId, sectionId);
    return res.changes > 0;
  }

  public countOpenTasksInSection(projectId: string, sectionId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as cnt
      FROM task_custom_values tcv
      JOIN tasks t ON t.id = tcv.task_id
      WHERE t.project_id = ? 
        AND tcv.section_id = ? 
        AND t.is_completed = 0 
        AND t.is_trashed = 0
    `).get(projectId, sectionId) as { cnt: number } | undefined;

    return Number(row?.cnt ?? 0);
  }

  // ==========================================
  // TASK CUSTOM VALUES
  // ==========================================

  public getValuesForProject(projectId: string, groupId: string): TaskCustomValue[] {
    return this.db.prepare(`
      SELECT tcv.*
      FROM task_custom_values tcv
      JOIN tasks t ON t.id = tcv.task_id
      WHERE t.project_id = ? AND tcv.group_id = ? AND t.is_trashed = 0
    `).all(projectId, groupId) as TaskCustomValue[];
  }

  public getValue(taskId: string, groupId: string): TaskCustomValue | null {
    const row = this.db.prepare(`
      SELECT * FROM task_custom_values
      WHERE task_id = ? AND group_id = ?
    `).get(taskId, groupId) as TaskCustomValue | undefined;
    return row ?? null;
  }

  public getValuesByTaskId(taskId: string): TaskCustomValue[] {
    return this.db.prepare(`
      SELECT * FROM task_custom_values
      WHERE task_id = ?
    `).all(taskId) as TaskCustomValue[];
  }

  public setValue(taskId: string, groupId: string, sectionId: string, timestamp: string): void {
    this.db.prepare(`
      INSERT INTO task_custom_values (task_id, group_id, section_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(task_id, group_id) DO UPDATE SET
        section_id = excluded.section_id,
        updated_at = excluded.updated_at
    `).run(taskId, groupId, sectionId, timestamp, timestamp);
  }

  public clearValue(taskId: string, groupId: string): void {
    this.db.prepare(`
      DELETE FROM task_custom_values
      WHERE task_id = ? AND group_id = ?
    `).run(taskId, groupId);
  }

  public clearAllValuesForTask(taskId: string): void {
    this.db.prepare(`
      DELETE FROM task_custom_values
      WHERE task_id = ?
    `).run(taskId);
  }

  public copyValues(sourceTaskId: string, targetTaskId: string, timestamp: string): void {
    this.db.prepare(`
      INSERT INTO task_custom_values (task_id, group_id, section_id, created_at, updated_at)
      SELECT ?, group_id, section_id, ?, ?
      FROM task_custom_values
      WHERE task_id = ?
    `).run(targetTaskId, timestamp, timestamp, sourceTaskId);
  }

  /**
   * Atomic move operation.
   * Updates task section value in task_custom_values and optionally sort_order in tasks.
   * Returns previous locations of all moved tasks for instant undo.
   */
  public moveTasks(
    taskIds: string[],
    groupId: string,
    sectionId: string | null,
    sortOrder: number | undefined,
    timestamp: string
  ): TaskPreviousLocation[] {
    const getPrevStmt = this.db.prepare(`
      SELECT t.id as taskId, t.sort_order as previousSortOrder, tcv.section_id as previousSectionId
      FROM tasks t
      LEFT JOIN task_custom_values tcv ON tcv.task_id = t.id AND tcv.group_id = ?
      WHERE t.id = ?
    `);

    const setValueStmt = this.db.prepare(`
      INSERT INTO task_custom_values (task_id, group_id, section_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(task_id, group_id) DO UPDATE SET
        section_id = excluded.section_id,
        updated_at = excluded.updated_at
    `);

    const clearValueStmt = this.db.prepare(`
      DELETE FROM task_custom_values
      WHERE task_id = ? AND group_id = ?
    `);

    const updateSortStmt = this.db.prepare(`
      UPDATE tasks
      SET sort_order = ?, updated_at = ?
      WHERE id = ?
    `);

    const executeMove = this.db.transaction(() => {
      const prevLocations: TaskPreviousLocation[] = [];

      for (const taskId of taskIds) {
        const row = getPrevStmt.get(groupId, taskId) as {
          taskId: string;
          previousSortOrder: number;
          previousSectionId: string | null;
        } | undefined;

        if (!row) continue;

        prevLocations.push({
          taskId: row.taskId,
          previousSectionId: row.previousSectionId ?? null,
          previousSortOrder: row.previousSortOrder,
        });

        if (sectionId === null) {
          clearValueStmt.run(taskId, groupId);
        } else {
          setValueStmt.run(taskId, groupId, sectionId, timestamp, timestamp);
        }

        if (sortOrder !== undefined && taskIds.length === 1) {
          updateSortStmt.run(sortOrder, timestamp, taskId);
        }
      }

      return prevLocations;
    });

    return executeMove();
  }
}

export default CustomGroupRepository;
