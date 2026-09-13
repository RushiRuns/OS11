import React, { useState, useEffect, useRef } from 'react';
import * as chrono from 'chrono-node';
import styles from './DatePicker.module.css';

interface DatePickerProps {
  initialDate?: string | null;
  initialTime?: string | null;
  initialAllDay?: boolean;
  position?: { x: number; y: number };
  onSelect: (date: string | null, time: string | null, allDay: boolean) => void;
  onClose: () => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
  initialDate,
  initialTime,
  initialAllDay = true,
  position,
  onSelect,
  onClose,
}: DatePickerProps): React.ReactElement {
  const [nlpInput, setNlpInput] = useState('');
  const [allDay, setAllDay] = useState(initialAllDay);
  const [timeValue, setTimeValue] = useState(initialTime || '09:00:00');

  // Active viewing month/year
  const baseDate = initialDate ? new Date(initialDate + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(baseDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(baseDate.getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(initialDate || null);

  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSelectDate = (dateStr: string | null) => {
    setSelectedDateStr(dateStr);
    onSelect(dateStr, allDay ? null : timeValue, allDay);
    onClose();
  };

  // Quick options
  const handleToday = () => {
    handleSelectDate(formatDateStr(new Date()));
  };

  const handleTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    handleSelectDate(formatDateStr(d));
  };

  const handleNextWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    handleSelectDate(formatDateStr(d));
  };

  const handleNoDate = () => {
    handleSelectDate(null);
  };

  // Natural language input parser
  const handleNlpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNlpInput(val);
    if (!val.trim()) return;

    try {
      const parsed = chrono.parseDate(val);
      if (parsed) {
        const dateStr = formatDateStr(parsed);
        setSelectedDateStr(dateStr);
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    } catch {
      // Ignore parse errors
    }
  };

  const handleNlpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedDateStr) {
        handleSelectDate(selectedDateStr);
      }
    }
  };

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar days calculation
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarDays: Array<{ day: number; isCurrentMonth: boolean; dateStr: string }> = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
    const d = new Date(prevY, prevM, day);
    calendarDays.push({ day, isCurrentMonth: false, dateStr: formatDateStr(d) });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    calendarDays.push({ day: d, isCurrentMonth: true, dateStr: formatDateStr(date) });
  }

  // Next month leading days (fill up to 35 or 42 cells)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const date = new Date(nextY, nextM, d);
    calendarDays.push({ day: d, isCurrentMonth: false, dateStr: formatDateStr(date) });
  }

  const todayStr = formatDateStr(new Date());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const cardStyle: React.CSSProperties = position
    ? {
        top: Math.min(position.y, window.innerHeight - 380),
        left: Math.min(position.x, window.innerWidth - 300),
      }
    : {
        top: '20%',
        left: 'calc(50% - 140px)',
      };

  return (
    <div className={styles.popoverBackdrop} onClick={onClose}>
      <div
        ref={cardRef}
        className={styles.datePickerCard}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose date"
      >
        {/* NLP Input Bar */}
        <div className={styles.nlpInputRow}>
          <span className={styles.nlpIcon}>📅</span>
          <input
            type="text"
            className={styles.nlpInput}
            placeholder="Type 'tomorrow', 'next Friday'..."
            value={nlpInput}
            onChange={handleNlpChange}
            onKeyDown={handleNlpKeyDown}
            autoFocus
          />
        </div>

        {/* Quick Options */}
        <div className={styles.quickOptions}>
          <button type="button" className={styles.quickBtn} onClick={handleToday}>
            Today
          </button>
          <button type="button" className={styles.quickBtn} onClick={handleTomorrow}>
            Tomorrow
          </button>
          <button type="button" className={styles.quickBtn} onClick={handleNextWeek}>
            Next Week
          </button>
          <button type="button" className={styles.quickBtn} onClick={handleNoDate}>
            No Date
          </button>
        </div>

        {/* Month Navigation */}
        <div className={styles.calendarNav}>
          <button type="button" className={styles.navArrow} onClick={prevMonth} aria-label="Previous month">
            ◀
          </button>
          <span className={styles.monthLabel}>
            {monthNames[viewMonth]} {viewYear}
          </span>
          <button type="button" className={styles.navArrow} onClick={nextMonth} aria-label="Next month">
            ▶
          </button>
        </div>

        {/* Weekdays */}
        <div className={styles.weekdayGrid}>
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        {/* Days Grid */}
        <div className={styles.daysGrid}>
          {calendarDays.map((cell) => {
            const isSelected = cell.dateStr === selectedDateStr;
            const isToday = cell.dateStr === todayStr;

            return (
              <button
                key={cell.dateStr}
                type="button"
                className={`${styles.dayCell} ${
                  !cell.isCurrentMonth ? styles.dayCellOtherMonth : ''
                } ${isSelected ? styles.dayCellSelected : ''} ${
                  isToday ? styles.dayCellToday : ''
                }`}
                onClick={() => handleSelectDate(cell.dateStr)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* Time Selector */}
        <div className={styles.timeSection}>
          <label className={styles.timeToggleLabel}>
            <input
              type="checkbox"
              checked={!allDay}
              onChange={(e) => setAllDay(!e.target.checked)}
            />
            <span>Time</span>
          </label>

          {!allDay && (
            <select
              className={styles.timeSelect}
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
            >
              <option value="09:00:00">9:00 AM</option>
              <option value="10:00:00">10:00 AM</option>
              <option value="12:00:00">12:00 PM</option>
              <option value="14:00:00">2:00 PM</option>
              <option value="17:00:00">5:00 PM</option>
              <option value="20:00:00">8:00 PM</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

export default DatePicker;
