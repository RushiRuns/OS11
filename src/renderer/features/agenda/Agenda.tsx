import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { IPC } from '../../../shared/ipc-channels.js';
import type { CalendarEvent, CalendarStatus, Task } from '../../../shared/types/index.js';
import { invoke } from '../../services/ipc.js';
import styles from './Agenda.module.css';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 AM to 9:00 PM (21:00)

export function Agenda(): React.ReactElement {
  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [syncedTaskIds, setSyncedTaskIds] = useState<Set<string>>(new Set());

  const tasksById = useTaskStore((state) => state.tasksById);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);
  const isCalendarEnabled = useModuleStore((state) => state.isEnabled('calendar_integration'));

  // Load calendar status & events when enabled
  const loadCalendarData = useCallback(async () => {
    if (!isCalendarEnabled) {
      setCalendarEvents([]);
      setCalendarStatus(null);
      return;
    }

    try {
      const status = await invoke<CalendarStatus>(IPC.CALENDAR.GET_STATUS);
      if (status) setCalendarStatus(status);

      const events = await invoke<CalendarEvent[]>(IPC.CALENDAR.GET_EVENTS, {
        from: `${activeDate}T00:00:00.000Z`,
        to: `${activeDate}T23:59:59.999Z`,
      });

      if (Array.isArray(events)) {
        setCalendarEvents(events);
        const mapped = new Set<string>();
        for (const ev of events) {
          if (ev.task_id) mapped.add(ev.task_id);
        }
        setSyncedTaskIds(mapped);
      }
    } catch {
      // Calendar data load is non-blocking
    }
  }, [activeDate, isCalendarEnabled]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Filter tasks scheduled for activeDate
  const scheduledTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (task) => task.due_date === activeDate && task.is_trashed === 0
    );
  }, [tasksById, activeDate]);

  // Group events and tasks by hour
  const itemsByHour = useMemo(() => {
    const map: Record<number, Array<{ type: 'task'; data: Task } | { type: 'event'; data: CalendarEvent }>> = {};
    for (const h of HOURS) {
      map[h] = [];
    }

    // Place tasks
    for (const task of scheduledTasks) {
      let hour = 9; // Default 9:00 AM
      if (task.due_time) {
        const parsed = parseInt(task.due_time.split(':')[0], 10);
        if (!isNaN(parsed)) hour = parsed;
      }
      if (map[hour]) {
        map[hour].push({ type: 'task', data: task });
      } else if (hour < 8 && map[8]) {
        map[8].push({ type: 'task', data: task });
      } else if (hour > 21 && map[21]) {
        map[21].push({ type: 'task', data: task });
      }
    }

    // Place external calendar events
    for (const event of calendarEvents) {
      if (event.task_id) continue; // Avoid duplicate display with task
      try {
        const d = new Date(event.start_time);
        const hour = d.getHours();
        if (map[hour]) {
          map[hour].push({ type: 'event', data: event });
        } else if (hour < 8 && map[8]) {
          map[8].push({ type: 'event', data: event });
        } else if (hour > 21 && map[21]) {
          map[21].push({ type: 'event', data: event });
        }
      } catch {
        // Skip invalid date
      }
    }

    return map;
  }, [scheduledTasks, calendarEvents]);

  const handleSyncTask = async (taskId: string) => {
    try {
      await invoke(IPC.CALENDAR.SYNC_TASK, { taskId, provider: 'google' });
      setSyncedTaskIds((prev) => new Set(prev).add(taskId));
      await loadCalendarData();
    } catch {
      // Sync failed
    }
  };

  const handleDateChange = (days: number) => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() + days);
    setActiveDate(d.toISOString().split('T')[0]);
  };

  const isToday = activeDate === new Date().toISOString().split('T')[0];

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(activeDate + 'T12:00:00');
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return activeDate;
    }
  }, [activeDate]);

  const totalItems = scheduledTasks.length + calendarEvents.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Agenda & Timeline</h1>
          <p className={styles.subtitle}>
            Daily chronological schedule of deadlines, tasks, and external calendar events
          </p>
        </div>

        {/* Date Navigation */}
        <div className={styles.dateNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleDateChange(-1)}
            aria-label="Previous day"
          >
            ←
          </button>
          <span className={styles.currentDateLabel}>{formattedDate}</span>
          {isToday && <span className={styles.todayBadge}>Today</span>}
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleDateChange(1)}
            aria-label="Next day"
          >
            →
          </button>
          {!isToday && (
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setActiveDate(new Date().toISOString().split('T')[0])}
            >
              Go to Today
            </button>
          )}
        </div>
      </header>

      {/* Calendar Integration Bar */}
      {isCalendarEnabled && (
        <div className={styles.syncStatusBar}>
          <span className={styles.syncBadge}>
            <span className={styles.syncDot} />
            External Calendar Sync Active
            {calendarStatus && calendarStatus.connectedProviders.length > 0 && (
              <span>({calendarStatus.connectedProviders.join(', ')})</span>
            )}
          </span>
          <span>Showing calendar events alongside local tasks</span>
        </div>
      )}

      {totalItems === 0 ? (
        <EmptyState
          icon="📆"
          title="Schedule Clear"
          description={`No tasks or calendar events scheduled for ${formattedDate}. Add due dates to tasks to plot them on your timeline.`}
        />
      ) : (
        <div className={styles.timeline}>
          {HOURS.map((hour) => {
            const items = itemsByHour[hour] || [];
            const displayTime = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

            return (
              <div key={hour} className={styles.hourRow}>
                <span className={styles.hourLabel}>{displayTime}</span>

                <div className={styles.hourContent}>
                  {items.map((item, idx) => {
                    if (item.type === 'task') {
                      const task = item.data;
                      const isSynced = syncedTaskIds.has(task.id);

                      return (
                        <div key={`task-${task.id}-${idx}`} className={`${styles.itemCard} ${styles.itemCardTask}`}>
                          <div className={styles.itemLeft}>
                            <Checkbox
                              checked={task.is_completed === 1}
                              onChange={() => toggleComplete(task.id)}
                            />
                            <div className={styles.itemDetails}>
                              <span
                                className={styles.itemTitle}
                                style={{
                                  textDecoration: task.is_completed === 1 ? 'line-through' : 'none',
                                  color: task.is_completed === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                }}
                              >
                                {task.title}
                              </span>
                              <div className={styles.itemMeta}>
                                <span>🕒 {task.due_time || 'All Day'}</span>
                                {task.estimated_minutes && <span>• {task.estimated_minutes} min</span>}
                                {task.recurrence_rule && <span>• 🔁 Repeating</span>}
                              </div>
                            </div>
                          </div>

                          {isCalendarEnabled && (
                            <div>
                              {isSynced ? (
                                <span className={styles.syncedBadge}>✓ Synced to Calendar</span>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.syncBtn}
                                  onClick={() => handleSyncTask(task.id)}
                                >
                                  + Sync to Calendar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      const event = item.data as CalendarEvent;
                      return (
                        <div
                          key={`event-${event.id}-${idx}`}
                          className={`${styles.itemCard} ${styles.itemCardEvent}`}
                          style={{ borderLeftColor: event.calendar_color || 'var(--accent-primary)' }}
                        >
                          <div className={styles.itemLeft}>
                            <span className={styles.itemIcon}>📅</span>
                            <div className={styles.itemDetails}>
                              <span className={styles.itemTitle}>{event.title}</span>
                              <div className={styles.itemMeta}>
                                <span
                                  className={styles.providerTag}
                                  style={{
                                    backgroundColor: 'var(--surface-base)',
                                    color: event.calendar_color || 'var(--accent-primary)',
                                  }}
                                >
                                  {event.provider}
                                </span>
                                {event.calendar_name && <span>{event.calendar_name}</span>}
                                {event.location && <span>• 📍 {event.location}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Agenda;
