import { BaseRepository } from './base-repository.js';
import type { PomodoroSession, CreatePomodoroPayload, PomodoroStats } from '../../shared/types/PomodoroSession.js';
import { v4 as uuidv4 } from 'uuid';

export class PomodoroRepository extends BaseRepository {
  public create(payload: CreatePomodoroPayload): PomodoroSession {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: PomodoroSession = {
      id,
      task_id: payload.task_id ?? null,
      type: payload.type,
      duration_seconds: payload.duration_seconds,
      started_at: payload.started_at ?? now,
      ended_at: null,
      was_completed: 0,
      created_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO pomodoro_sessions (
        id, task_id, type, duration_seconds, started_at, ended_at, was_completed, created_at
      ) VALUES (
        @id, @task_id, @type, @duration_seconds, @started_at, @ended_at, @was_completed, @created_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public complete(id: string, endedAt?: string): void {
    const end = endedAt ?? new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE pomodoro_sessions SET
        was_completed = 1,
        ended_at = ?
      WHERE id = ?
    `);
    stmt.run(end, id);
  }

  public getByTaskId(taskId: string): PomodoroSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pomodoro_sessions
      WHERE task_id = ?
      ORDER BY started_at DESC
    `);
    return stmt.all(taskId) as PomodoroSession[];
  }

  public getStats(from: string, to: string): PomodoroStats {
    const stmt = this.db.prepare(`
      SELECT * FROM pomodoro_sessions
      WHERE started_at >= ? AND started_at <= ? AND was_completed = 1
      ORDER BY started_at ASC
    `);

    const sessions = stmt.all(from, to) as PomodoroSession[];

    let totalMinutes = 0;
    const sessionsByDay: Record<string, number> = {};

    for (const session of sessions) {
      totalMinutes += Math.round(session.duration_seconds / 60);
      const day = session.started_at.substring(0, 10);
      sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1;
    }

    return {
      totalSessions: sessions.length,
      totalMinutes,
      sessionsByDay,
    };
  }
}

export default PomodoroRepository;
