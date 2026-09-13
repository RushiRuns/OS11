import { ReminderRepository } from '../../repositories/ReminderRepository.js';
import { NotificationService } from '../notification/NotificationService.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import type { Reminder, CreateReminderPayload } from '@shared/types/index.js';

export class ReminderService {
  private repository: ReminderRepository;
  private notificationService: NotificationService;
  private taskRepository: TaskRepository;
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    repository?: ReminderRepository,
    notificationService?: NotificationService,
    taskRepository?: TaskRepository
  ) {
    this.repository = repository ?? new ReminderRepository();
    this.notificationService = notificationService ?? new NotificationService();
    this.taskRepository = taskRepository ?? new TaskRepository();
  }

  public getUpcomingAndOverdue(): Reminder[] {
    return this.repository.getUpcomingAndOverdue();
  }

  public create(payload: CreateReminderPayload): Reminder {
    const reminder = this.repository.create(payload);
    this.schedule(reminder);
    return reminder;
  }

  public schedule(reminder: Reminder): void {
    // Clear any existing timer for this reminder
    if (this.activeTimers.has(reminder.id)) {
      clearTimeout(this.activeTimers.get(reminder.id)!);
      this.activeTimers.delete(reminder.id);
    }

    const targetTime = reminder.snoozed_until ?? reminder.remind_at;
    const remindTime = new Date(targetTime).getTime();
    const now = Date.now();
    const delay = remindTime - now;

    if (delay <= 0) {
      // Already overdue or due immediately
      this.trigger(reminder);
      return;
    }

    // Node.js setTimeout max limit is 2147483647 ms (~24.8 days)
    const safeDelay = Math.min(delay, 2147483647);
    const timer = setTimeout(() => {
      this.activeTimers.delete(reminder.id);
      if (delay <= safeDelay) {
        this.trigger(reminder);
      } else {
        // Reschedule remainder
        this.schedule(reminder);
      }
    }, safeDelay);

    this.activeTimers.set(reminder.id, timer);
  }

  private trigger(reminder: Reminder): void {
    this.repository.markTriggered(reminder.id);

    // Fetch task details for rich notification
    let title = 'Task Reminder';
    let body = 'You have a scheduled reminder.';
    try {
      const task = this.taskRepository.getById(reminder.task_id);
      if (task) {
        title = task.title;
        body = task.notes ? task.notes.slice(0, 100) : 'Reminder is due now.';
      }
    } catch {
      // Fallback to generic message
    }

    this.notificationService.send('reminder', title, body, reminder.task_id);
  }

  public processOverdueAtStartup(): void {
    const pending = this.repository.getUpcomingAndOverdue();
    for (const reminder of pending) {
      this.schedule(reminder);
    }
  }

  public rescheduleAfterSleep(): void {
    // Clear all pending in-memory timers
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    // Re-evaluate pending and overdue from database
    this.processOverdueAtStartup();
  }

  public snooze(id: string, until: string): void {
    if (this.activeTimers.has(id)) {
      clearTimeout(this.activeTimers.get(id)!);
      this.activeTimers.delete(id);
    }
    this.repository.snooze(id, until);

    const updated = this.repository.getUpcomingAndOverdue().find((r) => r.id === id);
    if (updated) {
      this.schedule(updated);
    }
  }

  public cancel(id: string): void {
    if (this.activeTimers.has(id)) {
      clearTimeout(this.activeTimers.get(id)!);
      this.activeTimers.delete(id);
    }
    this.repository.markTriggered(id);
  }

  public deleteByTaskId(taskId: string): void {
    const pending = this.repository.getUpcomingAndOverdue().filter((r) => r.task_id === taskId);
    for (const reminder of pending) {
      if (this.activeTimers.has(reminder.id)) {
        clearTimeout(this.activeTimers.get(reminder.id)!);
        this.activeTimers.delete(reminder.id);
      }
    }
    this.repository.deleteByTaskId(taskId);
  }

  public dispose(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }
}

export default ReminderService;
