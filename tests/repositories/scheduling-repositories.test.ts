import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from '../../src/main/migrations/runner.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ProjectRepository } from '../../src/main/repositories/ProjectRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';

describe('Repositories: GTD Scheduling, Projects, and Reminders', () => {
  let db: Database.Database;
  let taskRepo: TaskRepository;
  let projectRepo: ProjectRepository;
  let reminderRepo: ReminderRepository;

  const migrationsDir = path.resolve(__dirname, '../../src/main/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(db, migrationsDir);
    taskRepo = new TaskRepository(db);
    projectRepo = new ProjectRepository(db);
    reminderRepo = new ReminderRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('TaskRepository GTD queries', () => {
    it('getInbox only returns untriaged tasks (no area, no project, no parent, no date, no bucket, not waiting)', () => {
      // 1. Untriaged task -> should appear in inbox
      const inboxTask = taskRepo.create({ title: 'Inbox item' });

      // 2. Dated task without container -> should NOT appear in inbox
      taskRepo.create({ title: 'Dated item', due_date: '2026-10-15' });

      // 3. Anytime task -> should NOT appear in inbox
      taskRepo.create({ title: 'Anytime item', bucket: 'anytime' });

      // 4. Someday task -> should NOT appear in inbox
      taskRepo.create({ title: 'Someday item', bucket: 'someday' });

      // 5. Waiting task -> should NOT appear in inbox
      taskRepo.create({ title: 'Waiting item', waiting_on: 'Dave', waiting_since: '2026-10-01' });

      // 6. Project task -> should NOT appear in inbox
      const proj = projectRepo.create({ name: 'Active Project' });
      taskRepo.create({ title: 'Project item', project_id: proj.id });

      const inbox = taskRepo.getInbox();
      expect(inbox.length).toBe(1);
      expect(inbox[0].id).toBe(inboxTask.id);
    });

    it('getAnytime returns tasks with bucket="anytime"', () => {
      taskRepo.create({ title: 'Normal task' });
      const anytimeTask = taskRepo.create({ title: 'Anytime task', bucket: 'anytime' });

      const anytimeList = taskRepo.getAnytime();
      expect(anytimeList.length).toBe(1);
      expect(anytimeList[0].id).toBe(anytimeTask.id);
    });

    it('getSomeday returns tasks with bucket="someday"', () => {
      taskRepo.create({ title: 'Normal task' });
      const somedayTask = taskRepo.create({ title: 'Someday task', bucket: 'someday' });

      const somedayList = taskRepo.getSomeday();
      expect(somedayList.length).toBe(1);
      expect(somedayList[0].id).toBe(somedayTask.id);
    });

    it('getWaitingFor returns tasks with waiting_since and sorts by follow_up_date', () => {
      const w1 = taskRepo.create({
        title: 'Waiting with no date',
        waiting_on: 'Carol',
        waiting_since: '2026-10-01',
      });
      const w2 = taskRepo.create({
        title: 'Waiting due early',
        waiting_on: 'Bob',
        waiting_since: '2026-10-02',
        follow_up_date: '2026-10-05',
      });
      const w3 = taskRepo.create({
        title: 'Waiting due later',
        waiting_on: 'Alice',
        waiting_since: '2026-10-03',
        follow_up_date: '2026-10-10',
      });

      const waitingList = taskRepo.getWaitingFor();
      expect(waitingList.length).toBe(3);
      expect(waitingList[0].id).toBe(w2.id); // 2026-10-05
      expect(waitingList[1].id).toBe(w3.id); // 2026-10-10
      expect(waitingList[2].id).toBe(w1.id); // null date last
    });

    it('getGtdTaskCounts aggregates inbox, anytime, someday, waiting, and waitingOverdue', () => {
      const today = '2026-10-04';
      taskRepo.create({ title: 'Inbox 1' });
      taskRepo.create({ title: 'Inbox 2' });
      taskRepo.create({ title: 'Anytime 1', bucket: 'anytime' });
      taskRepo.create({ title: 'Someday 1', bucket: 'someday' });
      taskRepo.create({ title: 'Waiting normal', waiting_on: 'X', waiting_since: '2026-10-01', follow_up_date: '2026-10-10' });
      taskRepo.create({ title: 'Waiting overdue', waiting_on: 'Y', waiting_since: '2026-10-01', follow_up_date: '2026-10-02' });

      const counts = taskRepo.getGtdTaskCounts(today);
      expect(counts.inbox).toBe(2);
      expect(counts.anytime).toBe(1);
      expect(counts.someday).toBe(1);
      expect(counts.waitingFor).toBe(2);
      expect(counts.waitingOverdue).toBe(1);
    });

    it('updateSchedulingFields atomically updates scheduling columns', () => {
      const task = taskRepo.create({ title: 'Sample' });
      const updated = taskRepo.updateSchedulingFields(
        task.id,
        {
          bucket: 'anytime',
          due_date: null,
          due_time: null,
          all_day: 1,
          recurrence_rule: null,
          waiting_on: 'Partner',
          waiting_since: '2026-10-04T00:00:00.000Z',
          follow_up_date: '2026-10-12',
          follow_up_notified_on: null,
          reviewed_at: null,
        },
        new Date().toISOString()
      );

      expect(updated.bucket).toBe('anytime');
      expect(updated.waiting_on).toBe('Partner');
      expect(updated.follow_up_date).toBe('2026-10-12');
    });

    it('markSomedayReviewedBatch marks multiple tasks with reviewed_at', () => {
      const t1 = taskRepo.create({ title: 'T1', bucket: 'someday' });
      const t2 = taskRepo.create({ title: 'T2', bucket: 'someday' });
      const now = '2026-10-04T12:00:00.000Z';

      taskRepo.markSomedayReviewedBatch([t1.id, t2.id], now);

      expect(taskRepo.getById(t1.id)?.reviewed_at).toBe(now);
      expect(taskRepo.getById(t2.id)?.reviewed_at).toBe(now);
    });
  });

  describe('ProjectRepository GTD methods', () => {
    it('setSomeday updates is_someday and reviewed_at', () => {
      const proj = projectRepo.create({ name: 'Someday Project' });
      expect(proj.is_someday).toBe(0);

      const updated = projectRepo.setSomeday(proj.id, true, '2026-10-04T10:00:00.000Z');
      expect(updated.is_someday).toBe(1);
      expect(updated.reviewed_at).toBe('2026-10-04T10:00:00.000Z');

      const somedayProjects = projectRepo.getSomedayProjects();
      expect(somedayProjects.some((p) => p.id === proj.id)).toBe(true);
    });

    it('markReviewedBatch updates reviewed_at on multiple projects', () => {
      const p1 = projectRepo.create({ name: 'P1' });
      const p2 = projectRepo.create({ name: 'P2' });
      const now = '2026-10-04T15:00:00.000Z';

      projectRepo.markReviewedBatch([p1.id, p2.id], now);

      expect(projectRepo.getById(p1.id)?.reviewed_at).toBe(now);
      expect(projectRepo.getById(p2.id)?.reviewed_at).toBe(now);
    });
  });

  describe('ReminderRepository deleteByTaskId', () => {
    it('returns deleted reminder IDs when deleting by taskId', () => {
      const task = taskRepo.create({ title: 'Task with reminders' });
      const r1 = reminderRepo.create({ task_id: task.id, remind_at: '2026-10-15T09:00:00.000Z' });
      const r2 = reminderRepo.create({ task_id: task.id, remind_at: '2026-10-15T12:00:00.000Z' });

      const deletedIds = reminderRepo.deleteByTaskId(task.id);
      expect(deletedIds).toContain(r1.id);
      expect(deletedIds).toContain(r2.id);
      expect(deletedIds.length).toBe(2);

      expect(reminderRepo.getByTaskId(task.id)).toEqual([]);
    });

    it('returns empty array if no reminders exist for taskId', () => {
      const deletedIds = reminderRepo.deleteByTaskId('non-existent-task');
      expect(deletedIds).toEqual([]);
    });
  });
});
