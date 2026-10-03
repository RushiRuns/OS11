import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  isBefore,
  startOfDay,
  parseISO,
  isValid,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
} from 'date-fns';

export function toISODate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function toISODateOnly(date: Date | string = new Date()): string {
  if (typeof date === 'string') {
    if (date.includes('T') || date.includes('Z')) {
      const parsed = parseISO(date);
      if (isValid(parsed)) {
        return format(parsed, 'yyyy-MM-dd');
      }
      return date.split('T')[0];
    }
    return date;
  }
  return format(date, 'yyyy-MM-dd');
}

export function toISODateTime(date: Date = new Date()): string {
  return date.toISOString();
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = parseISO(toISODateOnly(dateStr));
  return format(addDays(d, days), 'yyyy-MM-dd');
}

export function getStartOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(toISODateOnly(date)) : date;
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function getEndOfWeek(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(toISODateOnly(date)) : date;
  return endOfWeek(d, { weekStartsOn: 1 });
}

export function getNextWeekRange(date: Date | string): { startISO: string; endISO: string } {
  const d = typeof date === 'string' ? parseISO(toISODateOnly(date)) : date;
  const nextWeekStart = startOfWeek(addWeeks(d, 1), { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(d, 1), { weekStartsOn: 1 });
  return {
    startISO: format(nextWeekStart, 'yyyy-MM-dd'),
    endISO: format(nextWeekEnd, 'yyyy-MM-dd'),
  };
}

export function formatMonthLabel(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(toISODateOnly(date)) : date;
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return format(d, 'MMMM');
  }
  return format(d, 'MMMM yyyy');
}

export function formatForDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = parseISO(isoString);
  if (!isValid(date)) return isoString;

  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';

  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, 'EEE, MMM d');
  }
  return format(date, 'MMM d, yyyy');
}

export function formatOverdueLabel(isoString: string): string {
  const date = parseISO(isoString);
  if (!isValid(date)) return `Overdue · ${isoString}`;
  const now = new Date();
  const dateLabel =
    date.getFullYear() === now.getFullYear() ? format(date, 'MMM d') : format(date, 'MMM d, yyyy');
  return `Overdue · ${dateLabel}`;
}

export function isOverdue(dueDateISO: string | null | undefined): boolean {
  if (!dueDateISO) return false;
  const date = parseISO(dueDateISO);
  if (!isValid(date)) return false;

  // If input contains time (contains 'T' or ':'), compare against current timestamp
  if (dueDateISO.includes('T') || dueDateISO.includes(':')) {
    return isBefore(date, new Date());
  }

  // Otherwise, it's a date-only (YYYY-MM-DD), overdue if before start of today
  return isBefore(startOfDay(date), startOfDay(new Date()));
}

export function getEffectiveToday(dayStartsAt?: string, now: Date = new Date()): string {
  if (!dayStartsAt) {
    return toISODateOnly(now);
  }
  const [startH, startM] = dayStartsAt.split(':').map(Number);
  if (isNaN(startH)) {
    return toISODateOnly(now);
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const thresholdMinutes = startH * 60 + (isNaN(startM) ? 0 : startM);

  if (currentMinutes < thresholdMinutes) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return toISODateOnly(yesterday);
  }
  return toISODateOnly(now);
}

