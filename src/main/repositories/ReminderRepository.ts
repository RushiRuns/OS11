import { BaseRepository } from './base-repository.js';
import type { Reminder, CreateReminderPayload } from '../../shared/types/Reminder.js';
import { v4 as uuidv4 } from 'uuid';

export class ReminderRepository extends BaseRepository {
  public getUpcomingAndOverdue(): Reminder[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reminders
      WHERE is_triggered = 0
      ORDER BY COALESCE(snoozed_until, remind_at) ASC
    `);
    return stmt.all() as Reminder[];
  }

  public getByTaskId(taskId: string): Reminder[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reminders WHERE task_id = ? ORDER BY remind_at ASC
    `);
    return stmt.all(taskId) as Reminder[];
  }

  public create(payload: CreateReminderPayload): Reminder {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Reminder = {
      id,
      task_id: payload.task_id,
      remind_at: payload.remind_at,
      is_triggered: 0,
      snoozed_until: null,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO reminders (id, task_id, remind_at, is_triggered, snoozed_until, created_at)
      VALUES (@id, @task_id, @remind_at, @is_triggered, @snoozed_until, @created_at)
    `);

    stmt.run(record);
    return record;
  }

  public markTriggered(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE reminders SET is_triggered = 1 WHERE id = ?
    `);
    stmt.run(id);
  }

  public snooze(id: string, snoozedUntil: string): void {
    const stmt = this.db.prepare(`
      UPDATE reminders SET snoozed_until = ?, is_triggered = 0 WHERE id = ?
    `);
    stmt.run(snoozedUntil, id);
  }

  public deleteByTaskId(taskId: string): void {
    const stmt = this.db.prepare(`DELETE FROM reminders WHERE task_id = ?`);
    stmt.run(taskId);
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM reminders WHERE id = ?`);
    stmt.run(id);
  }
}

export default ReminderRepository;
