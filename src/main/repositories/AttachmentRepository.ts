import { BaseRepository } from './base-repository.js';
import type { Attachment, CreateAttachmentPayload } from '../../shared/types/Attachment.js';
import { v4 as uuidv4 } from 'uuid';

export class AttachmentRepository extends BaseRepository {
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
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO attachments (
        id, task_id, filename, original_name, mime_type, size_bytes, local_path, created_at
      ) VALUES (
        @id, @task_id, @filename, @original_name, @mime_type, @size_bytes, @local_path, @created_at
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
