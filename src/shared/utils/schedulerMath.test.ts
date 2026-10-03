import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  yToMinutes,
  minutesToY,
  defaultDuration,
  clampBlock,
  overlaps,
  placeBlock,
  resizeLimits,
} from './schedulerMath.js';

describe('schedulerMath: Snapping & Coordinates', () => {
  it('snapToGrid rounds to nearest 15 minutes', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(7)).toBe(0);
    expect(snapToGrid(8)).toBe(15);
    expect(snapToGrid(14)).toBe(15);
    expect(snapToGrid(22)).toBe(15);
    expect(snapToGrid(23)).toBe(30);
    expect(snapToGrid(1435)).toBe(1440);
  });

  it('yToMinutes and minutesToY are accurate inverses based on hourHeight', () => {
    const hourHeight = 80; // 80px per 60 min -> 1.333 px/min
    expect(yToMinutes(0, hourHeight)).toBe(0);
    expect(yToMinutes(80, hourHeight)).toBe(60);
    expect(yToMinutes(160, hourHeight)).toBe(120);
    expect(minutesToY(60, hourHeight)).toBe(80);
    expect(minutesToY(120, hourHeight)).toBe(160);
    expect(yToMinutes(minutesToY(450, hourHeight), hourHeight)).toBe(450);
  });

  it('defaultDuration derives duration from estimated_minutes or defaults to 30', () => {
    expect(defaultDuration()).toBe(30);
    expect(defaultDuration({ estimated_minutes: null })).toBe(30);
    expect(defaultDuration({ estimated_minutes: 20 })).toBe(30); // round up to 30
    expect(defaultDuration({ estimated_minutes: 45 })).toBe(45);
    expect(defaultDuration({ estimated_minutes: 50 })).toBe(60); // round up to 60
    expect(defaultDuration({ estimated_minutes: 5 })).toBe(15); // min 15
    expect(defaultDuration({ estimated_minutes: 600 })).toBe(480); // clamp max 8h
  });

  it('clampBlock enforces day bounds and duration limits', () => {
    expect(clampBlock(-30, 30)).toEqual({ start: 0, duration: 30 });
    expect(clampBlock(1430, 60)).toEqual({ start: 1425, duration: 15 });
    expect(clampBlock(500, 10)).toEqual({ start: 500, duration: 15 });
    expect(clampBlock(500, 600)).toEqual({ start: 500, duration: 480 });
  });

  it('overlaps checks half-open intervals', () => {
    // 2:00 to 3:00 (120..180) and 3:00 to 4:00 (180..240) do NOT overlap
    expect(overlaps({ start: 120, duration: 60 }, { start: 180, duration: 60 })).toBe(false);
    expect(overlaps({ start: 180, duration: 60 }, { start: 120, duration: 60 })).toBe(false);

    // Overlapping
    expect(overlaps({ start: 120, duration: 60 }, { start: 150, duration: 60 })).toBe(true);
    expect(overlaps({ start: 130, duration: 20 }, { start: 120, duration: 60 })).toBe(true);
  });
});

