import { PomodoroRepository } from '../../repositories/PomodoroRepository.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import { NotificationService } from '../notification/NotificationService.js';
import { updateTrayPomodoroState } from '../../tray/tray.js';
import { showTimerWindow, hideTimerWindow, getTimerWindow } from '../../window/timer-window.js';
import type {
  PomodoroSession,
  CreatePomodoroPayload,
  PomodoroStats,
  ActivePomodoroSession,
} from '@shared/types/index.js';

export class PomodoroService {
  private pomodoroRepo: PomodoroRepository;
  private taskRepo: TaskRepository;
  private notifService: NotificationService;
  private currentActiveSession: ActivePomodoroSession | null = null;

  constructor(
    pomodoroRepo?: PomodoroRepository,
    taskRepo?: TaskRepository,
    notifService?: NotificationService
  ) {
    this.pomodoroRepo = pomodoroRepo ?? new PomodoroRepository();
    this.taskRepo = taskRepo ?? new TaskRepository();
    this.notifService = notifService ?? new NotificationService();
  }

  public startSession(payload: CreatePomodoroPayload): PomodoroSession {
    const session = this.pomodoroRepo.create(payload);

    // If distraction blocker is enabled for work session, notify user
    if (payload.type === 'work') {
      try {
        this.notifService.send(
          'pomodoro',
          'Focus Mode Activated 🍅',
          'Do Not Disturb enabled. Enjoy your deep work session.',
          payload.task_id
        );
      } catch {
        // Notification is non-blocking
      }
    }

    return session;
  }

  public completeSession(id: string, endedAt?: string): void {
    this.pomodoroRepo.complete(id, endedAt);

    // Fetch the session details to inspect task_id and type
    try {
      // If task was associated, increment task pomodoro count
      if (this.currentActiveSession && this.currentActiveSession.id === id) {
        if (this.currentActiveSession.taskId && this.currentActiveSession.type === 'work') {
          this.taskRepo.incrementPomodoro(this.currentActiveSession.taskId);
        }
      }
    } catch {
      // Non-blocking task update
    }

    try {
      this.notifService.send(
        'pomodoro',
        'Interval Completed! 🍅',
        'Great focus! Take a moment to relax and recharge.'
      );
    } catch {
      // Non-blocking
    }
  }

  public getTodayStats(): PomodoroStats {
    const today = new Date().toISOString().split('T')[0];
    return this.pomodoroRepo.getStats(today, today);
  }

  public getByTaskId(taskId: string): PomodoroSession[] {
    return this.pomodoroRepo.getByTaskId(taskId);
  }

  public syncState(payload: {
    activeSession: ActivePomodoroSession | null;
    timeText: string | null;
    progress?: number;
  }): void {
    this.currentActiveSession = payload.activeSession;

    // Update tray badge, tooltip, and context menu
    const isPaused = payload.activeSession?.isPaused ?? false;
    updateTrayPomodoroState(payload.timeText, isPaused, payload.progress);

    // Update mini timer window if it exists
    const timerWin = getTimerWindow();
    if (timerWin && !timerWin.isDestroyed()) {
      timerWin.webContents.send('pomodoro:state-update', payload);
    }
  }

  public showMiniWindow(): void {
    showTimerWindow();
  }

  public hideMiniWindow(): void {
    hideTimerWindow();
  }
}

export default PomodoroService;
