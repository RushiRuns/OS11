import React, { useState, useRef, useMemo, useCallback } from 'react';
import type { Project, Milestone, Task } from '@shared/types/index.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './ProjectTimelineView.module.css';

type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

interface ProjectTimelineViewProps {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
}

export function ProjectTimelineView({
  tasks,
  milestones,
  onSelectTask,
  selectedTaskId,
}: ProjectTimelineViewProps): React.ReactElement {
  const { updateTask } = useTaskStore();
  const { toggleMilestone, dependenciesByTaskId } = useProjectStore();

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragOrigDateRef = useRef<string | null>(null);

  // Determine timeline date bounds
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { startDate, totalDays, dayWidth } = useMemo(() => {
    let minTime = new Date().getTime() - 7 * 86400000;
    let maxTime = new Date().getTime() + 60 * 86400000;

    for (const t of tasks) {
      if (t.due_date) {
        const time = new Date(t.due_date).getTime();
        if (time < minTime) minTime = time - 3 * 86400000;
        if (time > maxTime) maxTime = time + 14 * 86400000;
      }
    }
    for (const m of milestones) {
      const time = new Date(m.due_date).getTime();
      if (time < minTime) minTime = time - 3 * 86400000;
      if (time > maxTime) maxTime = time + 14 * 86400000;
    }

    const start = new Date(minTime);
    start.setHours(0, 0, 0, 0);

    const end = new Date(maxTime);
    end.setHours(0, 0, 0, 0);

    const diffDays = Math.max(14, Math.ceil((end.getTime() - start.getTime()) / 86400000));

    let width = 36;
    if (zoom === 'day') width = 48;
    else if (zoom === 'week') width = 32;
    else if (zoom === 'month') width = 16;
    else if (zoom === 'quarter') width = 8;

    return {
      startDate: start,
      totalDays: diffDays,
      dayWidth: width,
    };
  }, [tasks, milestones, zoom]);

  // Generate date tick columns
  const dateTicks = useMemo(() => {
    const ticks: { dateStr: string; label: string; isToday: boolean; left: number }[] = [];
    const curr = new Date(startDate);

    for (let i = 0; i < totalDays; i++) {
      const dateStr = curr.toISOString().split('T')[0];
      const isToday = dateStr === today;
      let label = `${curr.getMonth() + 1}/${curr.getDate()}`;

      if (zoom === 'month') {
        if (curr.getDate() === 1) {
          label = curr.toLocaleDateString('default', { month: 'short' });
        } else {
          label = '';
        }
      } else if (zoom === 'quarter') {
        if (curr.getDate() === 1 && curr.getMonth() % 3 === 0) {
          label = `Q${Math.floor(curr.getMonth() / 3) + 1} ${curr.getFullYear()}`;
        } else {
          label = '';
        }
      }

      ticks.push({
        dateStr,
        label,
        isToday,
        left: i * dayWidth,
      });

      curr.setDate(curr.getDate() + 1);
    }
    return ticks;
  }, [startDate, totalDays, dayWidth, today, zoom]);

  const getDayOffset = useCallback(
    (dateStr: string): number => {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);
      return Math.floor((d.getTime() - startDate.getTime()) / 86400000);
    },
    [startDate]
  );

  // Today marker position
  const todayOffset = getDayOffset(today);
  const todayLeft = todayOffset >= 0 ? todayOffset * dayWidth + dayWidth / 2 : null;

  // Task bar calculations
  const taskLayouts = useMemo(() => {
    return tasks.map((task, idx) => {
      const taskDate = task.due_date || today;
      const offsetDays = getDayOffset(taskDate);
      const spanDays = Math.max(1, Math.ceil((task.estimated_minutes || 60) / 480)); // 8h workday
      const left = Math.max(0, offsetDays * dayWidth);
      const width = Math.max(40, spanDays * dayWidth);
      const top = idx * 44;

      return {
        task,
        left,
        width,
        top,
        idx,
      };
    });
  }, [tasks, today, dayWidth, getDayOffset]);

  // Dependency curves
  const dependencyLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const layoutMap = new Map(taskLayouts.map((l) => [l.task.id, l]));

    for (const [targetTaskId, depTaskIds] of Object.entries(dependenciesByTaskId)) {
      const target = layoutMap.get(targetTaskId);
      if (!target) continue;

      for (const depId of depTaskIds) {
        const source = layoutMap.get(depId);
        if (!source) continue;

        // Curve from end of source task to start of target task
        lines.push({
          x1: source.left + source.width,
          y1: source.top + 22,
          x2: target.left,
          y2: target.top + 22,
        });
      }
    }
    return lines;
  }, [taskLayouts, dependenciesByTaskId]);

  // Drag to reschedule handlers
  const handleBarMouseDown = (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setDraggingTaskId(task.id);
    dragStartXRef.current = e.clientX;
    dragOrigDateRef.current = task.due_date || today;

    const handleMouseUp = async (upEvent: MouseEvent) => {
      window.removeEventListener('mouseup', handleMouseUp);
      setDraggingTaskId(null);

      const deltaX = upEvent.clientX - dragStartXRef.current;
      const daysShift = Math.round(deltaX / dayWidth);

      if (daysShift !== 0 && dragOrigDateRef.current) {
        const orig = new Date(dragOrigDateRef.current);
        orig.setDate(orig.getDate() + daysShift);
        const newDueDate = orig.toISOString().split('T')[0];
        await updateTask({ id: task.id, due_date: newDueDate });
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
  };

  const canvasWidth = totalDays * dayWidth;

  return (
    <div className={styles.timelineContainer}>
      {/* Zoom controls toolbar */}
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            Gantt Timeline
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            (Drag task bars horizontally to reschedule due dates)
          </span>
        </div>

        <div className={styles.zoomButtons}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginRight: '4px' }}>
            Zoom:
          </span>
          {(['day', 'week', 'month', 'quarter'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={`${styles.zoomBtn} ${zoom === level ? styles.zoomBtnActive : ''}`}
              onClick={() => setZoom(level)}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Scrollable Canvas */}
      <div className={styles.scrollCanvas}>
        {/* Header with Date Ticks */}
        <div className={styles.headerRow} style={{ width: canvasWidth + 200 }}>
          <div className={styles.leftGutterHeader}>Task</div>
          <div className={styles.dateTicksHeader} style={{ width: canvasWidth }}>
            {dateTicks.map((tick, i) => (
              <div
                key={tick.dateStr + i}
                className={`${styles.dateTick} ${tick.isToday ? styles.dateTickToday : ''}`}
                style={{ width: dayWidth, left: tick.left }}
              >
                {tick.label}
              </div>
            ))}
          </div>
        </div>

        {/* Milestones Row */}
        {milestones.length > 0 && (
          <div className={styles.milestoneRow} style={{ width: canvasWidth + 200 }}>
            <div
              className={styles.leftGutterHeader}
              style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            >
              Milestones (◆)
            </div>
            <div style={{ position: 'relative', width: canvasWidth, height: '100%' }}>
              {milestones.map((m) => {
                const offset = getDayOffset(m.due_date);
                if (offset < 0 || offset >= totalDays) return null;
                const markerLeft = offset * dayWidth + dayWidth / 2;
                const isCompleted = m.is_completed === 1;

                return (
                  <span
                    key={m.id}
                    className={`${styles.milestoneMarker} ${
                      isCompleted ? styles.milestoneMarkerCompleted : ''
                    }`}
                    style={{ left: markerLeft }}
                    onClick={() => toggleMilestone(m.id)}
                    title={`Milestone: ${m.title} (${m.due_date}) — Click to toggle`}
                  >
                    ◆
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Rows & Timeline Body */}
        <div className={styles.chartBody} style={{ width: canvasWidth + 200 }}>
          {/* Left Gutter: Task Names */}
          <div className={styles.leftGutterColumn}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className={styles.taskLabelCell}
                onClick={() => onSelectTask(task)}
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    selectedTaskId === task.id ? 'var(--surface-selected)' : undefined,
                }}
                title={task.title}
              >
                {task.title}
              </div>
            ))}
          </div>

          {/* Grid Area with Bars & Dependency Overlay */}
          <div className={styles.gridArea} style={{ width: canvasWidth }}>
            {/* Vertical Today Line */}
            {todayLeft !== null && <div className={styles.todayLine} style={{ left: todayLeft }} />}

            {/* SVG Dependency Overlay */}
            <svg className={styles.dependencySvgOverlay} style={{ width: canvasWidth, height: tasks.length * 44 }}>
              {dependencyLines.map((line, i) => (
                <path
                  key={i}
                  d={`M ${line.x1} ${line.y1} C ${line.x1 + 20} ${line.y1}, ${line.x2 - 20} ${line.y2}, ${line.x2} ${line.y2}`}
                  className={styles.dependencyArrow}
                />
              ))}
            </svg>

            {/* Task Bar Rows */}
            {taskLayouts.map(({ task, left, width }) => {
              const isDone = task.is_completed === 1;
              const isOverdue = !isDone && task.due_date && task.due_date < today;

              return (
                <div key={task.id} className={styles.taskRow}>
                  <div
                    className={`${styles.taskBar} ${isDone ? styles.taskBarCompleted : ''} ${
                      isOverdue ? styles.taskBarOverdue : ''
                    }`}
                    style={{
                      left,
                      width,
                      opacity: draggingTaskId === task.id ? 0.7 : 1,
                    }}
                    onMouseDown={(e) => handleBarMouseDown(e, task)}
                    onClick={() => onSelectTask(task)}
                    title={`${task.title} (Due: ${task.due_date || 'None'})`}
                  >
                    <span>{task.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectTimelineView;
