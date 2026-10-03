import { describe, it, expect } from 'vitest';
import { validateTimeBlock, findOverlap } from '../../src/main/domain/timeBlock.js';
import { ValidationError } from '../../src/main/domain/task-validation.js';

describe('Domain: validateTimeBlock', () => {
  it('accepts valid start and duration on 15-minute grid', () => {
    expect(() => validateTimeBlock(0, 30)).not.toThrow();
    expect(() => validateTimeBlock(540, 60)).not.toThrow(); // 9:00 AM, 1 hour
    expect(() => validateTimeBlock(1410, 30)).not.toThrow(); // 23:30 to 24:00 (ends at 1440)
    expect(() => validateTimeBlock(0, 480)).not.toThrow(); // 8 hour max duration
  });

  it('rejects non-integer values', () => {
    expect(() => validateTimeBlock(30.5, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(30, 45.2)).toThrow(ValidationError);
  });

  it('rejects start minutes out of bounds (0..1439)', () => {
    expect(() => validateTimeBlock(-15, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(1440, 30)).toThrow(ValidationError);
  });

  it('rejects durations out of bounds (15..480)', () => {
    expect(() => validateTimeBlock(60, 0)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 10)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 495)).toThrow(ValidationError);
  });

  it('rejects values that are not multiples of 15', () => {
    expect(() => validateTimeBlock(7, 30)).toThrow(ValidationError);
    expect(() => validateTimeBlock(60, 35)).toThrow(ValidationError);
  });

  it('rejects blocks that cross midnight (start + duration > 1440)', () => {
    expect(() => validateTimeBlock(1425, 30)).toThrow(ValidationError); // ends at 1455
    expect(() => validateTimeBlock(1410, 45)).toThrow(ValidationError); // ends at 1455
  });
});

describe('Domain: findOverlap', () => {
  const existingBlocks = [
    { id: 'task-1', scheduled_start_min: 540, scheduled_duration_min: 60 }, // 9:00 - 10:00 (540..600)
    { id: 'task-2', scheduled_start_min: 660, scheduled_duration_min: 90 }, // 11:00 - 12:30 (660..750)
  ];

  it('returns null when day has no overlapping blocks', () => {
    // 8:00 - 9:00 (480..540) - touches 540 but does not overlap
    expect(findOverlap(existingBlocks, { startMin: 480, durationMin: 60 })).toBeNull();
    // 10:00 - 11:00 (600..660) - fits in gap
    expect(findOverlap(existingBlocks, { startMin: 600, durationMin: 60 })).toBeNull();
    // 12:30 - 13:00 (750..780) - touches 750 but does not overlap
    expect(findOverlap(existingBlocks, { startMin: 750, durationMin: 30 })).toBeNull();
  });

  it('detects partial overlap with start of an existing block', () => {
    // 8:30 - 9:30 (510..570) overlaps task-1 (540..600)
    const result = findOverlap(existingBlocks, { startMin: 510, durationMin: 60 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('task-1');
  });

  it('detects partial overlap with end of an existing block', () => {
    // 9:30 - 10:30 (570..630) overlaps task-1 (540..600)
    const result = findOverlap(existingBlocks, { startMin: 570, durationMin: 60 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('task-1');
  });

  it('detects block fully contained inside an existing block', () => {
    // 9:15 - 9:45 (555..585) inside task-1 (540..600)
    const result = findOverlap(existingBlocks, { startMin: 555, durationMin: 30 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('task-1');
  });

  it('detects block that completely encloses an existing block', () => {
    // 8:30 - 10:30 (510..630) encloses task-1 (540..600)
    const result = findOverlap(existingBlocks, { startMin: 510, durationMin: 120 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe('task-1');
  });

  it('ignores the specified ignoreId when re-checking self during move or resize', () => {
    // task-1 moved slightly or resized (e.g. 540..615) should not conflict with itself
    const result = findOverlap(
      existingBlocks,
      { startMin: 540, durationMin: 75 },
      'task-1'
    );
    expect(result).toBeNull();
  });
});
