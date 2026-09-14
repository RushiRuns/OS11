import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { AnalyticsService } from '../../src/main/services/analytics/AnalyticsService.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ListRepository } from '../../src/main/repositories/ListRepository.js';
import { TagRepository } from '../../src/main/repositories/TagRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { PomodoroRepository } from '../../src/main/repositories/PomodoroRepository.js';

describe('Phase 14: AnalyticsService', () => {
  let db: Database.Database;
  let service: AnalyticsService;
  let taskRepo: TaskRepository;
  let listRepo: ListRepository;
  let tagRepo: TagRepository;
  let projectRepo: ProjectRepository;
  let pomoRepo: PomodoroRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    service = new AnalyticsService(db);
    taskRepo = new TaskRepository(db);
    listRepo = new ListRepository(db);
    tagRepo = new TagRepository(db);
    projectRepo = new ProjectRepository(db);
    pomoRepo = new PomodoroRepository(db);
  });

  it('aggregates personal stats (completed count, streak, avg hours, on-time rate, focus time)', () => {
    const list = listRepo.create({ name: 'Work', color: '#1B88FF' });
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Create tasks
    const t1 = taskRepo.create({
      title: 'Task 1 (On time today)',
      list_id: list.id,
      due_date: todayStr,
    });
    // Complete t1 today
    db.prepare(
      `UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?`
    ).run(`${todayStr}T14:30:00.000Z`, t1.id);

    const t2 = taskRepo.create({
      title: 'Task 2 (On time yesterday)',
      list_id: list.id,
      due_date: yesterdayStr,
    });
    // Complete t2 yesterday
    db.prepare(
      `UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?`
    ).run(`${yesterdayStr}T10:00:00.000Z`, t2.id);

    const t3 = taskRepo.create({
      title: 'Task 3 (Late)',
      list_id: list.id,
      due_date: '2020-01-01',
    });
    // Complete t3 today (late)
    db.prepare(
      `UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?`
    ).run(`${todayStr}T16:00:00.000Z`, t3.id);

    // Add completed Pomodoro session
    pomoRepo.create({
      type: 'work',
      duration_seconds: 1500, // 25 mins
      started_at: `${todayStr}T09:00:00.000Z`,
      task_id: t1.id,
    });
    // Complete session
    db.prepare(`UPDATE pomodoro_sessions SET was_completed = 1`).run();

    const stats = service.getPersonalStats();

    expect(stats.completedCount).toBe(3);
    expect(stats.tasksToday).toBe(2);
    expect(stats.streak).toBe(2); // today + yesterday
    expect(stats.totalFocusMinutes).toBe(25);
    // 2 out of 3 had due_date and on time: t1 (today <= today), t2 (yesterday <= yesterday), t3 (today > 2020-01-01) -> 2/3 = 67%
    expect(stats.onTimeRate).toBe(67);
  });

  it('calculates most productive day of the week and hour', () => {
    const list = listRepo.create({ name: 'Work' });

    // Wednesday = day 3, 14:00 (2 PM)
    const t1 = taskRepo.create({ title: 'Task Wed 1', list_id: list.id });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-09T14:10:00.000Z' WHERE id = ?`).run(t1.id);

    const t2 = taskRepo.create({ title: 'Task Wed 2', list_id: list.id });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-09T14:45:00.000Z' WHERE id = ?`).run(t2.id);

    // Thursday = day 4, 10:00 (10 AM)
    const t3 = taskRepo.create({ title: 'Task Thu', list_id: list.id });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-10T10:00:00.000Z' WHERE id = ?`).run(t3.id);

    const dayStat = service.getMostProductiveDay();
    expect(dayStat.dayOfWeek).toBe(3);
    expect(dayStat.dayName).toBe('Wednesday');
    expect(dayStat.count).toBe(2);

    const hourStat = service.getMostProductiveHour();
    expect(hourStat.hour).toBe(14);
    expect(hourStat.formattedHour).toBe('2 PM');
    expect(hourStat.count).toBe(2);
  });

  it('returns contiguous daily completions across date range', () => {
    const list = listRepo.create({ name: 'Work' });
    const from = '2026-09-01';
    const to = '2026-09-05';

    const t1 = taskRepo.create({ title: 'T1', list_id: list.id, due_date: '2026-09-02' });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-02T12:00:00.000Z' WHERE id = ?`).run(t1.id);

    const t2 = taskRepo.create({ title: 'T2', list_id: list.id, due_date: '2026-09-01' });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-04T12:00:00.000Z' WHERE id = ?`).run(t2.id); // Late

    const days = service.getCompletionsByDay(from, to);
    expect(days).toHaveLength(5);
    expect(days[0].date).toBe('2026-09-01');
    expect(days[0].count).toBe(0);

    expect(days[1].date).toBe('2026-09-02');
    expect(days[1].count).toBe(1);
    expect(days[1].onTimeCount).toBe(1);
    expect(days[1].lateCount).toBe(0);

    expect(days[3].date).toBe('2026-09-04');
    expect(days[3].count).toBe(1);
    expect(days[3].onTimeCount).toBe(0);
    expect(days[3].lateCount).toBe(1);
  });

  it('breaks down task distributions by list, tag, and priority', () => {
    const listA = listRepo.create({ name: 'Personal', color: '#27AE60' });
    const listB = listRepo.create({ name: 'Work', color: '#1B88FF' });
    const tag1 = tagRepo.create({ name: 'urgent', color: '#E74C3C' });

    const t1 = taskRepo.create({ title: 'Task 1', list_id: listA.id, priority: 3 });
    const t2 = taskRepo.create({ title: 'Task 2', list_id: listA.id, priority: 3 });
    taskRepo.create({ title: 'Task 3', list_id: listB.id, priority: 1 });

    tagRepo.addTagToTask(t1.id, tag1.id);
    tagRepo.addTagToTask(t2.id, tag1.id);

    const byList = service.getTasksByList();
    expect(byList.find((l) => l.name === 'Personal')?.count).toBe(2);
    expect(byList.find((l) => l.name === 'Work')?.count).toBe(1);

    const byTag = service.getTasksByTag();
    expect(byTag.find((t) => t.name === 'urgent')?.count).toBe(2);

    const byPriority = service.getTasksByPriority();
    expect(byPriority.find((p) => p.name === 'High')?.count).toBe(2);
    expect(byPriority.find((p) => p.name === 'Low')?.count).toBe(1);
    expect(byPriority.find((p) => p.name === 'None')?.count).toBe(0);
  });

  it('calculates pomodoro analytics and focus metrics', () => {
    pomoRepo.create({
      type: 'work',
      duration_seconds: 1500, // 25 mins
      started_at: '2026-09-10T09:00:00.000Z',
    });
    pomoRepo.create({
      type: 'work',
      duration_seconds: 3000, // 50 mins
      started_at: '2026-09-10T11:00:00.000Z',
    });
    pomoRepo.create({
      type: 'short_break', // Not counted in work minutes
      duration_seconds: 300,
      started_at: '2026-09-10T09:25:00.000Z',
    });
    db.prepare(`UPDATE pomodoro_sessions SET was_completed = 1`).run();

    const stats = service.getPomodoroStats();
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalMinutes).toBe(75);
    expect(stats.sessionsPerDay).toHaveLength(1);
    expect(stats.sessionsPerDay[0].sessions).toBe(2);
  });

  it('calculates project stats, burndown, and velocity', () => {
    const list = listRepo.create({ name: 'General' });
    const project = projectRepo.create({
      name: 'Mobile Redesign',
      due_date: '2026-10-01',
    });

    const t1 = taskRepo.create({ title: 'Wireframes', list_id: list.id, project_id: project.id });
    taskRepo.create({ title: 'Mockups', list_id: list.id, project_id: project.id });
    taskRepo.create({
      title: 'Dev',
      list_id: list.id,
      project_id: project.id,
      due_date: '2020-01-01', // Overdue
    });

    // Complete t1
    db.prepare(
      `UPDATE tasks SET is_completed = 1, completed_at = '2026-09-08T10:00:00.000Z' WHERE id = ?`
    ).run(t1.id);

    const stats = service.getProjectStats(project.id);
    expect(stats.projectName).toBe('Mobile Redesign');
    expect(stats.totalTasks).toBe(3);
    expect(stats.completedTasks).toBe(1);
    expect(stats.overdueTasks).toBe(1);
    expect(stats.burndown.length).toBeGreaterThan(0);
  });

  it('exports aggregated report as CSV string', () => {
    const list = listRepo.create({ name: 'Work' });
    const t = taskRepo.create({ title: 'Quarterly Review', list_id: list.id });
    db.prepare(`UPDATE tasks SET is_completed = 1, completed_at = '2026-09-14T10:00:00.000Z' WHERE id = ?`).run(t.id);

    const csv = service.exportCsv();
    expect(csv).toContain('OS11 Productivity & Analytics Report');
    expect(csv).toContain('--- SUMMARY METRICS ---');
    expect(csv).toContain('Tasks Completed,1');
    expect(csv).toContain('--- DAILY TASK COMPLETIONS ---');
    expect(csv).toContain('--- TASKS BY LIST ---');
    expect(csv).toContain('"Work",1');
  });
});
