import { BaseRepository } from './base-repository.js';
import type { Goal, CreateGoalPayload, UpdateGoalPayload, GoalHabitLog, GoalProgressLog } from '../../shared/types/Goal.js';
import type { GoalLink } from '../../shared/types/GoalLink.js';
import { v4 as uuidv4 } from 'uuid';

export class GoalRepository extends BaseRepository {
  public getAll(): Goal[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goals
      ORDER BY 
        CASE status 
          WHEN 'active' THEN 1 
          WHEN 'paused' THEN 2 
          WHEN 'completed' THEN 3 
          WHEN 'archived' THEN 4 
          ELSE 5 
        END,
        target_date ASC, created_at DESC
    `);
    return stmt.all() as Goal[];
  }

  public getById(id: string): Goal | null {
    const stmt = this.db.prepare(`SELECT * FROM goals WHERE id = ?`);
    const res = stmt.get(id) as Goal | undefined;
    return res ?? null;
  }

  public create(payload: CreateGoalPayload): Goal {
    const id = payload.id ?? uuidv4();
    const now = new Date().toISOString();

    const record: Goal = {
      id,
      title: payload.title,
      description: payload.description ?? null,
      goal_type: payload.goal_type,
      status: payload.status ?? 'active',
      parent_goal_id: payload.parent_goal_id ?? null,
      category: payload.category ?? null,
      target_date: payload.target_date ?? null,
      target_value: payload.target_value ?? 100,
      current_value: payload.current_value ?? 0,
      streak_count: payload.streak_count ?? 0,
      longest_streak: payload.longest_streak ?? payload.streak_count ?? 0,
      last_progress_at: payload.last_progress_at ?? null,
      completed_at: payload.completed_at ?? null,
      created_at: payload.created_at ?? now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO goals (
        id, title, description, goal_type, status, parent_goal_id, category, target_date,
        target_value, current_value, streak_count, longest_streak, last_progress_at,
        completed_at, created_at, updated_at
      ) VALUES (
        @id, @title, @description, @goal_type, @status, @parent_goal_id, @category, @target_date,
        @target_value, @current_value, @streak_count, @longest_streak, @last_progress_at,
        @completed_at, @created_at, @updated_at
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
        status = @status,
        parent_goal_id = @parent_goal_id,
        category = @category,
        target_date = @target_date,
        target_value = @target_value,
        current_value = @current_value,
        streak_count = @streak_count,
        longest_streak = @longest_streak,
        last_progress_at = @last_progress_at,
        completed_at = @completed_at,
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

  public addHabitLog(goalId: string, checkInDate: string): GoalHabitLog {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO goal_habit_logs (goal_id, check_in_date, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(goalId, checkInDate, now);
    return { goal_id: goalId, check_in_date: checkInDate, created_at: now };
  }

  public removeHabitLog(goalId: string, checkInDate: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM goal_habit_logs WHERE goal_id = ? AND check_in_date = ?
    `);
    stmt.run(goalId, checkInDate);
  }

  public getHabitLogs(goalId: string): GoalHabitLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_habit_logs WHERE goal_id = ? ORDER BY check_in_date ASC
    `);
    return stmt.all(goalId) as GoalHabitLog[];
  }

  public getAllHabitLogs(): GoalHabitLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_habit_logs ORDER BY check_in_date ASC
    `);
    return stmt.all() as GoalHabitLog[];
  }

  public calculateStreakFromLogs(
    goalId: string,
    referenceDateStr?: string
  ): { currentStreak: number; lastDate: string | null } {
    const logs = this.getHabitLogs(goalId);
    if (logs.length === 0) {
      return { currentStreak: 0, lastDate: null };
    }
    const dateSet = new Set(logs.map((l) => l.check_in_date));
    const todayStr = referenceDateStr ?? new Date().toISOString().slice(0, 10);

    const d = new Date(`${todayStr}T00:00:00`);
    const yesterday = new Date(d);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let checkDate: Date | null = null;
    if (dateSet.has(todayStr)) {
      checkDate = new Date(d);
    } else if (dateSet.has(yesterdayStr)) {
      checkDate = new Date(yesterday);
    }

    let streak = 0;
    if (checkDate) {
      while (true) {
        const currIso = checkDate.toISOString().slice(0, 10);
        if (dateSet.has(currIso)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const sortedDates = Array.from(dateSet).sort();
    const lastDate = sortedDates[sortedDates.length - 1] ?? null;

    return { currentStreak: streak, lastDate };
  }

  public recordCheckIn(
    goalId: string,
    targetDate?: string
  ): { goal: Goal; isToggledOff: boolean } {
    const goal = this.getById(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const todayStr = targetDate ?? new Date().toISOString().slice(0, 10);
    const existingLog = this.db.prepare(`
      SELECT * FROM goal_habit_logs WHERE goal_id = ? AND check_in_date = ?
    `).get(goalId, todayStr);

    let isToggledOff = false;
    if (existingLog) {
      this.removeHabitLog(goalId, todayStr);
      isToggledOff = true;
    } else {
      this.addHabitLog(goalId, todayStr);
      isToggledOff = false;
    }

    const { currentStreak, lastDate } = this.calculateStreakFromLogs(goalId, todayStr);
    const newLongest = Math.max(goal.longest_streak ?? 0, currentStreak);
    const newLastProgress = lastDate ? `${lastDate}T12:00:00.000Z` : null;

    const updated = this.update(goalId, {
      streak_count: currentStreak,
      longest_streak: newLongest,
      last_progress_at: newLastProgress,
    });

    return { goal: updated, isToggledOff };
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

  public addProgressLog(
    goalId: string,
    progressPercent: number,
    currentValue: number,
    recordedAt?: string
  ): GoalProgressLog {
    const id = uuidv4();
    const timestamp = recordedAt ?? new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO goal_progress_logs (id, goal_id, progress_percent, current_value, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, goalId, progressPercent, currentValue, timestamp);

    return {
      id,
      goal_id: goalId,
      progress_percent: progressPercent,
      current_value: currentValue,
      recorded_at: timestamp,
    };
  }

  public getProgressLogs(goalId: string): GoalProgressLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_progress_logs
      WHERE goal_id = ?
      ORDER BY recorded_at ASC
    `);
    return stmt.all(goalId) as GoalProgressLog[];
  }

  public getAllProgressLogs(): GoalProgressLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM goal_progress_logs
      ORDER BY recorded_at ASC
    `);
    return stmt.all() as GoalProgressLog[];
  }
}

export default GoalRepository;
