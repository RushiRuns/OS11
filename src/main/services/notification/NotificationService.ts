import { Notification } from 'electron';
import { NotificationRepository } from '../../repositories/NotificationRepository.js';
import type { NotificationHistoryItem } from '@shared/types/index.js';

export class NotificationService {
  private repository: NotificationRepository;
  private onTaskActionCallback?: (
    action: 'complete' | 'snooze' | 'snooze_15m' | 'snooze_1h' | 'snooze_tomorrow',
    taskId: string
  ) => void;

  constructor(repository?: NotificationRepository) {
    this.repository = repository ?? new NotificationRepository();
  }

  public setActionCallback(
    callback: (
      action: 'complete' | 'snooze' | 'snooze_15m' | 'snooze_1h' | 'snooze_tomorrow',
      taskId: string
    ) => void
  ): void {
    this.onTaskActionCallback = callback;
  }

  public send(
    type: 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak',
    title: string,
    body: string,
    taskId?: string | null
  ): void {
    // 1. Record to database notification_history
    this.repository.add({
      type,
      title,
      body,
      task_id: taskId ?? null,
    });

    // 2. Dispatch native OS desktop notification via Electron if supported
    try {
      if (typeof Notification !== 'undefined' && Notification.isSupported && Notification.isSupported()) {
        const notif = new Notification({
          title,
          body,
          actions: taskId
            ? [
                { type: 'button', text: 'Complete ✓' },
                { type: 'button', text: 'Snooze 15m' },
                { type: 'button', text: 'Snooze 1h' },
                { type: 'button', text: 'Tomorrow 8am' },
              ]
            : undefined,
        });

        if (taskId && this.onTaskActionCallback) {
          notif.on('action', (_event, index) => {
            if (index === 0) {
              this.onTaskActionCallback?.('complete', taskId);
            } else if (index === 1) {
              this.onTaskActionCallback?.('snooze_15m', taskId);
            } else if (index === 2) {
              this.onTaskActionCallback?.('snooze_1h', taskId);
            } else if (index === 3) {
              this.onTaskActionCallback?.('snooze_tomorrow', taskId);
            }
          });
        }

        notif.show();
      }
    } catch {
      // Notification API might be suppressed or running headless in test runner
    }
  }

  public getAll(): NotificationHistoryItem[] {
    return this.repository.getAll();
  }

  public markRead(id: string): void {
    this.repository.markRead(id);
  }

  public markAllRead(): void {
    this.repository.markAllRead();
  }

  public clear(): void {
    this.repository.clear();
  }
}

export default NotificationService;
