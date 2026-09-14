import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

vi.mock('../../src/main/tray/tray.js', () => ({
  updateTrayPomodoroState: vi.fn(),
  setTrayPomodoroActionCallback: vi.fn(),
}));

vi.mock('../../src/main/window/timer-window.js', () => ({
  showTimerWindow: vi.fn(),
  hideTimerWindow: vi.fn(),
  getTimerWindow: vi.fn().mockReturnValue(null),
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '' },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  Tray: vi.fn(),
  Menu: { buildFromTemplate: vi.fn() },
  nativeImage: { createFromDataURL: vi.fn(), createEmpty: vi.fn() },
}));

import { PomodoroRepository } from '../../src/main/repositories/PomodoroRepository.js';
import { TaskRepository } from '../../src/main/repositories/TaskRepository.js';
import { NotificationRepository } from '../../src/main/repositories/NotificationRepository.js';
import { NotificationService } from '../../src/main/services/notification/NotificationService.js';
import { PomodoroService } from '../../src/main/services/pomodoro/PomodoroService.js';
import { updateTrayPomodoroState } from '../../src/main/tray/tray.js';

describe('Phase 12: Pomodoro & Custom Timer', () => {
  let db: Database.Database;
  let pomodoroRepo: PomodoroRepository;
  let taskRepo: TaskRepository;
  let notifRepo: NotificationRepository;
  let notifService: NotificationService;
  let pomodoroService: PomodoroService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const schemaPath = path.resolve(__dirname, '../../src/main/migrations/0001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    pomodoroRepo = new PomodoroRepository(db);
    taskRepo = new TaskRepository(db);
    notifRepo = new NotificationRepository(db);
    notifService = new NotificationService(notifRepo);
    pomodoroService = new PomodoroService(pomodoroRepo, taskRepo, notifService);
  });

  describe('PomodoroRepository & TaskRepository', () => {
    it('creates and completes a pomodoro session', () => {
      const task = taskRepo.create({ title: 'Important Feature' });
      expect(task.pomodoro_count).toBe(0);

      const session = pomodoroRepo.create({
        task_id: task.id,
        type: 'work',
        duration_seconds: 1500,
      });

      expect(session.id).toBeDefined();
      expect(session.task_id).toBe(task.id);
      expect(session.type).toBe('work');
      expect(session.duration_seconds).toBe(1500);
      expect(session.was_completed).toBe(0);

      const completed = pomodoroRepo.complete(session.id);
      expect(completed.was_completed).toBe(1);
      expect(completed.ended_at).toBeDefined();

      const taskSessions = pomodoroRepo.getByTaskId(task.id);
      expect(taskSessions.length).toBe(1);
      expect(taskSessions[0].id).toBe(session.id);
    });

    it('increments task pomodoro count accurately', () => {
      const task = taskRepo.create({ title: 'Task to Focus' });
      expect(task.pomodoro_count).toBe(0);

      const updated1 = taskRepo.incrementPomodoro(task.id);
      expect(updated1.pomodoro_count).toBe(1);

      const updated2 = taskRepo.incrementPomodoro(task.id);
      expect(updated2.pomodoro_count).toBe(2);

      const fetched = taskRepo.getById(task.id);
      expect(fetched?.pomodoro_count).toBe(2);
    });

    it('aggregates daily statistics accurately', () => {
      const today = new Date().toISOString().split('T')[0];

      // Create 2 completed work sessions
      const s1 = pomodoroRepo.create({ type: 'work', duration_seconds: 1500 });
      pomodoroRepo.complete(s1.id);

      const s2 = pomodoroRepo.create({ type: 'work', duration_seconds: 1500 });
      pomodoroRepo.complete(s2.id);

      // Create 1 incomplete session
      pomodoroRepo.create({ type: 'short_break', duration_seconds: 300 });

      const stats = pomodoroRepo.getStats(today, today);
      expect(stats.totalSessions).toBe(2);
      expect(stats.completed_count).toBe(2);
      expect(stats.total_seconds).toBe(3000);
      expect(stats.totalMinutes).toBe(50);
    });
  });

  describe('PomodoroService Orchestration', () => {
    it('starts a work session and creates a distraction notification', () => {
      const task = taskRepo.create({ title: 'Deep Work Task' });

      const session = pomodoroService.startSession({
        task_id: task.id,
        type: 'work',
        duration_seconds: 1500,
      });

      expect(session.id).toBeDefined();
      expect(session.task_id).toBe(task.id);

      // Check notification created
      const notifs = notifRepo.getAll();
      expect(notifs.some((n) => n.title.includes('Focus Mode Activated'))).toBe(true);
    });

    it('completes an active work session, increments task pomodoro count, and notifies', () => {
      const task = taskRepo.create({ title: 'Phase 12 Delivery' });
      expect(task.pomodoro_count).toBe(0);

      const session = pomodoroService.startSession({
        task_id: task.id,
        type: 'work',
        duration_seconds: 1500,
      });

      // Synchronize active session state
      pomodoroService.syncState({
        activeSession: {
          id: session.id,
          taskId: task.id,
          type: 'work',
          durationSeconds: 1500,
          elapsedSeconds: 1500,
          isPaused: false,
        },
        timeText: '00:00',
        progress: 1,
      });

      pomodoroService.completeSession(session.id);

      // Task pomodoro_count should have been incremented
      const updatedTask = taskRepo.getById(task.id);
      expect(updatedTask?.pomodoro_count).toBe(1);

      // Completion notification sent
      const notifs = notifRepo.getAll();
      expect(notifs.some((n) => n.title.includes('Interval Completed'))).toBe(true);
    });

    it('syncs state to tray', () => {
      pomodoroService.syncState({
        activeSession: null,
        timeText: '25:00',
        progress: 0,
      });

      expect(updateTrayPomodoroState).toHaveBeenCalledWith('25:00', false, 0);
    });

    it('returns today statistics via service', () => {
      const s = pomodoroService.startSession({ type: 'work', duration_seconds: 1200 });
      pomodoroService.completeSession(s.id);

      const stats = pomodoroService.getTodayStats();
      expect(stats.completed_count).toBeGreaterThanOrEqual(1);
      expect(stats.total_seconds).toBeGreaterThanOrEqual(1200);
    });
  });
});
