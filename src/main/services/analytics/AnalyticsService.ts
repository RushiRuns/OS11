import type Database from 'better-sqlite3';
import fs from 'node:fs';
import { getDb } from '../../repositories/db.js';
import type {
  PersonalStats,
  ProductiveDayStat,
  ProductiveHourStat,
  CompletionDayStat,
  DistributionStat,
  PomodoroAnalytics,
  ProjectAnalytics,
  BurndownPoint,
} from '@shared/types/index.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PRIORITY_META: Record<number, { label: string; color: string }> = {
  0: { label: 'None', color: '#95a5a6' },
  1: { label: 'Low', color: '#27ae60' },
  2: { label: 'Medium', color: '#f39c12' },
  3: { label: 'High', color: '#e74c3c' },
  4: { label: 'Critical', color: '#c0392b' },
};

export class AnalyticsService {
  private customDb?: Database.Database;

  constructor(customDb?: Database.Database) {
    this.customDb = customDb;
  }

  private get db(): Database.Database {
    return this.customDb ?? getDb();
  }

  /**
   * Aggregates personal productivity metrics: completed count, streak,
   * average completion hours, on-time rate %, tasks today, and focus minutes.
   */
  public getPersonalStats(from?: string, to?: string): PersonalStats {
    const todayStr = new Date().toISOString().slice(0, 10);
    const toBound = to ? `${to}T23:59:59.999Z` : undefined;

    // 1. Completed count in range
    let countSql = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE is_completed = 1 AND is_trashed = 0
    `;
    const countParams: unknown[] = [];
    if (from) {
      countSql += ` AND completed_at >= ?`;
      countParams.push(from);
    }
    if (toBound) {
      countSql += ` AND completed_at <= ?`;
      countParams.push(toBound);
    }
    const completedCountRow = this.db.prepare(countSql).get(...countParams) as { count: number };
    const completedCount = completedCountRow?.count ?? 0;

    // 2. Daily completion dates for streak calculation
    const streakRows = this.db
      .prepare(
        `SELECT DISTINCT substr(completed_at, 1, 10) as comp_date
         FROM tasks
         WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL
         ORDER BY comp_date DESC`
      )
      .all() as Array<{ comp_date: string }>;

    const dateSet = new Set(streakRows.map((r) => r.comp_date));
    let streak = 0;

    // Calculate yesterday's date
    const d = new Date();
    const yesterday = new Date(d);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let checkDate: Date | null = null;
    if (dateSet.has(todayStr)) {
      checkDate = new Date(d);
    } else if (dateSet.has(yesterdayStr)) {
      checkDate = new Date(yesterday);
    }

    if (checkDate) {
      let isStreakActive = true;
      while (isStreakActive) {
        const currIso = checkDate.toISOString().slice(0, 10);
        if (dateSet.has(currIso)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          isStreakActive = false;
        }
      }
    }

    // 3. Average completion time (hours from created_at to completed_at)
    let avgSql = `
      SELECT AVG((julianday(completed_at) - julianday(created_at)) * 24.0) as avg_hours
      FROM tasks
      WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL AND created_at IS NOT NULL
    `;
    const avgParams: unknown[] = [];
    if (from) {
      avgSql += ` AND completed_at >= ?`;
      avgParams.push(from);
    }
    if (toBound) {
      avgSql += ` AND completed_at <= ?`;
      avgParams.push(toBound);
    }
    const avgRow = this.db.prepare(avgSql).get(...avgParams) as { avg_hours: number | null };
    const rawAvg = avgRow?.avg_hours != null ? Math.max(0, avgRow.avg_hours) : 0;
    const avgCompletionHours = Math.round(rawAvg * 10) / 10;

    // 4. On-time rate %
    let onTimeSql = `
      SELECT
        COUNT(*) as total_with_due,
        SUM(CASE WHEN substr(completed_at, 1, 10) <= due_date THEN 1 ELSE 0 END) as on_time
      FROM tasks
      WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL AND due_date IS NOT NULL
    `;
    const onTimeParams: unknown[] = [];
    if (from) {
      onTimeSql += ` AND completed_at >= ?`;
      onTimeParams.push(from);
    }
    if (toBound) {
      onTimeSql += ` AND completed_at <= ?`;
      onTimeParams.push(toBound);
    }
    const onTimeRow = this.db.prepare(onTimeSql).get(...onTimeParams) as {
      total_with_due: number;
      on_time: number | null;
    };
    const totalWithDue = onTimeRow?.total_with_due ?? 0;
    const onTime = onTimeRow?.on_time ?? 0;
    const onTimeRate = totalWithDue > 0 ? Math.round((onTime / totalWithDue) * 100) : 100;

    // 5. Tasks completed today
    const tasksTodayRow = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM tasks
         WHERE is_completed = 1 AND is_trashed = 0 AND substr(completed_at, 1, 10) = ?`
      )
      .get(todayStr) as { count: number };
    const tasksToday = tasksTodayRow?.count ?? 0;

