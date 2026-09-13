import { format, isToday, isTomorrow, isYesterday, isBefore, startOfDay, parseISO, isValid } from 'date-fns';

export function toISODate(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function toISODateTime(date: Date = new Date()): string {
  return date.toISOString();
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
