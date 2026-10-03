import { ValidationError } from './task-validation.js';

export interface TimeBlockCandidate {
  startMin: number;
  durationMin: number;
}

export interface ExistingTimeBlock {
  id: string;
  scheduled_start_min?: number | null;
  scheduled_duration_min?: number | null;
}

/**
 * Validates start minute and duration for a scheduler time block.
 * Invariants:
 * - Both must be integers
 * - startMin: 0 <= startMin < 1440
 * - durationMin: 15 <= durationMin <= 480
 * - Both must be multiples of 15 (15-minute grid snap)
 * - startMin + durationMin <= 1440 (cannot cross midnight)
 */
export function validateTimeBlock(startMin: number, durationMin: number): void {
  if (typeof startMin !== 'number' || !Number.isInteger(startMin)) {
    throw new ValidationError('Scheduled start minute must be an integer.');
  }

  if (typeof durationMin !== 'number' || !Number.isInteger(durationMin)) {
    throw new ValidationError('Scheduled duration must be an integer.');
  }

  if (startMin < 0 || startMin >= 1440) {
    throw new ValidationError(
      `Scheduled start minute must be between 0 and 1439 (received ${startMin}).`
    );
  }

  if (durationMin < 15 || durationMin > 480) {
    throw new ValidationError(
      `Scheduled duration must be between 15 and 480 minutes (received ${durationMin}).`
    );
  }

  if (startMin % 15 !== 0) {
    throw new ValidationError(
      `Scheduled start minute must be a multiple of 15 (received ${startMin}).`
    );
  }

  if (durationMin % 15 !== 0) {
    throw new ValidationError(
      `Scheduled duration must be a multiple of 15 (received ${durationMin}).`
    );
  }

  if (startMin + durationMin > 1440) {
    throw new ValidationError(
      `Scheduled time block cannot cross midnight (start: ${startMin}, duration: ${durationMin}, end: ${startMin + durationMin}).`
    );
  }
}

/**
 * Checks if a candidate interval [startMin, startMin + durationMin)
 * overlaps with any existing block [scheduled_start_min, scheduled_start_min + scheduled_duration_min).
 * Uses half-open intervals [start, end), so adjacent blocks (e.g. 2:00-3:00 and 3:00-4:00) do NOT overlap.
 */
export function findOverlap(
  blocks: ExistingTimeBlock[],
  candidate: TimeBlockCandidate,
  ignoreId?: string
): ExistingTimeBlock | null {
  const candidateEnd = candidate.startMin + candidate.durationMin;

  for (const block of blocks) {
    if (ignoreId && block.id === ignoreId) {
      continue;
    }

    if (
      typeof block.scheduled_start_min !== 'number' ||
      typeof block.scheduled_duration_min !== 'number'
    ) {
      continue;
    }

    const blockStart = block.scheduled_start_min;
    const blockEnd = blockStart + block.scheduled_duration_min;

    // Half-open interval intersection: [candidate.startMin, candidateEnd) & [blockStart, blockEnd)
    if (Math.max(candidate.startMin, blockStart) < Math.min(candidateEnd, blockEnd)) {
      return block;
    }
  }

  return null;
}
