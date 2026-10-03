import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { IPC } from '../../../shared/ipc-channels.js';
import type { CalendarEvent, Task } from '../../../shared/types/index.js';
import { invoke } from '../../services/ipc.js';
import styles from './DailyAgenda.module.css';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 AM to 9:00 PM

export function DailyAgenda(): React.ReactElement {
  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const tasksById = useTaskStore((state) => state.tasksById);
  const updateTask = useTaskStore((state) => state.updateTask);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);
  const isCalendarEnabled = useModuleStore((state) => state.isEnabled('calendar_integration'));

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isToday = activeDate === todayStr;

  // Load calendar events if integration is enabled
  const loadCalendarEvents = useCallback(async () => {
    if (!isCalendarEnabled) {
      setCalendarEvents([]);
      return;
    }
    try {
      const events = await invoke<CalendarEvent[]>(IPC.CALENDAR.GET_EVENTS, {
        from: `${activeDate}T00:00:00.000Z`,
        to: `${activeDate}T23:59:59.999Z`,
      });
      if (Array.isArray(events)) {
        setCalendarEvents(events);
      }
    } catch {
      // Non-blocking
    }
  }, [activeDate, isCalendarEnabled]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Tasks due on activeDate
  const scheduledTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => t.due_date === activeDate && t.is_trashed === 0)
      .sort((a, b) => (a.due_time || '23:59').localeCompare(b.due_time || '23:59'));
  }, [tasksById, activeDate]);

  // Overdue tasks: due_date < today and not completed
  const overdueTasks = useMemo(() => {
    if (!isToday) return [];
    return Object.values(tasksById)
      .filter((t) => t.due_date && t.due_date < todayStr && t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  }, [tasksById, todayStr, isToday]);

  // Unscheduled tasks (active, non-trashed, no due date)
  const unscheduledTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => !t.due_date && t.is_completed === 0 && t.is_trashed === 0)
      .slice(0, 15);
  }, [tasksById]);

  // Load balancing calculation
  const totalDueCount = scheduledTasks.filter((t) => t.is_completed === 0).length;
  const loadClass =
    totalDueCount < 5
      ? styles.loadGreen
      : totalDueCount <= 10
        ? styles.loadAmber
        : styles.loadRed;

  const loadText =
    totalDueCount < 5
      ? `Light Load (${totalDueCount} tasks)`
      : totalDueCount <= 10
        ? `Moderate Load (${totalDueCount} tasks)`
        : `Heavy Load (${totalDueCount} tasks — consider rescheduling)`;

  // Map items by hour
  const itemsByHour = useMemo(() => {
    const map: Record<number, Array<{ type: 'task'; data: Task } | { type: 'event'; data: CalendarEvent }>> = {};
    for (const h of HOURS) {
      map[h] = [];
    }

    // Place tasks with times
    for (const task of scheduledTasks) {
      let hour = 9; // default fallback if no time
      if (task.due_time) {
        const parsed = parseInt(task.due_time.split(':')[0], 10);
        if (!isNaN(parsed)) hour = parsed;
      }
      if (hour < 8) hour = 8;
      if (hour > 21) hour = 21;
      if (map[hour]) {
        map[hour].push({ type: 'task', data: task });
      }
    }

    // Place calendar events
    for (const event of calendarEvents) {
      if (event.task_id) continue;
      try {
        const d = new Date(event.start_time);
        let hour = d.getHours();
        if (hour < 8) hour = 8;
        if (hour > 21) hour = 21;
        if (map[hour]) {
          map[hour].push({ type: 'event', data: event });
        }
      } catch {
        // Ignore
      }
    }

    return map;
  }, [scheduledTasks, calendarEvents]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleHourDragOver = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverHour(hour);
  };

  const handleHourDragLeave = (hour: number) => {
    if (dragOverHour === hour) {
      setDragOverHour(null);
    }
  };

  const handleHourDrop = async (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId || !tasksById[taskId]) return;

    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    await updateTask({
      id: taskId,
      due_date: activeDate,
      due_time: timeStr,
      all_day: 0,
    });
  };

  const handleRescheduleOverdue = async (taskId: string) => {
    await updateTask({
      id: taskId,
      due_date: todayStr,
      due_time: '09:00',
    });
  };

  const handleDateChange = (days: number) => {
    const d = new Date(activeDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setActiveDate(d.toISOString().split('T')[0]);
  };

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

  return (
    <div className={styles.container}>
      {/* Top Header & Load Balancing Bar */}
      <div className={styles.topBar}>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleDateChange(-1)}
            aria-label="Previous day"
          >
            ←
          </button>
          <div className={styles.dateDisplay}>
            <span>{formattedDate}</span>
            {isToday && <span className={styles.todayBadge}>Today</span>}
          </div>
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
              onClick={() => setActiveDate(todayStr)}
            >
              Today
            </button>
          )}
        </div>

        {/* Load balancing indicator */}
        <div className={`${styles.loadBalancingPill} ${loadClass}`}>
          <span>⚡</span>
          <span>{loadText}</span>
        </div>
      </div>

      {/* Pinned Overdue Section (when on Today) */}
      {overdueTasks.length > 0 && (
        <div className={styles.overdueSection}>
          <div className={styles.overdueHeader}>
            <span>⚠️ Overdue Tasks ({overdueTasks.length})</span>
          </div>
          <div className={styles.overdueList}>
            {overdueTasks.map((task) => (
              <div key={task.id} className={styles.overdueCard}>
                <div className={styles.overdueLeft}>
                  <Checkbox
                    checked={task.is_completed === 1}
                    onChange={() => toggleComplete(task.id)}
                  />
                  <div>
                    <span className={styles.taskTitle}>{task.title}</span>
                    <div className={styles.taskMeta}>
                      <span className={styles.overdueDateBadge}>Due {task.due_date}</span>
                      {task.due_time && <span>at {task.due_time}</span>}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.actionRescheduleBtn}
                  onClick={() => handleRescheduleOverdue(task.id)}
                  title="Move to Today at 9:00 AM"
                >
                  Reschedule to Today
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Layout: Hourly Timeline + Unscheduled Pool */}
      <div className={styles.agendaLayout}>
        {/* Timeline Column */}
        <div className={styles.timelineColumn}>
          {HOURS.map((hour) => {
            const items = itemsByHour[hour] || [];
            const displayTime = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
            const isDragTarget = dragOverHour === hour;

            return (
              <div
                key={hour}
                className={`${styles.hourRow} ${isDragTarget ? styles.hourRowDragOver : ''}`}
                onDragOver={(e) => handleHourDragOver(e, hour)}
                onDragLeave={() => handleHourDragLeave(hour)}
                onDrop={(e) => handleHourDrop(e, hour)}
              >
                <span className={styles.hourLabel}>{displayTime}</span>
                <div className={styles.hourSlot}>
                  {items.map((item, idx) => {
                    if (item.type === 'task') {
                      const task = item.data;
                      return (
                        <div
                          key={`task-${task.id}-${idx}`}
                          className={`${styles.taskItem} ${task.is_completed === 1 ? styles.taskItemCompleted : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Checkbox
                              checked={task.is_completed === 1}
                              onChange={() => toggleComplete(task.id)}
                            />
                            <span
                              className={styles.taskTitle}
                              style={{
                                textDecoration: task.is_completed === 1 ? 'line-through' : 'none',
                              }}
                            >
                              {task.title}
                            </span>
                          </div>
                          <div className={styles.taskMeta}>
                            {task.due_time && <span>🕒 {task.due_time}</span>}
                            {task.estimated_minutes && <span>• {task.estimated_minutes}m</span>}
                          </div>
                        </div>
                      );
                    } else {
                      const event = item.data as CalendarEvent;
                      return (
                        <div
                          key={`event-${event.id}-${idx}`}
                          className={styles.eventItem}
                          style={{ borderLeftColor: event.calendar_color || 'var(--accent-primary)' }}
                        >
                          <span>📅</span>
                          <span className={styles.taskTitle}>{event.title}</span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unscheduled Tasks Sidebar Pool */}
        <aside className={styles.unscheduledSidebar}>
          <div className={styles.sidebarTitle}>
            <span>📥 Unscheduled Tasks</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              {unscheduledTasks.length}
            </span>
          </div>
          <p className={styles.sidebarDesc}>
            Drag any task into an hourly slot to schedule its time for today.
          </p>
          <div className={styles.unscheduledList}>
            {unscheduledTasks.length === 0 ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                No unscheduled tasks available.
              </span>
            ) : (
              unscheduledTasks.map((t) => (
                <div
                  key={t.id}
                  className={styles.unscheduledCard}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  title="Drag onto an hour slot"
                >
                  <span>{t.title}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DailyAgenda;
