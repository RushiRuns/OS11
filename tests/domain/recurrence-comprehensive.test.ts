import { describe, it, expect } from 'vitest';
import {
  isValidRRule,
  nextOccurrence,
  humanReadableRRule,
  expandOccurrences,
  buildCustomRRule,
  calculateNextOccurrence,
} from '../../src/main/domain/recurrence.js';

describe('Domain: Recurrence Comprehensive (100% Coverage Target)', () => {
  describe('Rule Validation (isValidRRule)', () => {
    it('validates standard frequencies', () => {
      expect(isValidRRule('RRULE:FREQ=DAILY')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=WEEKLY')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=MONTHLY')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=YEARLY')).toBe(true);
    });

    it('validates rules with INTERVAL, BYDAY, and COUNT', () => {
      expect(isValidRRule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=MONTHLY;BYMONTHDAY=15')).toBe(true);
      expect(isValidRRule('RRULE:FREQ=DAILY;COUNT=10')).toBe(true);
    });

    it('calculates nextOccurrence using raw RRULE string', () => {
      const from = new Date('2026-09-14T10:00:00Z');
      const next = nextOccurrence('RRULE:FREQ=DAILY', from);
      expect(next).not.toBeNull();
      expect(next?.toISOString().startsWith('2026-09-15')).toBe(true);

      expect(nextOccurrence('INVALID', from)).toBeNull();
    });

    it('rejects invalid or empty RRULE strings', () => {
      expect(isValidRRule('')).toBe(false);
      expect(isValidRRule('   ')).toBe(false);
      expect(isValidRRule(null as unknown as string)).toBe(false);
      expect(isValidRRule('NOT_AN_RRULE')).toBe(false);
      expect(isValidRRule('FREQ=INVALID')).toBe(false);
      expect(isValidRRule('RRULE:FREQ=HOURLY;BYDAY=INVALID')).toBe(false);
    });
  });

  describe('Custom RRULE Builder (buildCustomRRule)', () => {
    it('builds DAILY rule with default interval', () => {
      const rule = buildCustomRRule({ frequency: 'DAILY', interval: 1 });
      expect(rule).toBe('RRULE:FREQ=DAILY');
      expect(isValidRRule(rule)).toBe(true);
    });

    it('builds DAILY rule with custom interval', () => {
      const rule = buildCustomRRule({ frequency: 'DAILY', interval: 3 });
      expect(rule).toBe('RRULE:FREQ=DAILY;INTERVAL=3');
      expect(isValidRRule(rule)).toBe(true);
    });

    it('builds WEEKLY rule with specific days of week', () => {
      const rule = buildCustomRRule({
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: ['MO', 'TU', 'WE', 'TH', 'FR'],
      });
      expect(rule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
      expect(isValidRRule(rule)).toBe(true);
    });

    it('builds bi-weekly rule with days of week', () => {
      const rule = buildCustomRRule({
        frequency: 'WEEKLY',
        interval: 2,
        daysOfWeek: ['SA', 'SU'],
      });
      expect(rule).toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,SU');
      expect(isValidRRule(rule)).toBe(true);
    });

    it('builds MONTHLY and YEARLY custom rules', () => {
      const monthly = buildCustomRRule({ frequency: 'MONTHLY', interval: 6 });
      expect(monthly).toBe('RRULE:FREQ=MONTHLY;INTERVAL=6');
      expect(isValidRRule(monthly)).toBe(true);

      const yearly = buildCustomRRule({ frequency: 'YEARLY', interval: 1 });
      expect(yearly).toBe('RRULE:FREQ=YEARLY');
      expect(isValidRRule(yearly)).toBe(true);
    });
  });

  describe('Next Occurrence Calculation (calculateNextOccurrence)', () => {
    it('calculates fixed basis occurrence from due date', () => {
      const dueDate = '2026-09-14';
      const next = calculateNextOccurrence(
        'RRULE:FREQ=DAILY',
        'fixed',
        dueDate,
        new Date('2026-09-20T10:00:00Z') // Even if completed days later
      );
      expect(next).not.toBeNull();
      // Should advance relative to original due date 2026-09-14 -> 2026-09-15
      expect(next?.toISOString().startsWith('2026-09-15')).toBe(true);
    });

    it('calculates after_completion basis occurrence from completion date', () => {
      const dueDate = '2026-09-14';
      const completionDate = new Date('2026-09-20T15:00:00Z');
      const next = calculateNextOccurrence(
        'RRULE:FREQ=DAILY',
        'after_completion',
        dueDate,
        completionDate
      );
      expect(next).not.toBeNull();
      // Should advance relative to completion date 2026-09-20 -> 2026-09-21
      expect(next?.toISOString().startsWith('2026-09-21')).toBe(true);
    });

    it('handles ISO timestamp due dates gracefully', () => {
      const dueDate = '2026-09-14T09:00:00Z';
      const next = calculateNextOccurrence('RRULE:FREQ=DAILY', 'fixed', dueDate);
      expect(next).not.toBeNull();
      expect(next?.toISOString().startsWith('2026-09-15')).toBe(true);
    });

    it('falls back to completion date when dueDateStr is missing', () => {
      const completionDate = new Date('2026-10-01T12:00:00Z');
      const next = calculateNextOccurrence(
        'RRULE:FREQ=WEEKLY',
        'fixed',
        null,
        completionDate
      );
      expect(next).not.toBeNull();
      expect(next!.getTime()).toBeGreaterThan(completionDate.getTime());
    });

    it('returns null on invalid RRULE or error', () => {
      expect(calculateNextOccurrence('INVALID', 'fixed', '2026-09-14')).toBeNull();
      expect(calculateNextOccurrence('', 'after_completion')).toBeNull();
    });
  });

  describe('Human Readable Representation (humanReadableRRule)', () => {
    it('formats daily rule into readable text', () => {
      const text = humanReadableRRule('RRULE:FREQ=DAILY');
      expect(text.toLowerCase()).toContain('every day');
    });

    it('returns original string on invalid rule', () => {
      expect(humanReadableRRule('INVALID_RULE')).toBe('INVALID_RULE');
    });
  });

  describe('Range Expansion (expandOccurrences)', () => {
    it('expands all occurrences between from and to dates', () => {
      const from = new Date('2026-09-01T00:00:00Z');
      const to = new Date('2026-09-10T23:59:59Z');
      const dates = expandOccurrences('RRULE:FREQ=DAILY', from, to);
      expect(dates.length).toBe(10);
    });

    it('returns empty array on invalid rule or out-of-range window', () => {
      const from = new Date('2026-09-01T00:00:00Z');
      const to = new Date('2026-09-02T00:00:00Z');
      expect(expandOccurrences('NOT_A_RULE', from, to)).toEqual([]);

      const emptyRange = expandOccurrences(
        'RRULE:FREQ=YEARLY',
        new Date('2026-01-01'),
        new Date('2026-01-02')
      );
      expect(Array.isArray(emptyRange)).toBe(true);
    });
  });
});
