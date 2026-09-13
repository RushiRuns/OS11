import { describe, it, expect } from 'vitest';
import {
  isValidRRule,
  nextOccurrence,
  humanReadableRRule,
  expandOccurrences,
} from '../../src/main/domain/recurrence.js';

describe('Domain: Recurrence (RRULE)', () => {
  it('should validate valid RRULE strings', () => {
    expect(isValidRRule('RRULE:FREQ=DAILY')).toBe(true);
    expect(isValidRRule('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(true);
    expect(isValidRRule('RRULE:FREQ=MONTHLY;INTERVAL=2')).toBe(true);
  });

  it('should reject invalid RRULE strings', () => {
    expect(isValidRRule('')).toBe(false);
    expect(isValidRRule('NOT_AN_RRULE')).toBe(false);
    expect(isValidRRule('FREQ=INVALID_FREQUENCY')).toBe(false);
  });

  it('should calculate next occurrence', () => {
    const fromDate = new Date('2026-01-01T10:00:00Z');
    const next = nextOccurrence('RRULE:FREQ=DAILY', fromDate);
    expect(next).not.toBeNull();
    expect(next?.toISOString().startsWith('2026-01-02')).toBe(true);
  });

  it('should generate human-readable text', () => {
    const text = humanReadableRRule('RRULE:FREQ=DAILY');
    expect(text.toLowerCase()).toContain('every day');
  });

  it('should expand occurrences within a date range', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-07T23:59:59Z');
    const dates = expandOccurrences('RRULE:FREQ=DAILY', from, to);
    expect(dates.length).toBe(7);
  });
});
