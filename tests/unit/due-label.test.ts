import { describe, it, expect } from 'vitest';
import { formatDueLabel } from '../../src/renderer/features/tasks/due-label.js';

describe('formatDueLabel', () => {
  const fixedNow = new Date(2026, 9, 11, 15, 0, 0); // Oct 11, 2026 at 15:00 (3:00 PM)

  it('returns null when dueDate is missing or invalid', () => {
    expect(formatDueLabel(null, null, 0, fixedNow)).toBeNull();
    expect(formatDueLabel(undefined, undefined, 0, fixedNow)).toBeNull();
    expect(formatDueLabel('', null, 0, fixedNow)).toBeNull();
    expect(formatDueLabel('invalid-date', null, 0, fixedNow)).toBeNull();
  });

  it('formats Today, Tomorrow, and Yesterday without time', () => {
    const today = formatDueLabel('2026-10-11', null, 0, fixedNow);
    expect(today).toEqual({ label: 'Today', isOverdue: false });

    const tomorrow = formatDueLabel('2026-10-12', null, 0, fixedNow);
    expect(tomorrow).toEqual({ label: 'Tomorrow', isOverdue: false });

    const yesterday = formatDueLabel('2026-10-10', null, 0, fixedNow);
    expect(yesterday).toEqual({ label: 'Yesterday', isOverdue: true });
  });

  it('formats dates in current year as "d MMM"', () => {
    const result = formatDueLabel('2026-10-09', null, 0, fixedNow);
    expect(result).toEqual({ label: '9 Oct', isOverdue: true });

    const future = formatDueLabel('2026-11-05', null, 0, fixedNow);
    expect(future).toEqual({ label: '5 Nov', isOverdue: false });
  });

  it('formats dates in other years as "d MMM yyyy"', () => {
    const nextYear = formatDueLabel('2027-10-09', null, 0, fixedNow);
    expect(nextYear).toEqual({ label: '9 Oct 2027', isOverdue: false });

    const pastYear = formatDueLabel('2025-05-20', null, 0, fixedNow);
    expect(pastYear).toEqual({ label: '20 May 2025', isOverdue: true });
  });

  it('formats time with 12-hour AM/PM format when provided', () => {
    const afternoon = formatDueLabel('2026-10-11', '17:00', 0, fixedNow);
    expect(afternoon).toEqual({ label: 'Today, 5:00 PM', isOverdue: false });

    const morning = formatDueLabel('2026-10-12', '09:30', 0, fixedNow);
    expect(morning).toEqual({ label: 'Tomorrow, 9:30 AM', isOverdue: false });

    const midnight = formatDueLabel('2026-10-13', '00:00', 0, fixedNow);
    expect(midnight).toEqual({ label: '13 Oct, 12:00 AM', isOverdue: false });

    const noon = formatDueLabel('2026-10-13', '12:00', 0, fixedNow);
    expect(noon).toEqual({ label: '13 Oct, 12:00 PM', isOverdue: false });
  });

  it('evaluates overdue correctly with time on the same day', () => {
    // fixedNow is 15:00 (3:00 PM)
    const earlier = formatDueLabel('2026-10-11', '14:00', 0, fixedNow);
    expect(earlier).toEqual({ label: 'Today, 2:00 PM', isOverdue: true });

    const later = formatDueLabel('2026-10-11', '16:00', 0, fixedNow);
    expect(later).toEqual({ label: 'Today, 4:00 PM', isOverdue: false });
  });

  it('ignores time when allDay is 1', () => {
    const allDayTask = formatDueLabel('2026-10-11', '14:00', 1, fixedNow);
    expect(allDayTask).toEqual({ label: 'Today', isOverdue: false });
  });

  it('handles embedded ISO time when dueTime is not explicitly given', () => {
    const isoTask = formatDueLabel('2026-10-11T17:00:00', null, 0, fixedNow);
    expect(isoTask).toEqual({ label: 'Today, 5:00 PM', isOverdue: false });
  });

  it('handles leap years correctly', () => {
    const leapNow = new Date(2028, 1, 28, 12, 0, 0); // Feb 28, 2028
    const leapDay = formatDueLabel('2028-02-29', null, 0, leapNow);
    expect(leapDay).toEqual({ label: 'Tomorrow', isOverdue: false });
  });
});
