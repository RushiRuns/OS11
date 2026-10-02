import { BaseRepository } from './base-repository.js';
import type { Area, CreateAreaPayload, UpdateAreaPayload } from '../../shared/types/Area.js';
import { v4 as uuidv4 } from 'uuid';

export class AreaRepository extends BaseRepository {
  public getAll(): Area[] {
    const stmt = this.db.prepare(`
      SELECT * FROM areas
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as Area[];
  }

  public getById(id: string): Area | null {
    const stmt = this.db.prepare(`
      SELECT * FROM areas WHERE id = ?
    `);
    const res = stmt.get(id) as Area | undefined;
    return res ?? null;
  }

  public count(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM areas`);
    const res = stmt.get() as { count: number };
    return res?.count ?? 0;
  }

  public getDefault(): Area | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM areas
        ORDER BY is_default DESC, sort_order ASC, created_at ASC
        LIMIT 1
      `);
      const res = stmt.get() as Area | undefined;
      return res ?? null;
    } catch {
      const stmt = this.db.prepare(`
        SELECT * FROM areas
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      `);
      const res = stmt.get() as Area | undefined;
      return res ?? null;
    }
  }

  private hasIsDefaultCol: boolean | null = null;
  private hasIsDefault(): boolean {
    if (this.hasIsDefaultCol === null) {
      try {
        const cols = this.db.pragma('table_info(areas)') as Array<{ name: string }>;
        this.hasIsDefaultCol = cols.some((c) => c.name === 'is_default');
      } catch {
        this.hasIsDefaultCol = false;
      }
    }
    return this.hasIsDefaultCol;
  }

  public create(payload: CreateAreaPayload): Area {
    const id = uuidv4();
    const now = new Date().toISOString();
    const hasDefault = this.hasIsDefault();

    const record: Area = {
      id,
      workspace_id: payload.workspace_id ?? 'ws_default',
      name: payload.name,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      is_collapsed: 0,
      created_at: now,
      updated_at: now,
    };

    if (hasDefault) {
      record.is_default = 0;
      const stmt = this.db.prepare(`
        INSERT INTO areas (id, workspace_id, name, icon, color, sort_order, is_collapsed, is_default, created_at, updated_at)
        VALUES (@id, @workspace_id, @name, @icon, @color, @sort_order, @is_collapsed, @is_default, @created_at, @updated_at)
      `);
      stmt.run(record);
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO areas (id, workspace_id, name, icon, color, sort_order, is_collapsed, created_at, updated_at)
        VALUES (@id, @workspace_id, @name, @icon, @color, @sort_order, @is_collapsed, @created_at, @updated_at)
      `);
      stmt.run(record);
    }
    return record;
  }

  public update(id: string, fields: UpdateAreaPayload): Area {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Area not found: ${id}`);
    }

    const isCollapsedVal =
      fields.is_collapsed !== undefined
        ? typeof fields.is_collapsed === 'boolean'
          ? fields.is_collapsed ? 1 : 0
          : fields.is_collapsed
        : current.is_collapsed;

    const updated: Area = {
      ...current,
      ...fields,
      id,
      is_collapsed: isCollapsedVal,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE areas SET
        name = @name,
        icon = @icon,
        color = @color,
        sort_order = @sort_order,
        is_collapsed = @is_collapsed,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM areas WHERE id = ?`);
    stmt.run(id);
  }

  public reorder(updates: Array<{ id: string; sortOrder: number }>): void {
    const updateStmt = this.db.prepare(`
      UPDATE areas SET sort_order = ? WHERE id = ?
    `);

    const runBatch = this.db.transaction((items: Array<{ id: string; sortOrder: number }>) => {
      for (const item of items) {
        updateStmt.run(item.sortOrder, item.id);
      }
    });

    runBatch(updates);
  }
}

export default AreaRepository;
