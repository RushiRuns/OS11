import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '../../components/Button/Button.js';
import { Tooltip } from '../../components/Tooltip/Tooltip.js';
import { useMonthGrid } from '../../hooks/useMonthGrid.js';
import styles from './PlannedMiniCalendar.module.css';

export interface PlannedMiniCalendarProps {
  month: Date;
  dotsByDate: Record<string, number>;
  selectedDate?: string | null;
  onDateClick: (dateISO: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
  onTodayClick?: () => void;
  isDetailOpen?: boolean;
}

export const PlannedMiniCalendar = React.memo(function PlannedMiniCalendar({
  month,
  dotsByDate,
  selectedDate,
  onDateClick,
  onMonthChange,
  onTodayClick,
  isDetailOpen = false,
}: PlannedMiniCalendarProps): React.ReactElement | null {
  const [shouldRender, setShouldRender] = useState(!isDetailOpen);

  useEffect(() => {
    if (isDetailOpen) {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(true);
    }
  }, [isDetailOpen]);

  const { cells, weekdays, focusedDateStr, setFocusedDateStr, handleKeyDown } = useMonthGrid({
    month,
    selectedDate: selectedDate ?? undefined,
    onSelectDate: onDateClick,
    onMonthChange,
  });

  if (!shouldRender) {
    return null;
  }

  const monthLabel = format(month, 'MMMM yyyy');

  return (
    <aside
      className={`${styles.calendarPanel} ${isDetailOpen ? styles.calendarFadeOut : ''}`}
      aria-label="Planned Mini Calendar"
    >
      {/* Header with Navigation Controls */}
      <div className={styles.header}>
        <h3 className={styles.monthTitle}>{monthLabel}</h3>
        <div className={styles.navControls}>
          <Tooltip content="Previous month" shortcut="Alt+Left">
            <Button
              variant="ghost"
              size="sm"
              className={styles.iconBtn}
              onClick={() => onMonthChange(-1)}
              aria-label="Previous month"
            >
              ◀
            </Button>
          </Tooltip>

          {onTodayClick && (
            <Tooltip content="Jump to today" shortcut="T">
              <Button
                variant="ghost"
                size="sm"
                className={styles.todayBtn}
                onClick={onTodayClick}
                aria-label="Jump to today"
              >
                Today
              </Button>
            </Tooltip>
          )}

          <Tooltip content="Next month" shortcut="Alt+Right">
            <Button
              variant="ghost"
              size="sm"
              className={styles.iconBtn}
              onClick={() => onMonthChange(1)}
              aria-label="Next month"
            >
              ▶
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Weekday column labels (Mo - Su) */}
      <div className={styles.weekdaysRow} role="row">
        {weekdays.map(wd => (
          <div key={wd} className={styles.weekdayLabel} role="columnheader">
            {wd}
          </div>
        ))}
      </div>

      {/* 42-day Month Grid */}
      <div
        className={styles.grid}
        role="grid"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Calendar grid for ${monthLabel}`}
      >
        {cells.map(cell => {
          const count = dotsByDate[cell.dateStr] || 0;
          const dotCount = count >= 3 ? 3 : count;
          const isFocused = cell.dateStr === focusedDateStr;

          return (
            <div
              key={cell.dateStr}
              role="gridcell"
              tabIndex={-1}
              aria-selected={cell.isSelected}
              aria-label={`${cell.dateStr}${count > 0 ? `, ${count} tasks` : ''}`}
              className={`${styles.dayCell} ${
                !cell.isCurrentMonth ? styles.otherMonth : ''
              } ${cell.isToday ? styles.todayCell : ''} ${
                cell.isSelected ? styles.selectedCell : ''
              } ${isFocused ? styles.focusedCell : ''}`}
              onClick={() => {
                setFocusedDateStr(cell.dateStr);
                onDateClick(cell.dateStr);
              }}
            >
              <span className={styles.dayNumber}>{cell.dayNumber}</span>

              {/* Density dots below day number */}
              {dotCount > 0 && (
                <div className={styles.dotsRow} aria-hidden="true">
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <span key={i} className={styles.dot} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
});

export default PlannedMiniCalendar;
