import { BaseRepository } from './base-repository.js';
import type { Tag, CreateTagPayload, UpdateTagPayload } from '../../shared/types/Tag.js';
import type { Task } from '../../shared/types/task.js';
import { v4 as uuidv4 } from 'uuid';

export class TagRepository extends BaseRepository {
  public getAll(): Tag[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tags
      ORDER BY sort_order ASC, name ASC
    `);
    return stmt.all() as Tag[];
  }

  public getById(id: string): Tag | null {
    const stmt = this.db.prepare(`SELECT * FROM tags WHERE id = ?`);
    const res = stmt.get(id) as Tag | undefined;
    return res ?? null;
  }

  public create(payload: CreateTagPayload): Tag {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Tag = {
      id,
      name: payload.name,
      color: payload.color ?? null,
      parent_tag_id: payload.parent_tag_id ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO tags (id, name, color, parent_tag_id, sort_order, created_at)
      VALUES (@id, @name, @color, @parent_tag_id, @sort_order, @created_at)
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateTagPayload): Tag {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Tag not found: ${id}`);
    }

    const updated: Tag = {
      ...current,
      ...fields,
      id,
    };

    const stmt = this.db.prepare(`
      UPDATE tags SET
        name = @name,
        color = @color,
        parent_tag_id = @parent_tag_id,
        sort_order = @sort_order
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM tags WHERE id = ?`);
    stmt.run(id);
  }

  public getTagsForTask(taskId: string): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN task_tags tt ON tt.tag_id = t.id
      WHERE tt.task_id = ?
      ORDER BY t.sort_order ASC, t.name ASC
    `);
    return stmt.all(taskId) as Tag[];
  }

  public getForTask(taskId: string): Tag[] {
    return this.getTagsForTask(taskId);
  }

  public addTagToTask(taskId: string, tagId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO task_tags (task_id, tag_id)
      VALUES (?, ?)
    `);
    stmt.run(taskId, tagId);
  }

  public removeTagFromTask(taskId: string, tagId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM task_tags
      WHERE task_id = ? AND tag_id = ?
    `);
    stmt.run(taskId, tagId);
  }

  public getTasksForTag(tagId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN task_tags tt ON tt.task_id = t.id
      WHERE tt.tag_id = ? AND t.is_trashed = 0
      ORDER BY t.sort_order ASC, t.created_at DESC
    `);
    return stmt.all(tagId) as Task[];
  }

  public merge(sourceTagId: string, targetTagId: string): void {
    if (sourceTagId === targetTagId) return;
    const runInTransaction = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT OR IGNORE INTO task_tags (task_id, tag_id)
          SELECT task_id, ? FROM task_tags WHERE tag_id = ?
        `)
        .run(targetTagId, sourceTagId);

      this.db
        .prepare(`DELETE FROM task_tags WHERE tag_id = ?`)
        .run(sourceTagId);

      this.db
        .prepare(`DELETE FROM tags WHERE id = ?`)
        .run(sourceTagId);
    });

    runInTransaction();
  }
}

export default TagRepository;
