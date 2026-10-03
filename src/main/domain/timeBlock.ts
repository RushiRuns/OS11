import { ValidationError } from './task-validation.js';

export interface TimeBlockCandidate {
  start: number;
  duration: number;
}

export interface ExistingTimeBlock {
  id: string;
  start: number;
  duration: number;
}

/**
 * Validates scheduling parameters for a task time block.
 * - startMin: 0..1439, must be multiple of 15
 * - durationMin: 15..480, must be multiple of 15
 * - Invariant: startMin + durationMin <= 1440 (cannot cross midnight)
 */
export function validateTimeBlock(startMin: number, durationMin: number): void {
  if (typeof startMin !== 'number' || !Number.isInteger(startMin)) {
    throw new ValidationError('Scheduled start must be an integer minute value.');
  }

  if (typeof durationMin !== 'number' || !Number.isInteger(durationMin)) {
    throw new ValidationError('Scheduled duration must be an integer minute value.');
  }

  if (startMin < 0 || startMin >= 1440) {
    throw new ValidationError(`Scheduled start must be between 0 and 1439, got: ${startMin}`);
  }

  if (startMin % 15 !== 0) {
    throw new ValidationError(`Scheduled start must be a multiple of 15 minutes, got: ${startMin}`);
  }

  if (durationMin < 15 || durationMin > 480) {
    throw new ValidationError(`Scheduled duration must be between 15 and 480 minutes, got: ${durationMin}`);
  }

  if (durationMin % 15 !== 0) {
    throw new ValidationError(`Scheduled duration must be a multiple of 15 minutes, got: ${durationMin}`);
  }

  if (startMin + durationMin > 1440) {
    throw new ValidationError(
      `Scheduled time block cannot cross midnight (start ${startMin} + duration ${durationMin} = ${startMin + durationMin} > 1440).`
    );
  }
}

/**
 * Authoritative check for interval overlap using half-open intervals [start, start + duration).
 * Returns true if candidate overlaps any existing block (excluding ignoreId).
 */
export function findOverlap(
  blocks: ExistingTimeBlock[],
  candidate: TimeBlockCandidate,
  ignoreId?: string
): boolean {
  const candStart = candidate.start;
  const candEnd = candidate.start + candidate.duration;

  for (const block of blocks) {
    if (ignoreId && block.id === ignoreId) continue;
    const blockStart = block.start;
    const blockEnd = block.start + block.duration;

    // Half-open interval overlap check
    if (Math.max(blockStart, candStart) < Math.min(blockEnd, candEnd)) {
      return true;
    }
  }

  return false;
}
