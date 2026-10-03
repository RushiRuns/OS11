import { describe, it, expect } from 'vitest';
import { validateTimeBlock, findOverlap } from '../../src/main/domain/timeBlock.js';
import { ValidationError } from '../../src/main/domain/task-validation.js';

describe('timeBlock domain validation', () => {
  it('accepts valid 15-minute aligned values', () => {
    expect(() => validateTimeBlock(0, 30)).not.toThrow();
    expect(() => validateTimeBlock(540, 60)).not.toThrow();
    expect(() => validateTimeBlock(1410, 30)).not.toThrow(); // ends at 1440 exactly
  });

  it('rejects start minutes out of range', () => {
    expect(() => validateTimeBlock(-15, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(1440, 30)).toThrow(ValidationError);
  });

  it('rejects non-multiples of 15', () => {
    expect(() => validateTimeBlock(10, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 25)).toThrow(ValidationError);
  });

  it('rejects duration out of bounds (15-480)', () => {
    expect(() => validateTimeBlock(60, 0)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 10)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 495)).toThrow(ValidationError);
  });

  it('rejects blocks that cross midnight (start + duration > 1440)', () => {
    expect(() => validateTimeBlock(1425, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(1410, 45)).toThrow(ValidationError);
  });

  it('detects half-open interval overlaps accurately', () => {
    const existing = [
      { id: 'task-1', start: 600, duration: 60 }, // 10:00 - 11:00 (600 - 660)
    ];

    // Exactly adjacent (before or after): allowed, no overlap
    expect(findOverlap(existing, { start: 540, duration: 60 })).toBe(false); // 9:00 - 10:00
    expect(findOverlap(existing, { start: 660, duration: 60 })).toBe(false); // 11:00 - 12:00

    // Partial overlaps
    expect(findOverlap(existing, { start: 570, duration: 60 })).toBe(true);  // 9:30 - 10:30
    expect(findOverlap(existing, { start: 630, duration: 60 })).toBe(true);  // 10:30 - 11:30

    // Complete enclosing
    expect(findOverlap(existing, { start: 540, duration: 180 })).toBe(true); // 9:00 - 12:00
    expect(findOverlap(existing, { start: 615, duration: 30 })).toBe(true);  // 10:15 - 10:45

    // Ignores target self-id
    expect(findOverlap(existing, { start: 600, duration: 60 }, 'task-1')).toBe(false);
  });
});
