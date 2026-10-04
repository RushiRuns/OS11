import { BaseRepository } from './base-repository.js';
import type { Project, CreateProjectPayload, UpdateProjectPayload, NotificationHistoryItem } from '../../shared/types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class ProjectRepository extends BaseRepository {
  private mapRow(row: any): Project {
    let views: Project['views'] = ['list', 'board', 'timeline', 'calendar', 'table'];
    if (row.views) {
      try {
        const parsed = typeof row.views === 'string' ? JSON.parse(row.views) : row.views;
        if (Array.isArray(parsed) && parsed.length > 0) {
          views = parsed;
        }
      } catch {
        views = ['list', 'board', 'timeline', 'calendar', 'table'];
      }
    }
    return {
      ...row,
      views,
    };
  }

  public getAll(): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      ORDER BY sort_order ASC, created_at ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public getById(id: string): Project | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    const res = stmt.get(id) as any | undefined;
    return res ? this.mapRow(res) : null;
  }

  private hasGroupIdCol: boolean | null = null;
  private hasPinnedColsState: boolean | null = null;
  private hasAreaIdCol: boolean | null = null;
  private hasViewsColState: boolean | null = null;

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

  private hasAreaId(): boolean {
    if (this.hasAreaIdCol === null) {
      try {
        const cols = this.db.pragma('table_info(projects)') as Array<{ name: string }>;
        this.hasAreaIdCol = cols.some((c) => c.name === 'area_id');
      } catch {
        this.hasAreaIdCol = false;
      }
    }
    return this.hasAreaIdCol;
  }

  private hasViewsCol(): boolean {
    if (this.hasViewsColState === null) {
      try {
        const cols = this.db.pragma('table_info(projects)') as Array<{ name: string }>;
        this.hasViewsColState = cols.some((c) => c.name === 'views');
      } catch {
        this.hasViewsColState = false;
      }
    }
    return this.hasViewsColState;
  }

  private hasSomedayColsState: boolean | null = null;
  private hasSomedayCols(): boolean {
    if (this.hasSomedayColsState === null) {
      try {
        const cols = this.db.pragma('table_info(projects)') as Array<{ name: string }>;
        this.hasSomedayColsState = cols.some((c) => c.name === 'is_someday');
      } catch {
        this.hasSomedayColsState = false;
      }
    }
    return this.hasSomedayColsState;
  }

  public getByAreaId(areaId: string): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE area_id = ?
      ORDER BY sort_order ASC, created_at ASC
    `);
    const rows = stmt.all(areaId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public countByAreaId(areaId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM projects
      WHERE area_id = ?
    `);
    const res = stmt.get(areaId) as { count: number };
    return res?.count ?? 0;
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

    const isSomedayVal =
      payload.is_someday !== undefined
        ? typeof payload.is_someday === 'boolean'
          ? payload.is_someday ? 1 : 0
          : payload.is_someday
        : 0;

    const viewsVal: Project['views'] =
      payload.views && payload.views.length > 0
        ? payload.views
        : ['list', 'board', 'timeline', 'calendar', 'table'];

    const record: Project = {
      id,
      name: payload.name,
      description: payload.description ?? null,
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      status: payload.status ?? 'active',
      due_date: payload.due_date ?? null,
      default_view: payload.default_view ?? viewsVal[0] ?? 'list',
      views: viewsVal,
      sort_order: payload.sort_order ?? Date.now(),
      group_id: payload.group_id ?? null,
      area_id: payload.area_id ?? 'area_default',
      is_pinned: isPinnedVal,
      pinned_sort_order: payload.pinned_sort_order ?? 0,
      is_someday: isSomedayVal,
      reviewed_at: payload.reviewed_at ?? null,
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
    if (this.hasAreaId()) {
      sql += ', area_id';
      values += ', @area_id';
    }
    if (this.hasPinnedCols()) {
      sql += ', is_pinned, pinned_sort_order';
      values += ', @is_pinned, @pinned_sort_order';
    }
    if (this.hasViewsCol()) {
      sql += ', views';
      values += ', @viewsJson';
    }
    if (this.hasSomedayCols()) {
      sql += ', is_someday, reviewed_at';
      values += ', @is_someday, @reviewed_at';
    }

    sql += ') ' + values + ')';
    const stmt = this.db.prepare(sql);
    stmt.run({
      ...record,
      viewsJson: JSON.stringify(record.views),
    });
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

    const isSomedayVal =
      fields.is_someday !== undefined
        ? typeof fields.is_someday === 'boolean'
          ? fields.is_someday ? 1 : 0
          : fields.is_someday
        : current.is_someday ?? 0;

    const updated: Project = {
      ...current,
      ...fields,
      id,
      group_id: fields.group_id !== undefined ? fields.group_id : current.group_id,
      area_id: fields.area_id !== undefined ? fields.area_id : current.area_id,
      is_pinned: isPinnedVal,
      pinned_sort_order: pinnedSortOrderVal,
      is_someday: isSomedayVal,
      reviewed_at: fields.reviewed_at !== undefined ? fields.reviewed_at : current.reviewed_at,
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
    if (this.hasAreaId()) {
      setClauses += ', area_id = @area_id';
    }
    if (this.hasPinnedCols()) {
      setClauses += ', is_pinned = @is_pinned, pinned_sort_order = @pinned_sort_order';
    }
    if (this.hasViewsCol()) {
      setClauses += ', views = @viewsJson';
    }
    if (this.hasSomedayCols()) {
      setClauses += ', is_someday = @is_someday, reviewed_at = @reviewed_at';
    }

    const stmt = this.db.prepare(`UPDATE projects SET ${setClauses} WHERE id = @id`);
    stmt.run({
      ...updated,
      viewsJson: JSON.stringify(updated.views),
    });
    return updated;
  }

  public setSomeday(id: string, isSomeday: boolean, reviewedAt?: string): Project {
    const isSomedayVal = isSomeday ? 1 : 0;
    const now = new Date().toISOString();
    const finalReviewedAt = reviewedAt !== undefined ? reviewedAt : (isSomeday ? now : null);
    const stmt = this.db.prepare(`
      UPDATE projects
      SET is_someday = ?,
          reviewed_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(isSomedayVal, finalReviewedAt, now, id);
    return this.getById(id)!;
  }

  public markReviewed(id: string, reviewedAt: string): Project {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE projects
      SET reviewed_at = ?,
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(reviewedAt, now, id);
    return this.getById(id)!;
  }

  public markReviewedBatch(ids: string[], reviewedAt: string): void {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE projects
      SET reviewed_at = ?,
          updated_at = ?
      WHERE id IN (${placeholders})
    `);
    stmt.run(reviewedAt, now, ...ids);
  }

  public getSomedayProjects(): Project[] {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE is_someday = 1 AND status != 'archived'
      ORDER BY sort_order ASC, created_at ASC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRow(r));
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
