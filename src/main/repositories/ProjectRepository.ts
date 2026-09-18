import { BaseRepository } from './base-repository.js';
import type { Project, CreateProjectPayload, UpdateProjectPayload, NotificationHistoryItem } from '../../shared/types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class ProjectRepository extends BaseRepository {
  public getAll(): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as Project[];
  }

  public getById(id: string): Project | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    const res = stmt.get(id) as Project | undefined;
    return res ?? null;
  }

  private hasGroupIdCol: boolean | null = null;
  private hasPinnedColsState: boolean | null = null;

  private hasGroupId(): boolean {
    if (this.hasGroupIdCol === null) {
      try {
        const cols = this.db.pragma('table_info(projects)') as Array<{ name: string }>;
        this.hasGroupIdCol = cols.some((c) => c.name === 'group_id');
      } catch {
        this.hasGroupIdCol = false;
      }
    }
    return this.hasGroupIdCol;
  }

  private hasPinnedCols(): boolean {
    if (this.hasPinnedColsState === null) {
      try {
        const cols = this.db.pragma('table_info(projects)') as Array<{ name: string }>;
        this.hasPinnedColsState = cols.some((c) => c.name === 'is_pinned');
      } catch {
        this.hasPinnedColsState = false;
      }
    }
    return this.hasPinnedColsState;
  }

  public create(payload: CreateProjectPayload): Project {
    const id = uuidv4();
    const now = new Date().toISOString();

    const isPinnedVal =
      payload.is_pinned !== undefined
        ? typeof payload.is_pinned === 'boolean'
          ? payload.is_pinned ? 1 : 0
          : payload.is_pinned
        : 0;

    const record: Project = {
      id,
      name: payload.name,
      description: payload.description ?? null,
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      status: payload.status ?? 'active',
      due_date: payload.due_date ?? null,
      default_view: payload.default_view ?? 'list',
      sort_order: payload.sort_order ?? Date.now(),
      group_id: payload.group_id ?? null,
      is_pinned: isPinnedVal,
      pinned_sort_order: payload.pinned_sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };

    let sql = `
      INSERT INTO projects (
        id, name, description, color, icon, status,
        due_date, default_view, sort_order, created_at, updated_at
    `;
    let values = `
      VALUES (
        @id, @name, @description, @color, @icon, @status,
        @due_date, @default_view, @sort_order, @created_at, @updated_at
    `;

    if (this.hasGroupId()) {
      sql += ', group_id';
      values += ', @group_id';
    }
    if (this.hasPinnedCols()) {
      sql += ', is_pinned, pinned_sort_order';
      values += ', @is_pinned, @pinned_sort_order';
    }

    sql += ') ' + values + ')';
    const stmt = this.db.prepare(sql);
    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateProjectPayload): Project {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Project not found: ${id}`);
    }

    const isPinnedVal =
      fields.is_pinned !== undefined
        ? typeof fields.is_pinned === 'boolean'
          ? fields.is_pinned ? 1 : 0
          : fields.is_pinned
        : current.is_pinned ?? 0;

    const pinnedSortOrderVal =
      fields.pinned_sort_order !== undefined
        ? fields.pinned_sort_order
        : current.pinned_sort_order ?? 0;

    const updated: Project = {
      ...current,
      ...fields,
      id,
      group_id: fields.group_id !== undefined ? fields.group_id : current.group_id,
      is_pinned: isPinnedVal,
      pinned_sort_order: pinnedSortOrderVal,
      updated_at: new Date().toISOString(),
    };

    let setClauses = `
      name = @name,
      description = @description,
      color = @color,
      icon = @icon,
      status = @status,
      due_date = @due_date,
      default_view = @default_view,
      sort_order = @sort_order,
      updated_at = @updated_at
    `;

    if (this.hasGroupId()) {
      setClauses += ', group_id = @group_id';
    }
    if (this.hasPinnedCols()) {
      setClauses += ', is_pinned = @is_pinned, pinned_sort_order = @pinned_sort_order';
    }

    const stmt = this.db.prepare(`UPDATE projects SET ${setClauses} WHERE id = @id`);
    stmt.run(updated);
    return updated;
  }

  public archive(id: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ?
    `);
    stmt.run(now, id);
  }

  public getActivity(projectId: string): NotificationHistoryItem[] {
    const stmt = this.db.prepare<[string], NotificationHistoryItem>(`
      SELECT nh.id, nh.type, nh.task_id, nh.title, nh.body, nh.created_at, nh.read_at
      FROM notification_history nh
      JOIN tasks t ON nh.task_id = t.id
      WHERE t.project_id = ?
      ORDER BY nh.created_at DESC
      LIMIT 50
    `);
    return stmt.all(projectId);
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM projects WHERE id = ?`);
    stmt.run(id);
  }
}

export default ProjectRepository;