describe('schedulerMath: placeBlock (§7.3 test cases)', () => {
  it('drop into empty day lands exactly at desired start', () => {
    const result = placeBlock([], 540, 60); // 9:00 AM, 1h
    expect(result).toEqual({ start: 540, duration: 60 });
  });

  it('drop exactly adjacent to existing block is allowed', () => {
    const existing = [{ id: 'b1', start: 540, duration: 60 }]; // 9:00 - 10:00 (540..600)
    // Drop 10:00 - 11:00
    const result = placeBlock(existing, 600, 60);
    expect(result).toEqual({ start: 600, duration: 60 });

    // Drop 8:00 - 9:00
    const resultBefore = placeBlock(existing, 480, 60);
    expect(resultBefore).toEqual({ start: 480, duration: 60 });
  });

  it('drop overlapping top of existing block shifts to nearest free gap', () => {
    const existing = [{ id: 'b1', start: 540, duration: 60 }]; // 540..600
    // Try dropping 510..570 (overlaps top). Gap before is 0..540, gap after is 600..1440.
    // In gap before (0..540), clamped ideal start is 540 - 60 = 480. Distance from 510 to 480 is 30.
    // In gap after (600..1440), clamped start is 600. Distance from 510 to 600 is 90.
    // Closest is 480!
    const result = placeBlock(existing, 510, 60);
    expect(result).toEqual({ start: 480, duration: 60 });
  });

  it('drop overlapping bottom of existing block shifts to nearest free gap', () => {
    const existing = [{ id: 'b1', start: 540, duration: 60 }]; // 540..600
    // Try dropping 570..630 (overlaps bottom).
    // Gap before (0..540): clamped start 480 (dist: 570 - 480 = 90).
    // Gap after (600..1440): clamped start 600 (dist: 600 - 570 = 30).
    // Closest is 600!
    const result = placeBlock(existing, 570, 60);
    expect(result).toEqual({ start: 600, duration: 60 });
  });

  it('drop fully inside existing block picks closest gap', () => {
    const existing = [{ id: 'b1', start: 540, duration: 120 }]; // 540..660
    // Drop 570..600 (desired start 570, duration 30).
    // Gap before (0..540): clamped start 510 (dist: 570 - 510 = 60).
    // Gap after (660..1440): clamped start 660 (dist: 660 - 570 = 90).
    const result = placeBlock(existing, 570, 30);
    expect(result).toEqual({ start: 510, duration: 30 });
  });

  it('drop where gap is smaller than duration: without shrink returns null', () => {
    // Gap between b1 and b2 is 30 min (570..600)
    const existing = [
      { id: 'b1', start: 500, duration: 70 }, // 500..570
      { id: 'b2', start: 600, duration: 60 }, // 600..660
    ];
    // Candidate requires 60 min
    const resultNoShrink = placeBlock(existing, 570, 60, { allowShrink: false });
    // It should find another gap (e.g. before 500 or after 660)
    expect(resultNoShrink).not.toBeNull();
    expect(resultNoShrink?.duration).toBe(60);
    expect(overlaps(resultNoShrink!, existing[0])).toBe(false);
    expect(overlaps(resultNoShrink!, existing[1])).toBe(false);
  });

  it('drop where no gap fits duration: with shrink shrinks to available gap', () => {
    // Day almost entirely occupied except for one 30 min gap: 570..600
    const existing = [
      { id: 'b1', start: 0, duration: 570 }, // 0..570
      { id: 'b2', start: 600, duration: 840 }, // 600..1440
    ];
    // Candidate requests 60 min at 570
    const resultNoShrink = placeBlock(existing, 570, 60, { allowShrink: false });
    expect(resultNoShrink).toBeNull(); // cannot fit 60m anywhere

    const resultShrunk = placeBlock(existing, 570, 60, { allowShrink: true });
    expect(resultShrunk).not.toBeNull();
    expect(resultShrunk?.start).toBe(570);
    expect(resultShrunk?.duration).toBe(30); // shrunk to 30m gap
  });

  it('drop at 23:45 with 30-minute duration clamps or shifts to last gap', () => {
    // 23:45 is minute 1425. A 30-min block would end at 1455 (>1440).
    const result = placeBlock([], 1425, 30);
    // Should be clamped to 1410 so it ends at 1440
    expect(result).toEqual({ start: 1410, duration: 30 });
  });

  it('moves never shrink', () => {
    const existing = [
      { id: 'b1', start: 0, duration: 570 },
      { id: 'b2', start: 600, duration: 840 },
    ];
    // Moves pass allowShrink: false
    const moveResult = placeBlock(existing, 570, 60, { allowShrink: false });
    expect(moveResult).toBeNull();
  });
});

describe('schedulerMath: resizeLimits (§7.3 test cases)', () => {
  const existing = [
    { id: 'b1', start: 480, duration: 60 }, // 480..540 (8:00 - 9:00)
    { id: 'target', start: 540, duration: 60 }, // 540..600 (9:00 - 10:00)
    { id: 'b3', start: 660, duration: 60 }, // 660..720 (11:00 - 12:00)
  ];

  it('bottom resize stops at neighbour and enforces min 15', () => {
    const limits = resizeLimits(existing, existing[1], 'bottom');
    // Min end is start + 15 = 555
    expect(limits.min).toBe(555);
    // Max end stops at start of b3 = 660
    expect(limits.max).toBe(660);
  });

  it('top resize stops at neighbour and enforces min 15', () => {
    const limits = resizeLimits(existing, existing[1], 'top');
    // Min start stops at end of b1 = 540
    expect(limits.min).toBe(540);
    // Max start is end - 15 = 600 - 15 = 585
    expect(limits.max).toBe(585);
  });

  it('resize stops at midnight (DAY_END = 1440)', () => {
    const lastBlock = { id: 'last', start: 1380, duration: 30 }; // 1380..1410 (23:00 - 23:30)
    const limits = resizeLimits([], lastBlock, 'bottom');
    expect(limits.max).toBe(1440);
  });

  it('resize stops at 00:00 (0)', () => {
    const firstBlock = { id: 'first', start: 30, duration: 60 }; // 0:30 - 1:30
    const limits = resizeLimits([], firstBlock, 'top');
    expect(limits.min).toBe(0);
  });
});
