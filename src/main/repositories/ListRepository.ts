import { BaseRepository } from './base-repository.js';
import type { List, CreateListPayload, UpdateListPayload } from '../../shared/types/List.js';
import { v4 as uuidv4 } from 'uuid';

export class ListRepository extends BaseRepository {
  public getAll(): List[] {
    const stmt = this.db.prepare(`
      SELECT * FROM lists
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as List[];
  }

  public getById(id: string): List | null {
    const stmt = this.db.prepare(`
      SELECT * FROM lists WHERE id = ?
    `);
    const res = stmt.get(id) as List | undefined;
    return res ?? null;
  }

  private hasPinnedColsState: boolean | null = null;

  private hasPinnedCols(): boolean {
    if (this.hasPinnedColsState === null) {
      try {
        const cols = this.db.pragma('table_info(lists)') as Array<{ name: string }>;
        this.hasPinnedColsState = cols.some((c) => c.name === 'is_pinned');
      } catch {
        this.hasPinnedColsState = false;
      }
    }
    return this.hasPinnedColsState;
  }

  public create(payload: CreateListPayload): List {
    const id = payload.id ?? uuidv4();
    const now = new Date().toISOString();

    const isPinnedVal =
      payload.is_pinned !== undefined
        ? typeof payload.is_pinned === 'boolean'
          ? payload.is_pinned ? 1 : 0
          : payload.is_pinned
        : 0;

    const record: List = {
      id,
      name: payload.name,
      icon: payload.icon ?? null,
      color: payload.color ?? null,
      background_type: payload.background_type ?? 'none',
      background_value: payload.background_value ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      is_smart: payload.is_smart ? 1 : 0,
      smart_type: payload.smart_type ?? null,
      group_id: payload.group_id ?? null,
      notification_enabled: payload.notification_enabled !== false ? 1 : 0,
      is_pinned: isPinnedVal,
      pinned_sort_order: payload.pinned_sort_order ?? 0,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.hasPinnedCols()
      ? this.db.prepare(`
          INSERT INTO lists (
            id, name, icon, color, background_type, background_value,
            sort_order, is_smart, smart_type, group_id, notification_enabled,
            is_pinned, pinned_sort_order, created_at, updated_at
          ) VALUES (
            @id, @name, @icon, @color, @background_type, @background_value,
            @sort_order, @is_smart, @smart_type, @group_id, @notification_enabled,
            @is_pinned, @pinned_sort_order, @created_at, @updated_at
          )
        `)
      : this.db.prepare(`
          INSERT INTO lists (
            id, name, icon, color, background_type, background_value,
            sort_order, is_smart, smart_type, group_id, notification_enabled,
            created_at, updated_at
          ) VALUES (
            @id, @name, @icon, @color, @background_type, @background_value,
            @sort_order, @is_smart, @smart_type, @group_id, @notification_enabled,
            @created_at, @updated_at
          )
        `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateListPayload): List {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`List not found: ${id}`);
    }

    const updated: List = {
      ...current,
      ...fields,
      id,
      notification_enabled:
        fields.notification_enabled !== undefined
          ? typeof fields.notification_enabled === 'boolean'
            ? fields.notification_enabled ? 1 : 0
            : fields.notification_enabled
          : current.notification_enabled,
      is_pinned:
        fields.is_pinned !== undefined
          ? typeof fields.is_pinned === 'boolean'
            ? fields.is_pinned ? 1 : 0
            : fields.is_pinned
          : current.is_pinned ?? 0,
      pinned_sort_order:
        fields.pinned_sort_order !== undefined
          ? fields.pinned_sort_order
          : current.pinned_sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.hasPinnedCols()
      ? this.db.prepare(`
          UPDATE lists SET
            name = @name,
            icon = @icon,
            color = @color,
            background_type = @background_type,
            background_value = @background_value,
            sort_order = @sort_order,
            group_id = @group_id,
            notification_enabled = @notification_enabled,
            is_pinned = @is_pinned,
            pinned_sort_order = @pinned_sort_order,
            updated_at = @updated_at
          WHERE id = @id
        `)
      : this.db.prepare(`
          UPDATE lists SET
            name = @name,
            icon = @icon,
            color = @color,
            background_type = @background_type,
            background_value = @background_value,
            sort_order = @sort_order,
            group_id = @group_id,
            notification_enabled = @notification_enabled,
            updated_at = @updated_at
          WHERE id = @id
        `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM lists WHERE id = ?`);
    stmt.run(id);
  }

  public reorder(updates: Array<{ id: string; sortOrder: number }>): void {
    const updateStmt = this.db.prepare(`
      UPDATE lists SET sort_order = ?, updated_at = ? WHERE id = ?
    `);

    const runBatch = this.db.transaction((items: Array<{ id: string; sortOrder: number }>) => {
      const now = new Date().toISOString();
      for (const item of items) {
        updateStmt.run(item.sortOrder, now, item.id);
      }
    });

    runBatch(updates);
  }
}

export default ListRepository;
