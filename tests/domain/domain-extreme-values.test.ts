import { describe, it, expect } from 'vitest';
import { between, atStart, atEnd } from '../../src/main/domain/fractional-index.js';
import { wouldCreateCycle } from '../../src/main/domain/dependency-check.js';
import {
  toISODate,
  toISODateTime,
  formatForDisplay,
  isOverdue,
} from '../../src/shared/utils/date.js';
import { generateUUID, isValidUUID } from '../../src/shared/utils/uuid.js';
import { getTagShape, getTagShapeClass } from '../../src/shared/utils/tag-shape.js';

describe('Domain & Shared: Extreme Values & Complete Utilities Coverage', () => {
  describe('Fractional Indexing Extreme Values', () => {
    it('handles extreme positive and negative values', () => {
      const hugePos = 1_000_000_000_000;
      const hugePosNext = 2_000_000_000_000;
      expect(between(hugePos, hugePosNext)).toBe(1_500_000_000_000);

      const neg1 = -5000;
      const neg2 = -1000;
      expect(between(neg1, neg2)).toBe(-3000);

      expect(atStart(-10000)).toBe(-11000);
      expect(atEnd(1_000_000)).toBe(1_001_000);
    });

    it('handles micro-intervals with precision', () => {
      const a = 100.0001;
      const b = 100.0002;
      const mid = between(a, b);
      expect(mid).toBeGreaterThan(a);
      expect(mid).toBeLessThan(b);
    });

    it('handles equal inputs with 0.5 offset safeguard', () => {
      expect(between(42, 42)).toBe(42.5);
    });

    it('handles all null boundary combinations', () => {
      expect(between(null, null)).toBe(1000);
      expect(between(null, 500)).toBe(-500);
      expect(between(500, null)).toBe(1500);
    });
  });

  describe('Dependency Cycle Checking', () => {
    it('detects direct cycles', () => {
      const graph = [{ task_id: 'task-B', depends_on_task_id: 'task-A' }];
      // If task-A wants to depend on task-B -> cycle A -> B -> A
      expect(wouldCreateCycle('task-A', 'task-B', () => graph)).toBe(true);
    });

    it('detects deep multi-node transitive cycles', () => {
      const graph = [
        { task_id: 'task-B', depends_on_task_id: 'task-A' },
        { task_id: 'task-C', depends_on_task_id: 'task-B' },
        { task_id: 'task-D', depends_on_task_id: 'task-C' },
        { task_id: 'task-E', depends_on_task_id: 'task-D' },
      ];
      // If task-A depends on task-E: A -> E -> D -> C -> B -> A
      expect(wouldCreateCycle('task-A', 'task-E', () => graph)).toBe(true);
      // But independent node task-Z depending on task-E is fine
      expect(wouldCreateCycle('task-Z', 'task-E', () => graph)).toBe(false);
    });

    it('allows complex acyclic directed graphs (DAG)', () => {
      // Diamond: root -> (left, right) -> sink
      const graph = [
        { task_id: 'left', depends_on_task_id: 'root' },
        { task_id: 'right', depends_on_task_id: 'root' },
        { task_id: 'sink', depends_on_task_id: 'left' },
      ];
      // sink also depending on right does NOT create a cycle
      expect(wouldCreateCycle('sink', 'right', () => graph)).toBe(false);
    });
  });

  describe('Date Utilities (src/shared/utils/date.ts)', () => {
    it('toISODate formats properly', () => {
      const date = new Date(2026, 8, 14, 12, 0, 0); // Sept 14, 2026
      expect(toISODate(date)).toBe('2026-09-14');
    });

    it('toISODateTime formats to standard ISO string', () => {
      const date = new Date('2026-09-14T10:30:00.000Z');
      expect(toISODateTime(date)).toBe('2026-09-14T10:30:00.000Z');
    });

    it('formatForDisplay handles special relative and formatted dates', () => {
      expect(formatForDisplay(null)).toBe('');
      expect(formatForDisplay(undefined)).toBe('');
      expect(formatForDisplay('invalid-iso')).toBe('invalid-iso');

      const now = new Date();
      expect(formatForDisplay(now.toISOString())).toBe('Today');

      const tomorrow = new Date(now.getTime() + 86_400_000);
      expect(formatForDisplay(tomorrow.toISOString())).toBe('Tomorrow');

      const yesterday = new Date(now.getTime() - 86_400_000);
      expect(formatForDisplay(yesterday.toISOString())).toBe('Yesterday');

      // Different year
      expect(formatForDisplay('2035-12-25T00:00:00.000Z')).toBe('Dec 25, 2035');
    });

    it('isOverdue handles date-only vs timestamp properly', () => {
      expect(isOverdue(null)).toBe(false);
      expect(isOverdue(undefined)).toBe(false);
      expect(isOverdue('invalid')).toBe(false);

      // Past date
      expect(isOverdue('2020-01-01')).toBe(true);
      expect(isOverdue('2020-01-01T12:00:00Z')).toBe(true);

      // Distant future date
      expect(isOverdue('2099-12-31')).toBe(false);
      expect(isOverdue('2099-12-31T23:59:59Z')).toBe(false);
    });
  });

  describe('UUID Utilities (src/shared/utils/uuid.ts)', () => {
    it('generates valid UUID v4', () => {
      const id1 = generateUUID();
      const id2 = generateUUID();
      expect(id1).not.toBe(id2);
      expect(isValidUUID(id1)).toBe(true);
      expect(isValidUUID(id2)).toBe(true);
    });

    it('rejects invalid UUID representations', () => {
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('12345678-1234-1234-1234-12345678901z')).toBe(false);
      expect(isValidUUID('random-string')).toBe(false);
      expect(isValidUUID(null as unknown as string)).toBe(false);
    });
  });

  describe('Tag Shape Utilities (src/shared/utils/tag-shape.ts)', () => {
    it('returns deterministic shapes for any tag identifier', () => {
      const shape1 = getTagShape('work');
      const shape2 = getTagShape('work');
      expect(shape1).toBe(shape2);
      expect(['circle', 'square', 'triangle']).toContain(shape1);

      expect(getTagShape('')).toBe('circle');
    });

    it('returns valid CSS classes for shapes', () => {
      expect(getTagShapeClass('work')).toMatch(/^tagDotShape(Circle|Square|Triangle)$/);
      expect(getTagShapeClass('')).toBe('tagDotShapeCircle');
    });
  });
});
