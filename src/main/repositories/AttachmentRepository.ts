import { BaseRepository } from './base-repository.js';
import type { Attachment, CreateAttachmentPayload } from '../../shared/types/Attachment.js';
import { v4 as uuidv4 } from 'uuid';

export class AttachmentRepository extends BaseRepository {
  public getAll(): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attachments
      ORDER BY created_at DESC
    `);
    return stmt.all() as Attachment[];
  }

  public getByTaskId(taskId: string): Attachment[] {
    const stmt = this.db.prepare(`
      SELECT * FROM attachments
      WHERE task_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(taskId) as Attachment[];
  }

  public getById(id: string): Attachment | null {
    const stmt = this.db.prepare(`SELECT * FROM attachments WHERE id = ?`);
    const res = stmt.get(id) as Attachment | undefined;
    return res ?? null;
  }

  public getCountByTaskId(taskId: string): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM attachments WHERE task_id = ?`);
    const res = stmt.get(taskId) as { count: number } | undefined;
    return res?.count ?? 0;
  }

  public getAllCounts(): Record<string, number> {
    const stmt = this.db.prepare(`SELECT task_id, COUNT(*) as count FROM attachments GROUP BY task_id`);
    const rows = stmt.all() as Array<{ task_id: string; count: number }>;
    const counts: Record<string, number> = {};
    for (const r of rows) {
      counts[r.task_id] = r.count;
    }
    return counts;
  }

  public create(payload: CreateAttachmentPayload): Attachment {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Attachment = {
      id,
      task_id: payload.task_id,
      filename: payload.filename,
      original_name: payload.original_name,
      mime_type: payload.mime_type,
      size_bytes: payload.size_bytes,
      local_path: payload.local_path,
      is_link: payload.is_link ?? 0,
      thumbnail_path: payload.thumbnail_path ?? null,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO attachments (
        id, task_id, filename, original_name, mime_type, size_bytes, local_path, is_link, thumbnail_path, created_at
      ) VALUES (
        @id, @task_id, @filename, @original_name, @mime_type, @size_bytes, @local_path, @is_link, @thumbnail_path, @created_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public delete(id: string): Attachment {
    const record = this.getById(id);
    if (!record) {
      throw new Error(`Attachment not found: ${id}`);
    }

    const stmt = this.db.prepare(`DELETE FROM attachments WHERE id = ?`);
    stmt.run(id);
    return record;
  }
}

export default AttachmentRepository;
