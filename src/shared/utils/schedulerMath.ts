export const SNAP = 15;
export const MIN_DURATION = 15;
export const MAX_DURATION = 480; // 8 hours
export const DAY_END = 1440; // 24 hours in minutes

export interface BlockInterval {
  id?: string;
  start: number;
  duration: number;
}

export interface Placement {
  start: number;
  duration: number;
}

export interface PlaceBlockOptions {
  allowShrink?: boolean;
}

/**
 * Snaps a minute value to the nearest 15-minute grid mark.
 */
export function snapToGrid(min: number): number {
  return Math.round(min / SNAP) * SNAP;
}

/**
 * Converts a vertical pixel Y coordinate to minutes since midnight.
 */
export function yToMinutes(y: number, hourHeight: number): number {
  if (hourHeight <= 0) return 0;
  const minutesPerPixel = 60 / hourHeight;
  return Math.round(y * minutesPerPixel);
}

/**
 * Converts minutes since midnight to vertical pixel Y offset.
 */
export function minutesToY(min: number, hourHeight: number): number {
  const pixelsPerMinute = hourHeight / 60;
  return min * pixelsPerMinute;
}

/**
 * Computes default block duration for a task:
 * estimated_minutes if present, else 30 minutes.
 * Rounded up to next 15-minute boundary, clamped between 15 and 480.
 */
export function defaultDuration(task?: { estimated_minutes?: number | null }): number {
  const raw = task?.estimated_minutes ?? 30;
  const roundedUp = Math.ceil(raw / SNAP) * SNAP;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, roundedUp));
}

/**
 * Clamps a block's start and duration inside the 0..1440 day range,
 * enforcing minimum (15m) and maximum (480m) duration constraints.
 */
export function clampBlock(start: number, duration: number): Placement {
  const clampedDuration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
  const maxStart = Math.max(0, DAY_END - clampedDuration);
  const clampedStart = Math.max(0, Math.min(maxStart, start));
  return { start: clampedStart, duration: clampedDuration };
}

/**
 * Half-open interval overlap check [start, start + duration).
 * Adjacent intervals (e.g. 120..180 and 180..240) do NOT overlap.
 */
export function overlaps(a: BlockInterval, b: BlockInterval): boolean {
  const aEnd = a.start + a.duration;
  const bEnd = b.start + b.duration;
  return Math.max(a.start, b.start) < Math.min(aEnd, bEnd);
}

/**
 * Finds placement for a block among other blocks without overlap.
 * 1. Checks desiredStart.
 * 2. If blocked, searches free gaps >= duration, picking the closest.
 * 3. If none and allowShrink is true, finds closest gap >= 15 and shrinks duration.
 * 4. Returns null if no valid spot found.
 */
export function placeBlock(
  others: BlockInterval[],
  desiredStart: number,
  duration: number,
  opts?: PlaceBlockOptions
): Placement | null {
  const dur = Math.max(MIN_DURATION, Math.min(MAX_DURATION, snapToGrid(duration)));
  const start = snapToGrid(desiredStart);

  // Sort other blocks chronologically
  const sorted = [...others].sort((a, b) => a.start - b.start);

  // 1. Direct placement check
  const candidate: BlockInterval = { start, duration: dur };
  const hasDirectOverlap = sorted.some((b) => overlaps(candidate, b));
  if (!hasDirectOverlap && start >= 0 && start + dur <= DAY_END) {
    return { start, duration: dur };
  }

  // 2. Build list of free gaps [gapStart, gapEnd) within 0..1440
  const gaps: Array<{ start: number; end: number; length: number }> = [];
  let cursor = 0;

  for (const block of sorted) {
    if (block.start > cursor) {
      gaps.push({ start: cursor, end: block.start, length: block.start - cursor });
    }
    cursor = Math.max(cursor, block.start + block.duration);
  }
  if (cursor < DAY_END) {
    gaps.push({ start: cursor, end: DAY_END, length: DAY_END - cursor });
  }

  // 3. Keep gaps with length >= duration
  const fittingGaps = gaps.filter((g) => g.length >= dur);
  if (fittingGaps.length > 0) {
    let bestClampedStart = -1;
    let minDistance = Infinity;

    for (const gap of fittingGaps) {
      // Best start within this gap snapped to grid
      const minStartInGap = gap.start;
      const maxStartInGap = gap.end - dur;
      const idealStart = snapToGrid(desiredStart);
      const clampedStart = Math.max(minStartInGap, Math.min(maxStartInGap, idealStart));

      const dist = Math.abs(clampedStart - desiredStart);
      if (dist < minDistance) {
        minDistance = dist;
        bestClampedStart = clampedStart;
      } else if (dist === minDistance && clampedStart < bestClampedStart) {
        // Earlier gap wins on tie
        bestClampedStart = clampedStart;
      }
    }

    if (bestClampedStart >= 0) {
      return { start: bestClampedStart, duration: dur };
    }
  }

  // 4. Shrink option (new placement from task list only)
  if (opts?.allowShrink) {
    const shrinkableGaps = gaps.filter((g) => g.length >= MIN_DURATION);
    if (shrinkableGaps.length > 0) {
      let bestGap: (typeof gaps)[0] | null = null;
      let minDistance = Infinity;

      for (const gap of shrinkableGaps) {
        // Distance to gap center/bounds
        const dist = desiredStart < gap.start ? gap.start - desiredStart : (desiredStart > gap.end ? desiredStart - gap.end : 0);
        if (dist < minDistance) {
          minDistance = dist;
          bestGap = gap;
        }
      }

      if (bestGap) {
        const shrunkenDuration = Math.min(dur, snapToGrid(bestGap.length));
        const maxStartInGap = bestGap.end - shrunkenDuration;
        const clampedStart = Math.max(bestGap.start, Math.min(maxStartInGap, snapToGrid(desiredStart)));
        return { start: clampedStart, duration: Math.max(MIN_DURATION, shrunkenDuration) };
      }
    }
  }

  // 5. Nothing fits
  return null;
}

/**
 * Computes boundary limits for resizing top or bottom edges of a block.
 */
export function resizeLimits(
  others: BlockInterval[],
  block: BlockInterval,
  edge: 'top' | 'bottom'
): { min: number; max: number } {
  const otherBlocks = others
    .filter((b) => (block.id ? b.id !== block.id : true))
    .sort((a, b) => a.start - b.start);

  const blockEnd = block.start + block.duration;

  if (edge === 'bottom') {
    // Bottom edge moves end
    // Min end is block.start + MIN_DURATION
    const minEnd = block.start + MIN_DURATION;

    // Max end is start of next block or DAY_END, capped by MAX_DURATION
    let nextStart = DAY_END;
    for (const b of otherBlocks) {
      if (b.start >= blockEnd) {
        nextStart = b.start;
        break;
      }
    }

    const maxEnd = Math.min(nextStart, block.start + MAX_DURATION, DAY_END);
    return { min: minEnd, max: Math.max(minEnd, maxEnd) };
  } else {
    // Top edge moves start
    // Max start is blockEnd - MIN_DURATION
    const maxStart = blockEnd - MIN_DURATION;

    // Min start is end of previous block or 0, constrained by MAX_DURATION
    let prevEnd = 0;
    for (const b of otherBlocks) {
      const bEnd = b.start + b.duration;
      if (bEnd <= block.start) {
        prevEnd = Math.max(prevEnd, bEnd);
      }
    }

    const minStart = Math.max(prevEnd, blockEnd - MAX_DURATION, 0);
    return { min: minStart, max: Math.max(minStart, maxStart) };
  }
}
