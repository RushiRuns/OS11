import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './base-repository.js';
import type { NotificationHistoryItem, CreateNotificationPayload } from '@shared/types/index.js';

export class NotificationRepository extends BaseRepository {
  public add(payload: CreateNotificationPayload & { id?: string }): void {
    const id = payload.id ?? uuidv4();
    const createdAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO notification_history (id, type, task_id, title, body, created_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);
    stmt.run(id, payload.type, payload.task_id ?? null, payload.title, payload.body, createdAt);
  }

  public getAll(): NotificationHistoryItem[] {
    const stmt = this.db.prepare<[], NotificationHistoryItem>(`
      SELECT id, type, task_id, title, body, created_at, read_at
      FROM notification_history
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  public markRead(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE notification_history
      SET read_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  public markAllRead(): void {
    const stmt = this.db.prepare(`
      UPDATE notification_history
      SET read_at = ?
      WHERE read_at IS NULL
    `);
    stmt.run(new Date().toISOString());
  }

  public clear(): void {
    const stmt = this.db.prepare(`DELETE FROM notification_history`);
    stmt.run();
  }
}
