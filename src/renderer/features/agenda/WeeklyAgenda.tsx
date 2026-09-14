import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { IPC } from '../../../shared/ipc-channels.js';
import type { CalendarEvent, Task } from '../../../shared/types/index.js';
import { invoke } from '../../services/ipc.js';
import styles from './WeeklyAgenda.module.css';

function getMondayOfCurrentWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

export function WeeklyAgenda(): React.ReactElement {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfCurrentWeek(new Date()));
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const tasksById = useTaskStore((state) => state.tasksById);
  const updateTask = useTaskStore((state) => state.updateTask);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);
  const isCalendarEnabled = useModuleStore((state) => state.isEnabled('calendar_integration'));

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 7 days of the active week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const dayNumber = d.getDate();
      return { dateStr, dayName, dayNumber, isToday: dateStr === todayStr };
    });
  }, [weekStart, todayStr]);

  const weekRangeLabel = useMemo(() => {
    const first = weekDays[0];
    const last = weekDays[6];
    return `${first.dayName} ${first.dayNumber} - ${last.dayName} ${last.dayNumber}, ${new Date(first.dateStr).getFullYear()}`;
  }, [weekDays]);

  // Load calendar events across the entire 7-day range
  const loadCalendarEvents = useCallback(async () => {
    if (!isCalendarEnabled) {
      setCalendarEvents([]);
      return;
    }
    try {
      const fromStr = `${weekDays[0].dateStr}T00:00:00.000Z`;
      const toStr = `${weekDays[6].dateStr}T23:59:59.999Z`;
      const events = await invoke<CalendarEvent[]>(IPC.CALENDAR.GET_EVENTS, {
        from: fromStr,
        to: toStr,
      });
      if (Array.isArray(events)) {
        setCalendarEvents(events);
      }
    } catch {
      // Non-blocking
    }
  }, [weekDays, isCalendarEnabled]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Group tasks by day
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const d of weekDays) {
      map[d.dateStr] = [];
    }

    for (const task of Object.values(tasksById)) {
      if (task.due_date && map[task.due_date] && task.is_trashed === 0) {
        map[task.due_date].push(task);
      }
    }

    // Sort tasks by due_time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.due_time || '23:59').localeCompare(b.due_time || '23:59'));
    }

    return map;
  }, [tasksById, weekDays]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const d of weekDays) {
      map[d.dateStr] = [];
    }

    for (const ev of calendarEvents) {
      const day = ev.start_time.substring(0, 10);
      if (map[day]) {
        map[day].push(ev);
      }
    }

    return map;
  }, [calendarEvents, weekDays]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDayDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDay(dateStr);
  };

  const handleDayDragLeave = (dateStr: string) => {
    if (dragOverDay === dateStr) {
      setDragOverDay(null);
    }
  };

  const handleDayDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDay(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId || !tasksById[taskId]) return;

    await updateTask({
      id: taskId,
      due_date: dateStr,
    });
  };

  const handleWeekChange = (offsetWeeks: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offsetWeeks * 7);
    setWeekStart(next);
  };

  return (
    <div className={styles.container}>
      {/* Navigation Header */}
      <div className={styles.topBar}>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleWeekChange(-1)}
            aria-label="Previous week"
          >
            ← Previous Week
          </button>
          <span className={styles.weekRangeLabel}>{weekRangeLabel}</span>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => handleWeekChange(1)}
            aria-label="Next week"
          >
            Next Week →
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setWeekStart(getMondayOfCurrentWeek(new Date()))}
          >
            Current Week
          </button>
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className={styles.columnsGrid}>
        {weekDays.map(({ dateStr, dayName, dayNumber, isToday }) => {
          const dayTasks = tasksByDay[dateStr] || [];
          const dayEvents = eventsByDay[dateStr] || [];
          const pendingCount = dayTasks.filter((t) => t.is_completed === 0).length;

          const loadBadgeClass =
            pendingCount < 5
              ? styles.loadGreen
              : pendingCount <= 10
                ? styles.loadAmber
                : styles.loadRed;

          const isDragTarget = dragOverDay === dateStr;

          return (
            <div
              key={dateStr}
              className={`${styles.dayColumn} ${isToday ? styles.dayColumnToday : ''} ${isDragTarget ? styles.dayColumnDragOver : ''}`}
              onDragOver={(e) => handleDayDragOver(e, dateStr)}
              onDragLeave={() => handleDayDragLeave(dateStr)}
              onDrop={(e) => handleDayDrop(e, dateStr)}
            >
              <div className={styles.columnHeader}>
                <div className={styles.dayNameRow}>
                  <span className={styles.dayName}>{dayName}</span>
                  {isToday && <span className={styles.todayTag}>Today</span>}
                </div>
                <span className={styles.dayNumber}>{dayNumber}</span>
                <span className={`${styles.loadBadge} ${loadBadgeClass}`}>
                  {pendingCount} task{pendingCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className={styles.columnBody}>
                {/* External calendar events */}
                {dayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={styles.eventCard}
                    style={{ borderLeftColor: ev.calendar_color || 'var(--accent-primary)' }}
                    title={ev.title}
                  >
                    <span>📅</span>
                    <span className={styles.eventTitle}>{ev.title}</span>
                  </div>
                ))}

                {/* Local tasks */}
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`${styles.taskCard} ${task.is_completed === 1 ? styles.taskCardCompleted : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  >
                    <div className={styles.taskHeader}>
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
                    {task.due_time && (
                      <div className={styles.taskMeta}>
                        <span>🕒 {task.due_time}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyAgenda;
