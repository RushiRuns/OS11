import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { GoalRepository } from '../../src/main/repositories/GoalRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { ReminderRepository } from '../../src/main/repositories/ReminderRepository.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { ReminderService } from '../../src/main/services/reminder/ReminderService.js';

describe('Phase 13: Agenda & Goals', () => {
  let db: Database.Database;
  let goalRepo: GoalRepository;
  let taskRepo: TaskRepository;
  let reminderRepo: ReminderRepository;
  let notifRepo: NotificationRepository;
  let notifService: NotificationService;
  let reminderService: ReminderService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    goalRepo = new GoalRepository(db);
    taskRepo = new TaskRepository(db);
    reminderRepo = new ReminderRepository(db);
    notifRepo = new NotificationRepository(db);
    notifService = new NotificationService(notifRepo);
    reminderService = new ReminderService(reminderRepo, notifService, taskRepo);
  });

  describe('GoalRepository & Links', () => {
    it('creates, updates, and deletes goals', () => {
      const goal = goalRepo.create({
        title: 'Run a marathon',
        description: 'Complete 42km by end of year',
        goal_type: 'milestone',
        target_date: '2026-12-31',
        target_value: 42,
        current_value: 10,
      });

      expect(goal.id).toBeDefined();
      expect(goal.title).toBe('Run a marathon');
      expect(goal.goal_type).toBe('milestone');
      expect(goal.streak_count).toBe(0);

      // Update streak and current value
      const updated = goalRepo.update(goal.id, {
        current_value: 20,
        streak_count: 5,
      });
      expect(updated.current_value).toBe(20);
      expect(updated.streak_count).toBe(5);

      const all = goalRepo.getAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(goal.id);

      goalRepo.delete(goal.id);
      expect(goalRepo.getAll().length).toBe(0);
    });

    it('manages goal links and batch retrieval via getAllLinks()', () => {
      const g1 = goalRepo.create({ title: 'Goal 1', goal_type: 'outcome' });
      const g2 = goalRepo.create({ title: 'Goal 2', goal_type: 'habit' });

      goalRepo.addLink(g1.id, 'task', 'task-1');
      goalRepo.addLink(g1.id, 'task', 'task-2');
      goalRepo.addLink(g2.id, 'project', 'proj-1');

      const g1Links = goalRepo.getLinks(g1.id);
      expect(g1Links.length).toBe(2);
      expect(g1Links.map((l) => l.resource_id)).toContain('task-1');
      expect(g1Links.map((l) => l.resource_id)).toContain('task-2');

      const allLinks = goalRepo.getAllLinks();
      expect(allLinks.length).toBe(3);

      goalRepo.removeLink(g1.id, 'task-1');
      expect(goalRepo.getLinks(g1.id).length).toBe(1);
      expect(goalRepo.getAllLinks().length).toBe(2);
    });
  });

  describe('Task is_habit persistence', () => {
    it('persists and updates task is_habit flag', () => {
      const task = taskRepo.create({
        title: 'Morning Yoga',
        is_habit: 1,
      });
      expect(task.is_habit).toBe(1);

      const fetched = taskRepo.getById(task.id);
      expect(fetched?.is_habit).toBe(1);

      const updated = taskRepo.update(task.id, { is_habit: 0 });
      expect(updated.is_habit).toBe(0);

      const refetched = taskRepo.getById(task.id);
      expect(refetched?.is_habit).toBe(0);
    });
  });

  describe('ReminderService Morning Summary', () => {
    it('dispatches morning summary notification for today tasks', () => {
      const today = new Date().toISOString().split('T')[0];

      taskRepo.create({
        title: 'Review PRs',
        due_date: today,
        due_time: '10:00',
        all_day: 0,
      });
      taskRepo.create({
        title: 'Client Demo',
        due_date: today,
        due_time: '14:00',
        all_day: 0,
      });

      const count = reminderService.sendMorningSummary(today);
      expect(count).toBe(2);

      const notifs = notifRepo.getAll();
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs[0].title).toContain('Morning Agenda');
      expect(notifs[0].body).toContain('Review PRs');
    });

    it('returns 0 when no tasks are scheduled for today', () => {
      const tomorrow = '2099-01-01';
      const count = reminderService.sendMorningSummary(tomorrow);
      expect(count).toBe(0);
    });
  });

  describe('Load Balancing and Goal Progress Calculation Logic', () => {
    it('evaluates load balancing bands accurately', () => {
      const getLoadBand = (count: number) => {
        if (count < 5) return 'green';
        if (count <= 10) return 'amber';
        return 'red';
      };

      expect(getLoadBand(0)).toBe('green');
      expect(getLoadBand(4)).toBe('green');
      expect(getLoadBand(5)).toBe('amber');
      expect(getLoadBand(10)).toBe('amber');
      expect(getLoadBand(11)).toBe('red');
      expect(getLoadBand(25)).toBe('red');
    });

    it('calculates goal progress percentage accurately from linked task states', () => {
      const t1 = taskRepo.create({ title: 'Milestone Step 1' });
      const t2 = taskRepo.create({ title: 'Milestone Step 2' });

      const goal = goalRepo.create({ title: 'Launch Feature', goal_type: 'milestone' });
      goalRepo.addLink(goal.id, 'task', t1.id);
      goalRepo.addLink(goal.id, 'task', t2.id);

      const computeProgress = (gId: string) => {
        const links = goalRepo.getLinks(gId).filter((l) => l.resource_type === 'task');
        if (links.length === 0) return 0;
        let completed = 0;
        for (const l of links) {
          const t = taskRepo.getById(l.resource_id);
          if (t && t.is_completed === 1) completed++;
        }
        return Math.round((completed / links.length) * 100);
      };

      expect(computeProgress(goal.id)).toBe(0);

      // Complete 1 of 2
      taskRepo.update(t1.id, { is_completed: 1 });
      expect(computeProgress(goal.id)).toBe(50);

      // Complete 2 of 2
      taskRepo.update(t2.id, { is_completed: 1 });
      expect(computeProgress(goal.id)).toBe(100);
    });
  });
});
