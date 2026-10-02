import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { addMonths, subMonths } from 'date-fns';
import type { Task } from '@shared/types/task.js';
import { useTaskStore, usePlanned } from '../../stores/taskStore.js';
import { useToday } from '../../hooks/useToday.js';
import { usePlannedGroups } from '../../hooks/usePlannedGroups.js';
import { useCalendarDots } from '../../hooks/useCalendarDots.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { Toast } from '../../components/Toast/Toast.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
import { PlannedTimeline } from './PlannedTimeline.js';
import { PlannedMiniCalendar } from './PlannedMiniCalendar.js';
import styles from './PlannedView.module.css';

export interface PlannedViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function PlannedView({
  onSelectTask,
  selectedTaskId,
}: PlannedViewProps): React.ReactElement {
  const { loadTasks, tasksById } = useTaskStore();
  const plannedTasks = usePlanned();
  const todayStr = useToday();

  // Local-only view state: resets when Planned view opens
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState<{ dateISO: string; timestamp: number } | null>(
    null
  );

  // Undo/Redo toast support
  const { lastToastAction, undo, clearToast } = useUndoRedo();

  // Derived state: DetailPanel is open when a task is selected
  const isDetailOpen = Boolean(selectedTaskId);

  // Load initial tasks for smart_planned
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Chronological grouping
  const groups = usePlannedGroups(plannedTasks, todayStr);

  // Month grid task dots
  const dotsByDate = useCalendarDots(plannedTasks, visibleMonth);

  // Total incomplete dated task count
  const totalPlannedCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.taskIds.length, 0);
  }, [groups]);

  // Calendar date click handler
  const handleDateClick = useCallback((dateISO: string) => {
    setSelectedDate(dateISO);
    setScrollRequest({ dateISO, timestamp: Date.now() });
  }, []);

  // Calendar month change handler
  const handleMonthChange = useCallback((direction: -1 | 1) => {
    setVisibleMonth(prev => (direction === 1 ? addMonths(prev, 1) : subMonths(prev, 1)));
  }, []);

  // Calendar Today button click handler
  const handleTodayClick = useCallback(() => {
    setVisibleMonth(new Date());
    setSelectedDate(todayStr);
    setScrollRequest({ dateISO: todayStr, timestamp: Date.now() });
  }, [todayStr]);

  return (
    <div className={styles.container}>
      {/* Top Header Row */}
      <header className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h2 className={styles.title}>Planned</h2>
          <span className={styles.countBadge} aria-label={`${totalPlannedCount} tasks`}>
            {totalPlannedCount}
          </span>
        </div>
      </header>

      {/* Main Two-Panel Content Area */}
      <div className={styles.contentSplit}>
        {/* Left Column: Grouped Timeline & QuickAdd */}
        <div className={styles.leftCol}>
          <PlannedTimeline
            groups={groups}
            tasksById={tasksById}
            onSelectTask={onSelectTask}
            selectedTaskId={selectedTaskId}
            targetScrollRequest={scrollRequest}
          />

          <div className={styles.quickAddRow}>
            <QuickAddBar
              placeholder="Add a planned task..."
              defaultDueDate={selectedDate ?? todayStr}
            />
          </div>
        </div>

        {/* Right Column: Mini Calendar (fades out when detail panel is open) */}
        <PlannedMiniCalendar
          month={visibleMonth}
          dotsByDate={dotsByDate}
          selectedDate={selectedDate}
          onDateClick={handleDateClick}
          onMonthChange={handleMonthChange}
          onTodayClick={handleTodayClick}
          isDetailOpen={isDetailOpen}
        />
      </div>

      {/* Undo Toast */}
      {lastToastAction && (
        <Toast
          id="planned-undo-toast"
          message={lastToastAction.description}
          variant="undo"
          actionLabel="Undo"
          onAction={async () => {
            await undo();
          }}
          onDismiss={clearToast}
        />
      )}
    </div>
  );
}

export default PlannedView;
