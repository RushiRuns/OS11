import { describe, it, expect } from 'vitest';
import {
  toISODate,
  toISODateTime,
  formatForDisplay,
  isOverdue,
} from '../../src/shared/utils/date.js';
import { generateUUID, isValidUUID } from '../../src/shared/utils/uuid.js';

describe('Shared: Date Utilities', () => {
  it('toISODate returns YYYY-MM-DD', () => {
    const d = new Date('2026-05-15T12:00:00Z');
    expect(toISODate(d)).toBe('2026-05-15');
  });

  it('toISODateTime returns ISO string', () => {
    const d = new Date('2026-05-15T12:00:00Z');
    expect(toISODateTime(d)).toBe('2026-05-15T12:00:00.000Z');
  });

  it('formatForDisplay returns Today, Tomorrow, or formatted string', () => {
    const today = new Date();
    const isoToday = today.toISOString();
    expect(formatForDisplay(isoToday)).toBe('Today');

    const tomorrow = new Date(Date.now() + 86400000);
    expect(formatForDisplay(tomorrow.toISOString())).toBe('Tomorrow');
  });

  it('isOverdue correctly detects past dates', () => {
    expect(isOverdue('2020-01-01')).toBe(true);
    expect(isOverdue('2099-01-01')).toBe(false);
  });
});

describe('Shared: UUID Utilities', () => {
  it('generateUUID generates valid UUID v4', () => {
    const id = generateUUID();
    expect(isValidUUID(id)).toBe(true);
  });

  it('isValidUUID rejects invalid strings', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('12345')).toBe(false);
    expect(isValidUUID('not-a-valid-uuid-format-string')).toBe(false);
  });
});
