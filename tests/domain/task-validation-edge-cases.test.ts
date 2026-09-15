import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateCreate,
  validateUpdate,
} from '../../src/main/domain/task-validation.js';
import type { CreateTaskPayload, UpdateTaskPayload } from '../../src/shared/types/index.js';

describe('Domain: Task Validation Edge Cases (100% Coverage Target)', () => {
  describe('ValidationError', () => {
    it('creates error with correct name and message', () => {
      const err = new ValidationError('Custom error message');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ValidationError');
      expect(err.message).toBe('Custom error message');
    });
  });

  describe('validateCreate', () => {
    it('throws when payload is null, undefined, or primitive', () => {
      expect(() => validateCreate(null as unknown as CreateTaskPayload)).toThrow(ValidationError);
      expect(() => validateCreate(undefined as unknown as CreateTaskPayload)).toThrow(ValidationError);
      expect(() => validateCreate('invalid-payload' as unknown as CreateTaskPayload)).toThrow(
        ValidationError
      );
      expect(() => validateCreate(123 as unknown as CreateTaskPayload)).toThrow(ValidationError);
    });

    it('throws when title is missing, empty, or whitespace only', () => {
      expect(() => validateCreate({} as CreateTaskPayload)).toThrow(ValidationError);
      expect(() => validateCreate({ title: '' } as CreateTaskPayload)).toThrow(ValidationError);
      expect(() => validateCreate({ title: '   \t\n  ' } as CreateTaskPayload)).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: null as unknown as string } as CreateTaskPayload)).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 12345 as unknown as string } as CreateTaskPayload)).toThrow(
        ValidationError
      );
    });

    it('throws when title exceeds 500 characters', () => {
      const longTitle = 'a'.repeat(501);
      expect(() => validateCreate({ title: longTitle })).toThrow(ValidationError);

      const maxTitle = 'a'.repeat(500);
      expect(() => validateCreate({ title: maxTitle })).not.toThrow();
    });

    it('validates priority bounds (0 to 4 integers)', () => {
      // Valid priorities
      for (let p = 0; p <= 4; p++) {
        expect(() => validateCreate({ title: 'Task', priority: p as 0 | 1 | 2 | 3 | 4 })).not.toThrow();
      }
      expect(() => validateCreate({ title: 'Task', priority: undefined })).not.toThrow();
      expect(() => validateCreate({ title: 'Task', priority: null as unknown as 0 })).not.toThrow();

      // Invalid priorities
      expect(() => validateCreate({ title: 'Task', priority: -1 as unknown as 0 })).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 'Task', priority: 5 as unknown as 0 })).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 'Task', priority: 2.5 as unknown as 0 })).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 'Task', priority: NaN as unknown as 0 })).toThrow(
        ValidationError
      );
    });

    it('validates due_date formats', () => {
      expect(() => validateCreate({ title: 'Task', due_date: '2026-09-14' })).not.toThrow();
      expect(() =>
        validateCreate({ title: 'Task', due_date: '2026-09-14T12:00:00Z' })
      ).not.toThrow();
      expect(() =>
        validateCreate({ title: 'Task', due_date: '2026-09-14T12:00:00.000Z' })
      ).not.toThrow();
      expect(() =>
        validateCreate({ title: 'Task', due_date: '2026-09-14T12:00:00+02:00' })
      ).not.toThrow();

      // Invalid dates
      expect(() => validateCreate({ title: 'Task', due_date: 'not-a-date' })).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 'Task', due_date: '14/09/2026' })).toThrow(
        ValidationError
      );
      expect(() => validateCreate({ title: 'Task', due_date: '2026-99-99' })).toThrow(
        ValidationError
      );
    });

    it('validates due_time formats', () => {
      expect(() => validateCreate({ title: 'Task', due_time: '14:30' })).not.toThrow();
      expect(() => validateCreate({ title: 'Task', due_time: '00:00:00' })).not.toThrow();
      expect(() => validateCreate({ title: 'Task', due_time: '23:59:59' })).not.toThrow();

      // Invalid times
      expect(() => validateCreate({ title: 'Task', due_time: '24:00' })).toThrow(ValidationError);
      expect(() => validateCreate({ title: 'Task', due_time: '12:60' })).toThrow(ValidationError);
      expect(() => validateCreate({ title: 'Task', due_time: '9:30' })).toThrow(ValidationError);
      expect(() => validateCreate({ title: 'Task', due_time: 'noon' })).toThrow(ValidationError);
    });

    it('validates recurrence_rule format', () => {
      expect(() =>
        validateCreate({ title: 'Task', recurrence_rule: 'RRULE:FREQ=DAILY' })
      ).not.toThrow();
      expect(() =>
        validateCreate({ title: 'Task', recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,FR' })
      ).not.toThrow();

      // Invalid RRULE
      expect(() =>
        validateCreate({ title: 'Task', recurrence_rule: 'NOT_A_VALID_RRULE' })
      ).toThrow(ValidationError);
      expect(() =>
        validateCreate({ title: 'Task', recurrence_rule: 'FREQ=INVALID' })
      ).toThrow(ValidationError);
    });
  });

  describe('validateUpdate', () => {
    it('throws when fields is null or not an object', () => {
      expect(() => validateUpdate(null as unknown as UpdateTaskPayload)).toThrow(ValidationError);
      expect(() => validateUpdate('invalid' as unknown as UpdateTaskPayload)).toThrow(
        ValidationError
      );
    });

    it('throws when id is missing, empty, or not a string', () => {
      expect(() => validateUpdate({} as UpdateTaskPayload)).toThrow(ValidationError);
      expect(() => validateUpdate({ id: '' } as UpdateTaskPayload)).toThrow(ValidationError);
      expect(() => validateUpdate({ id: 123 as unknown as string } as UpdateTaskPayload)).toThrow(
        ValidationError
      );
    });

    it('validates title updates', () => {
      expect(() => validateUpdate({ id: 'task-1', title: 'Valid new title' })).not.toThrow();
      expect(() => validateUpdate({ id: 'task-1', title: '' })).toThrow(ValidationError);
      expect(() => validateUpdate({ id: 'task-1', title: '   ' })).toThrow(ValidationError);
      expect(() => validateUpdate({ id: 'task-1', title: 123 as unknown as string })).toThrow(
        ValidationError
      );
      expect(() => validateUpdate({ id: 'task-1', title: 'a'.repeat(501) })).toThrow(
        ValidationError
      );
    });

    it('validates priority updates', () => {
      expect(() => validateUpdate({ id: 'task-1', priority: 2 })).not.toThrow();
      expect(() => validateUpdate({ id: 'task-1', priority: null as unknown as 0 })).not.toThrow();
      expect(() => validateUpdate({ id: 'task-1', priority: -1 as unknown as 0 })).toThrow(
        ValidationError
      );
      expect(() => validateUpdate({ id: 'task-1', priority: 5 as unknown as 0 })).toThrow(
        ValidationError
      );
      expect(() => validateUpdate({ id: 'task-1', priority: 1.5 as unknown as 0 })).toThrow(
        ValidationError
      );
    });

    it('validates due_date updates', () => {
      expect(() => validateUpdate({ id: 'task-1', due_date: '2026-12-31' })).not.toThrow();
      expect(() => validateUpdate({ id: 'task-1', due_date: 'invalid' })).toThrow(ValidationError);
    });

    it('validates due_time updates', () => {
      expect(() => validateUpdate({ id: 'task-1', due_time: '18:45' })).not.toThrow();
      expect(() => validateUpdate({ id: 'task-1', due_time: '99:99' })).toThrow(ValidationError);
    });

    it('validates recurrence_rule updates', () => {
      expect(() =>
        validateUpdate({ id: 'task-1', recurrence_rule: 'RRULE:FREQ=MONTHLY' })
      ).not.toThrow();
      expect(() =>
        validateUpdate({ id: 'task-1', recurrence_rule: 'BAD_RULE' })
      ).toThrow(ValidationError);
    });
  });
});
