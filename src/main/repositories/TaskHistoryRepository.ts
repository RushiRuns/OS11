import { BaseRepository } from './base-repository.js';
import type { TaskHistoryRecord, TaskHistoryRow, TaskHistoryDiff } from '../../shared/types/TaskHistory.js';
import { v4 as uuidv4 } from 'uuid';

export class TaskHistoryRepository extends BaseRepository {
  public record(
    taskId: string,
    changedFields: Record<string, TaskHistoryDiff>,
    changedAt?: string
  ): TaskHistoryRecord {
    const id = uuidv4();
    const timestamp = changedAt ?? new Date().toISOString();
    const jsonFields = JSON.stringify(changedFields);

    const stmt = this.db.prepare(`
      INSERT INTO task_history (id, task_id, changed_fields, changed_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, taskId, jsonFields, timestamp);

    return {
      id,
      task_id: taskId,
      changed_fields: changedFields,
      changed_at: timestamp,
    };
  }

  public getByTaskId(taskId: string, limit = 50): TaskHistoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM task_history
      WHERE task_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(taskId, limit) as TaskHistoryRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public getById(id: string): TaskHistoryRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM task_history
      WHERE id = ?
    `);
    const row = stmt.get(id) as TaskHistoryRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public purgeOlderThan(days = 30): number {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const stmt = this.db.prepare(`
      DELETE FROM task_history
      WHERE changed_at < ?
    `);
    const info = stmt.run(cutoffDate);
    return info.changes;
  }

  private mapRow(row: TaskHistoryRow): TaskHistoryRecord {
    let changedFields: Record<string, TaskHistoryDiff> = {};
    try {
      changedFields = JSON.parse(row.changed_fields);
    } catch {
      changedFields = {};
    }

    return {
      id: row.id,
      task_id: row.task_id,
      changed_fields: changedFields,
      changed_at: row.changed_at,
    };
  }
}

export default TaskHistoryRepository;