    // 6. Total focus minutes from completed work sessions
    let pomoSql = `
      SELECT COALESCE(ROUND(SUM(duration_seconds) / 60.0), 0) as total_minutes
      FROM pomodoro_sessions
      WHERE type = 'work' AND was_completed = 1
    `;
    const pomoParams: unknown[] = [];
    if (from) {
      pomoSql += ` AND started_at >= ?`;
      pomoParams.push(from);
    }
    if (toBound) {
      pomoSql += ` AND started_at <= ?`;
      pomoParams.push(toBound);
    }
    const pomoRow = this.db.prepare(pomoSql).get(...pomoParams) as { total_minutes: number };
    const totalFocusMinutes = pomoRow?.total_minutes ?? 0;

    return {
      completedCount,
      streak,
      avgCompletionHours,
      onTimeRate,
      tasksToday,
      totalFocusMinutes,
    };
  }

  /**
   * Day of week with highest completions (0 = Sunday .. 6 = Saturday)
   */
  public getMostProductiveDay(): ProductiveDayStat {
    const row = this.db
      .prepare(
        `SELECT CAST(strftime('%w', completed_at) AS INTEGER) as day_of_week, COUNT(*) as count
         FROM tasks
         WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL
         GROUP BY day_of_week
         ORDER BY count DESC, day_of_week ASC
         LIMIT 1`
      )
      .get() as { day_of_week: number; count: number } | undefined;

    const dayOfWeek = row ? row.day_of_week : 1;
    const count = row ? row.count : 0;
    return {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek] ?? 'Monday',
      count,
    };
  }

  /**
   * Hour of day (0..23) with highest completions
   */
  public getMostProductiveHour(): ProductiveHourStat {
    const row = this.db
      .prepare(
        `SELECT CAST(strftime('%H', completed_at) AS INTEGER) as hour, COUNT(*) as count
         FROM tasks
         WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL
         GROUP BY hour
         ORDER BY count DESC, hour ASC
         LIMIT 1`
      )
      .get() as { hour: number; count: number } | undefined;

    const hour = row ? row.hour : 10;
    const count = row ? row.count : 0;

    const formattedHour =
      hour === 0
        ? '12 AM'
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? '12 PM'
            : `${hour - 12} PM`;

    return {
      hour,
      formattedHour,
      count,
    };
  }

  /**
   * Daily task completions across date range (default: last 30 days)
   */
  public getCompletionsByDay(from?: string, to?: string): CompletionDayStat[] {
    const now = new Date();
    const toDateStr = to ?? now.toISOString().slice(0, 10);
    const fromDateStr =
      from ?? new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const rows = this.db
      .prepare(
        `SELECT
           substr(completed_at, 1, 10) as date,
           COUNT(*) as count,
           SUM(CASE WHEN due_date IS NULL OR substr(completed_at, 1, 10) <= due_date THEN 1 ELSE 0 END) as on_time_count,
           SUM(CASE WHEN due_date IS NOT NULL AND substr(completed_at, 1, 10) > due_date THEN 1 ELSE 0 END) as late_count
         FROM tasks
         WHERE is_completed = 1 AND is_trashed = 0 AND completed_at IS NOT NULL
           AND substr(completed_at, 1, 10) >= ? AND substr(completed_at, 1, 10) <= ?
         GROUP BY date
         ORDER BY date ASC`
      )
      .all(fromDateStr, toDateStr) as Array<{
      date: string;
      count: number;
      on_time_count: number;
      late_count: number;
    }>;

    const map = new Map<string, { count: number; onTimeCount: number; lateCount: number }>();
    for (const r of rows) {
      map.set(r.date, {
        count: r.count,
        onTimeCount: r.on_time_count ?? 0,
        lateCount: r.late_count ?? 0,
      });
    }

    // Fill contiguous days between fromDateStr and toDateStr
    const result: CompletionDayStat[] = [];
    const current = new Date(`${fromDateStr}T00:00:00.000Z`);
    const end = new Date(`${toDateStr}T00:00:00.000Z`);

    while (current <= end) {
      const dStr = current.toISOString().slice(0, 10);
      const existing = map.get(dStr);
      result.push({
        date: dStr,
        count: existing?.count ?? 0,
        onTimeCount: existing?.onTimeCount ?? 0,
        lateCount: existing?.lateCount ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * Task count grouped by list (excluding trashed tasks and smart lists)
   */
  public getTasksByList(): DistributionStat[] {
    const rows = this.db
      .prepare(
        `SELECT
           l.id,
           l.name,
           COALESCE(l.color, '#1B88FF') as color,
           COUNT(t.id) as count
         FROM lists l
         LEFT JOIN tasks t ON t.list_id = l.id AND t.is_trashed = 0
         WHERE l.is_smart = 0
         GROUP BY l.id, l.name, l.color
         ORDER BY count DESC`
      )
      .all() as Array<{ id: string; name: string; color: string; count: number }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      count: r.count,
    }));
  }

  /**
   * Task count grouped by tag
   */
  public getTasksByTag(): DistributionStat[] {
    const rows = this.db
      .prepare(
        `SELECT
           tg.id,
           tg.name,
           COALESCE(tg.color, '#9B59B6') as color,
           COUNT(tt.task_id) as count
         FROM tags tg
         JOIN task_tags tt ON tt.tag_id = tg.id
         JOIN tasks t ON t.id = tt.task_id AND t.is_trashed = 0
         GROUP BY tg.id, tg.name, tg.color
         ORDER BY count DESC`
      )
      .all() as Array<{ id: string; name: string; color: string; count: number }>;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      count: r.count,
    }));
  }

  /**
   * Task count grouped by priority
   */
  public getTasksByPriority(): DistributionStat[] {
    const rows = this.db
      .prepare(
        `SELECT priority, COUNT(*) as count
         FROM tasks
         WHERE is_trashed = 0
         GROUP BY priority
         ORDER BY priority ASC`
      )
      .all() as Array<{ priority: number; count: number }>;

    const countsByPriority = new Map<number, number>();
    for (const r of rows) {
      countsByPriority.set(r.priority, r.count);
    }

    const result: DistributionStat[] = [];
    for (let p = 0; p <= 4; p++) {
      const meta = PRIORITY_META[p] ?? { label: `P${p}`, color: '#95a5a6' };
      result.push({
        id: `priority_${p}`,
        name: meta.label,
        color: meta.color,
        count: countsByPriority.get(p) ?? 0,
      });
    }

    return result;
  }

  /**
   * Focus session statistics from completed Pomodoro sessions
   */
  public getPomodoroStats(from?: string, to?: string): PomodoroAnalytics {
    const toBound = to ? `${to}T23:59:59.999Z` : undefined;

    let sql = `
      SELECT
        substr(started_at, 1, 10) as date,
        COUNT(*) as sessions,
        COALESCE(ROUND(SUM(duration_seconds) / 60.0), 0) as minutes
      FROM pomodoro_sessions
      WHERE type = 'work' AND was_completed = 1
    `;
    const params: unknown[] = [];
    if (from) {
      sql += ` AND started_at >= ?`;
      params.push(from);
    }
    if (toBound) {
      sql += ` AND started_at <= ?`;
      params.push(toBound);
    }
    sql += ` GROUP BY date ORDER BY date ASC`;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      date: string;
      sessions: number;
      minutes: number;
    }>;

    let totalSessions = 0;
    let totalMinutes = 0;
    for (const r of rows) {
      totalSessions += r.sessions;
      totalMinutes += r.minutes;
    }

    return {
      totalSessions,
      totalMinutes,
      sessionsPerDay: rows,
    };
  }

  /**
   * Project task completion stats, velocity, and burndown trajectory
   */
  public getProjectStats(projectId: string): ProjectAnalytics {
    const project = this.db
      .prepare(`SELECT id, name, created_at, due_date FROM projects WHERE id = ?`)
      .get(projectId) as
      | { id: string; name: string; created_at: string; due_date: string | null }
      | undefined;

    const projectName = project?.name ?? 'Project';

    const counts = this.db
      .prepare(
        `SELECT
           COUNT(*) as total_tasks,
           SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
           SUM(CASE WHEN is_completed = 0 AND due_date IS NOT NULL AND due_date < date('now') THEN 1 ELSE 0 END) as overdue_tasks
         FROM tasks
         WHERE project_id = ? AND is_trashed = 0`
      )
      .get(projectId) as {
      total_tasks: number;
      completed_tasks: number | null;
      overdue_tasks: number | null;
    };

    const totalTasks = counts?.total_tasks ?? 0;
    const completedTasks = counts?.completed_tasks ?? 0;
    const overdueTasks = counts?.overdue_tasks ?? 0;

    // Velocity: completed in the last 28 days divided by 4 weeks
    const velocityRow = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM tasks
         WHERE project_id = ? AND is_trashed = 0 AND is_completed = 1
           AND completed_at >= date('now', '-28 days')`
      )
      .get(projectId) as { count: number };
    const velocity = Math.round(((velocityRow?.count ?? 0) / 4) * 10) / 10;

    // Burndown calculation: create points across project span (or last 30 days)
    const now = new Date();
    const createdStr = project?.created_at?.slice(0, 10) ?? new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
    const dueStr = project?.due_date ?? new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    const startDate = new Date(`${createdStr}T00:00:00.000Z`);
    const endDate = new Date(`${dueStr}T00:00:00.000Z`);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

    // Get completions by date within project
    const completions = this.db
      .prepare(
        `SELECT substr(completed_at, 1, 10) as date, COUNT(*) as count
         FROM tasks
         WHERE project_id = ? AND is_trashed = 0 AND is_completed = 1 AND completed_at IS NOT NULL
         GROUP BY date
         ORDER BY date ASC`
      )
      .all(projectId) as Array<{ date: string; count: number }>;

    const compByDate = new Map<string, number>();
    for (const c of completions) {
      compByDate.set(c.date, c.count);
    }

    const burndown: BurndownPoint[] = [];
    let cumCompleted = 0;
    const curr = new Date(startDate);
    const dayStep = totalDays > 60 ? Math.ceil(totalDays / 30) : 1;

    let dayIndex = 0;
    while (curr <= endDate || burndown.length < 5) {
      const dStr = curr.toISOString().slice(0, 10);
      cumCompleted += compByDate.get(dStr) ?? 0;
      const remaining = Math.max(0, totalTasks - cumCompleted);
      const idealProgress = Math.min(1, dayIndex / totalDays);
      const idealRemaining = Math.max(0, Math.round(totalTasks * (1 - idealProgress)));

      burndown.push({
        date: dStr,
        remaining,
        ideal: idealRemaining,
        completed: cumCompleted,
      });

      curr.setDate(curr.getDate() + dayStep);
      dayIndex += dayStep;
      if (burndown.length > 60) break;
    }

    return {
      projectId,
      projectName,
      totalTasks,
      completedTasks,
      overdueTasks,
      velocity,
      burndown,
    };
  }

  /**
   * Serializes dashboard analytics into RFC 4180 CSV format and optionally writes to disk.
   */
  public exportCsv(from?: string, to?: string, targetFilePath?: string): string {
    const personal = this.getPersonalStats(from, to);
    const productiveDay = this.getMostProductiveDay();
    const productiveHour = this.getMostProductiveHour();
    const completions = this.getCompletionsByDay(from, to);
    const byList = this.getTasksByList();
    const byTag = this.getTasksByTag();
    const byPriority = this.getTasksByPriority();
    const pomo = this.getPomodoroStats(from, to);

    const lines: string[] = [];

    // Header & Summary
    lines.push('OS11 Productivity & Analytics Report');
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push(`Date Range,"${from ?? 'All time'}" to "${to ?? 'Today'}"`);
    lines.push('');

    lines.push('--- SUMMARY METRICS ---');
    lines.push('Metric,Value');
    lines.push(`Tasks Completed,${personal.completedCount}`);
    lines.push(`Current Streak (days),${personal.streak}`);
    lines.push(`On-Time Rate,${personal.onTimeRate}%`);
    lines.push(`Avg Completion Time (hours),${personal.avgCompletionHours}`);
    lines.push(`Tasks Completed Today,${personal.tasksToday}`);
    lines.push(`Total Focus Time (minutes),${personal.totalFocusMinutes}`);
    lines.push(`Most Productive Day,${productiveDay.dayName} (${productiveDay.count} tasks)`);
    lines.push(`Most Productive Hour,${productiveHour.formattedHour} (${productiveHour.count} tasks)`);
    lines.push('');

    // Daily Completions
    lines.push('--- DAILY TASK COMPLETIONS ---');
    lines.push('Date,Completed Total,On Time,Late');
    for (const c of completions) {
      lines.push(`${c.date},${c.count},${c.onTimeCount},${c.lateCount}`);
    }
    lines.push('');

    // By List
    lines.push('--- TASKS BY LIST ---');
    lines.push('List Name,Task Count');
    for (const l of byList) {
      lines.push(`"${l.name.replace(/"/g, '""')}",${l.count}`);
    }
    lines.push('');

    // By Tag
    lines.push('--- TASKS BY TAG ---');
    lines.push('Tag Name,Task Count');
    for (const t of byTag) {
      lines.push(`"${t.name.replace(/"/g, '""')}",${t.count}`);
    }
    lines.push('');

    // By Priority
    lines.push('--- TASKS BY PRIORITY ---');
    lines.push('Priority,Task Count');
    for (const p of byPriority) {
      lines.push(`${p.name},${p.count}`);
    }
    lines.push('');

    // Pomodoro
    lines.push('--- FOCUS SESSIONS ---');
    lines.push('Date,Work Sessions,Minutes Focused');
    for (const s of pomo.sessionsPerDay) {
      lines.push(`${s.date},${s.sessions},${s.minutes}`);
    }

    const csvContent = lines.join('\n');

    if (targetFilePath) {
      fs.writeFileSync(targetFilePath, csvContent, 'utf-8');
    }

    return csvContent;
  }
}

export default AnalyticsService;
