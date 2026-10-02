import { useMemo, useState, useCallback, useEffect } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { toISODateOnly } from '@shared/utils/date.js';

export interface MonthGridCell {
  date: Date;
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface UseMonthGridOptions {
  month: Date;
  selectedDate?: string | null;
  todayDateStr?: string;
  onSelectDate: (dateISO: string) => void;
  onMonthChange: (direction: -1 | 1) => void;
}

export const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

export function buildMonthGridCells(
  month: Date,
  selectedDateStr: string | null | undefined,
  todayDateStr: string = toISODateOnly(new Date())
): MonthGridCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  // First day of target month
  const firstDay = new Date(year, monthIndex, 1);
  // Last day of target month
  const lastDay = new Date(year, monthIndex + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Days in previous month
  const prevLastDay = new Date(year, monthIndex, 0);
  const prevMonthDays = prevLastDay.getDate();

  // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const cells: MonthGridCell[] = [];

  // 1. Previous month trailing days
  for (let i = startWeekday - 1; i >= 0; i--) {
    const dayNumber = prevMonthDays - i;
    const d = new Date(year, monthIndex - 1, dayNumber);
    const dateStr = format(d, 'yyyy-MM-dd');
    cells.push({
      date: d,
      dateStr,
      dayNumber,
      isCurrentMonth: false,
      isToday: dateStr === todayDateStr,
      isSelected: dateStr === selectedDateStr,
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    cells.push({
      date,
      dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayDateStr,
      isSelected: dateStr === selectedDateStr,
    });
  }

  // 3. Next month leading days (fill strictly up to 42 cells = 6 weeks x 7 days)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, monthIndex + 1, d);
    const dateStr = format(date, 'yyyy-MM-dd');
    cells.push({
      date,
      dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayDateStr,
      isSelected: dateStr === selectedDateStr,
    });
  }

  return cells;
}

export function useMonthGrid({
  month,
  selectedDate,
  todayDateStr,
  onSelectDate,
  onMonthChange,
}: UseMonthGridOptions) {
  const currentTodayStr = todayDateStr ?? toISODateOnly(new Date());

  const cells = useMemo(() => {
    return buildMonthGridCells(month, selectedDate, currentTodayStr);
  }, [month, selectedDate, currentTodayStr]);

  // Focused cell for keyboard navigation (defaults to selectedDate or today or first day of month)
  const [focusedDateStr, setFocusedDateStr] = useState<string>(() => {
    if (selectedDate) return selectedDate;
    const todayInMonth = cells.find(c => c.isToday && c.isCurrentMonth);
    if (todayInMonth) return todayInMonth.dateStr;
    const firstCurrent = cells.find(c => c.isCurrentMonth);
    return firstCurrent ? firstCurrent.dateStr : (cells[0]?.dateStr ?? currentTodayStr);
  });

  // Keep focused date synced when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      setFocusedDateStr(selectedDate);
    }
  }, [selectedDate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let deltaDays = 0;
      if (e.key === 'ArrowLeft') deltaDays = -1;
      else if (e.key === 'ArrowRight') deltaDays = 1;
      else if (e.key === 'ArrowUp') deltaDays = -7;
      else if (e.key === 'ArrowDown') deltaDays = 7;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectDate(focusedDateStr);
        return;
      } else {
        return;
      }

      e.preventDefault();
      const current = parseISO(focusedDateStr);
      const nextDate =
        deltaDays > 0 ? addDays(current, deltaDays) : subDays(current, Math.abs(deltaDays));
      const nextDateStr = format(nextDate, 'yyyy-MM-dd');

      // Check if moving out of current month view
      if (
        nextDate.getMonth() !== month.getMonth() ||
        nextDate.getFullYear() !== month.getFullYear()
      ) {
        const direction = nextDate > month ? 1 : -1;
        onMonthChange(direction);
      }

      setFocusedDateStr(nextDateStr);
    },
    [focusedDateStr, month, onMonthChange, onSelectDate]
  );

  return {
    cells,
    weekdays: WEEKDAYS_SHORT,
    focusedDateStr,
    setFocusedDateStr,
    handleKeyDown,
  };
}

export default useMonthGrid;
