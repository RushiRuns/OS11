import { BaseRepository } from './base-repository.js';
import type { ListGroup, CreateListGroupPayload, UpdateListGroupPayload } from '../../shared/types/ListGroup.js';
import { v4 as uuidv4 } from 'uuid';

export class ListGroupRepository extends BaseRepository {
  public getAll(): ListGroup[] {
    const stmt = this.db.prepare(`
      SELECT * FROM list_groups
      ORDER BY sort_order ASC, created_at ASC
    `);
    return stmt.all() as ListGroup[];
  }

  public getById(id: string): ListGroup | null {
    const stmt = this.db.prepare(`
      SELECT * FROM list_groups WHERE id = ?
    `);
    const res = stmt.get(id) as ListGroup | undefined;
    return res ?? null;
  }

  public create(payload: CreateListGroupPayload): ListGroup {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: ListGroup = {
      id,
      name: payload.name,
      sort_order: payload.sort_order ?? Date.now(),
      is_collapsed: payload.is_collapsed ? 1 : 0,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO list_groups (id, name, sort_order, is_collapsed, created_at)
      VALUES (@id, @name, @sort_order, @is_collapsed, @created_at)
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateListGroupPayload): ListGroup {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`ListGroup not found: ${id}`);
    }

    const updated: ListGroup = {
      ...current,
      ...fields,
      id,
      is_collapsed:
        fields.is_collapsed !== undefined
          ? typeof fields.is_collapsed === 'boolean'
            ? fields.is_collapsed ? 1 : 0
            : fields.is_collapsed
          : current.is_collapsed,
    };

    const stmt = this.db.prepare(`
      UPDATE list_groups SET
        name = @name,
        sort_order = @sort_order,
        is_collapsed = @is_collapsed
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM list_groups WHERE id = ?`);
    stmt.run(id);
  }

  public reorder(updates: Array<{ id: string; sortOrder: number }>): void {
    const updateStmt = this.db.prepare(`
      UPDATE list_groups SET sort_order = ? WHERE id = ?
    `);

    const runBatch = this.db.transaction((items: Array<{ id: string; sortOrder: number }>) => {
      for (const item of items) {
        updateStmt.run(item.sortOrder, item.id);
      }
    });

    runBatch(updates);
  }
}

export default ListGroupRepository;
