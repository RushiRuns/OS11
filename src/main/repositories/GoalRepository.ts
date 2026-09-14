import { BaseRepository } from './base-repository.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload } from '../../shared/types/Goal.js';
import type { GoalLink } from '../../shared/types/GoalLink.js';
import { v4 as uuidv4 } from 'uuid';

export class GoalRepository extends BaseRepository {
  public getAll(): Goal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goals
      ORDER BY target_date ASC, created_at DESC
    `);
    return stmt.all() as Goal[];
  }

  public getById(id: string): Goal | null {
    const stmt = this.db.prepare(`SELECT * FROM goals WHERE id = ?`);
    const res = stmt.get(id) as Goal | undefined;
    return res ?? null;
  }

  public create(payload: CreateGoalPayload): Goal {
    const id = uuidv4();
    const now = new Date().toISOString();

    const record: Goal = {
      id,
      title: payload.title,
      description: payload.description ?? null,
      goal_type: payload.goal_type,
      target_date: payload.target_date ?? null,
      target_value: payload.target_value ?? 100,
      current_value: payload.current_value ?? 0,
      streak_count: 0,
      last_progress_at: null,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO goals (
        id, title, description, goal_type, target_date,
        target_value, current_value, streak_count, last_progress_at,
        created_at, updated_at
      ) VALUES (
        @id, @title, @description, @goal_type, @target_date,
        @target_value, @current_value, @streak_count, @last_progress_at,
        @created_at, @updated_at
      )
    `);

    stmt.run(record);
    return record;
  }

  public update(id: string, fields: UpdateGoalPayload): Goal {
    const current = this.getById(id);
    if (!current) {
      throw new Error(`Goal not found: ${id}`);
    }

    const updated: Goal = {
      ...current,
      ...fields,
      id,
      updated_at: new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE goals SET
        title = @title,
        description = @description,
        goal_type = @goal_type,
        target_date = @target_date,
        target_value = @target_value,
        current_value = @current_value,
        streak_count = @streak_count,
        last_progress_at = @last_progress_at,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run(updated);
    return updated;
  }

  public delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM goals WHERE id = ?`);
    stmt.run(id);
  }

  public addLink(goalId: string, resourceType: 'task' | 'project', resourceId: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO goal_links (goal_id, resource_type, resource_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(goalId, resourceType, resourceId);
  }

  public removeLink(goalId: string, resourceId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM goal_links WHERE goal_id = ? AND resource_id = ?
    `);
    stmt.run(goalId, resourceId);
  }

  public getLinks(goalId: string): GoalLink[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_links WHERE goal_id = ?
    `);
    return stmt.all(goalId) as GoalLink[];
  }

  public getAllLinks(): GoalLink[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_links
    `);
    return stmt.all() as GoalLink[];
  }
}

export default GoalRepository;
