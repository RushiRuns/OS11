import React, { useState, useMemo } from 'react';
import type { Project, Task } from '@shared/types/index.js';
import { useTaskStore } from '../../stores/taskStore.js';
import styles from './ProjectCalendarView.module.css';

interface ProjectCalendarViewProps {
  project: Project;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ProjectCalendarView({
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectCalendarViewProps): React.ReactElement {
  const { updateTask } = useTaskStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute month cells
  const { year, month, daysInMonth, startWeekday, prevMonthDays } = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    const prevLastDay = new Date(y, m, 0);

    return {
      year: y,
      month: m,
      daysInMonth: lastDay.getDate(),
      startWeekday: firstDay.getDay(),
      prevMonthDays: prevLastDay.getDate(),
    };
  }, [currentDate]);

  // Build grid calendar cells (42 cells: 6 weeks)
  const calendarCells = useMemo(() => {
    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Previous month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill 35 or 42 cells
    const remaining = 35 - cells.length >= 0 ? 35 - cells.length : 42 - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      const dateStr = d.toISOString().split('T')[0];
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [year, month, daysInMonth, startWeekday, prevMonthDays, todayStr]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.due_date) {
        const list = map.get(t.due_date) ?? [];
        list.push(t);
        map.set(t.due_date, list);
      }
    }
    return map;
  }, [tasks]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Drag-and-drop to reschedule
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    await updateTask({
      id: taskId,
      due_date: targetDate,
    });
  };

  const priorityDots = [
    'transparent',
    'var(--priority-low)',
    'var(--priority-medium)',
    'var(--priority-high)',
    'var(--priority-critical)',
  ];

  const monthName = currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  return (
    <div className={styles.calendarContainer}>
      {/* Navigation Header */}
      <div className={styles.calendarNav}>
        <h2 className={styles.monthTitle}>{monthName}</h2>

        <div className={styles.navControls}>
          <button type="button" className={styles.navBtn} onClick={handleToday}>
            Today
          </button>
          <button type="button" className={styles.navBtn} onClick={handlePrevMonth} title="Previous month">
            ◀
          </button>
          <button type="button" className={styles.navBtn} onClick={handleNextMonth} title="Next month">
            ▶
          </button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div className={styles.weekdayHeader}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.weekdayCell}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar 7x6 Grid */}
      <div className={styles.calendarGrid}>
        {calendarCells.map((cell) => {
          const dayTasks = tasksByDate.get(cell.dateStr) ?? [];
          const isDragOver = dragOverDate === cell.dateStr;

          return (
            <div
              key={cell.dateStr}
              className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.dayCellOtherMonth : ''} ${
                cell.isToday ? styles.dayCellToday : ''
              } ${isDragOver ? styles.dayCellDragOver : ''}`}
              onDragOver={(e) => handleDragOver(e, cell.dateStr)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, cell.dateStr)}
            >
              <div className={styles.dayHeader}>
                <span
                  className={`${styles.dayNumber} ${cell.isToday ? styles.dayNumberToday : ''}`}
                >
                  {cell.dayNumber}
                </span>
                {dayTasks.length > 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {dayTasks.length}
                  </span>
                )}
              </div>

              {/* Tasks plotted on this date */}
              <div className={styles.tasksList}>
                {dayTasks.map((task) => {
                  const isDone = task.is_completed === 1;
                  const isSelected = selectedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onSelectTask(task)}
                      className={`${styles.taskPill} ${isDone ? styles.taskPillCompleted : ''}`}
                      style={{
                        borderColor: isSelected ? 'var(--accent)' : undefined,
                        backgroundColor: isSelected ? 'var(--surface-selected)' : undefined,
                      }}
                      title={`${task.title} (Drag to change date)`}
                    >
                      <span
                        className={styles.priorityDot}
                        style={{ backgroundColor: priorityDots[task.priority] ?? 'transparent' }}
                      />
                      <span>{task.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectCalendarView;
