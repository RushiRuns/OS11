import { describe, it, expect } from 'vitest';
import {
  OPTIONAL_FIELDS,
  fieldsWithValue,
  hiddenFields,
  type OptionalField,
} from './detailFields.js';
import type { Task } from '@shared/types/task.js';

describe('detailFields reveal engine', () => {
  it('empty task shows no optional fields', () => {
    const emptyTask: Partial<Task> = {
      id: 'task-1',
      title: 'Blank task',
      recurrence_rule: null,
      is_habit: 0,
      waiting_on: null,
    };
    const visible = fieldsWithValue(emptyTask, {
      hasKeyResult: false,
      hasDependencies: false,
      hasAttachments: false,
    });

    expect(visible.size).toBe(0);
    expect(hiddenFields(visible)).toEqual([
      'repeat',
      'key_result',
      'waitingFor',
      'habit',
      'dependsOn',
      'attachments',
    ]);
  });

  it('task with Repeat and Key Result shows those two in fixed order', () => {
    const task: Partial<Task> = {
      id: 'task-2',
      recurrence_rule: 'FREQ=WEEKLY',
      is_habit: 0,
      waiting_on: null,
      key_result_id: 'kr-123',
    };
    const visible = fieldsWithValue(task, {
      hasKeyResult: true,
      hasDependencies: false,
      hasAttachments: false,
    });

    expect(visible.has('repeat')).toBe(true);
    expect(visible.has('key_result')).toBe(true);
    expect(visible.size).toBe(2);

    // Visible fields rendered in fixed OPTIONAL_FIELDS order
    const orderedVisible = OPTIONAL_FIELDS.filter((f) => visible.has(f));
    expect(orderedVisible).toEqual(['repeat', 'key_result']);

    // Hidden list excludes repeat and key_result
    expect(hiddenFields(visible)).toEqual([
      'waitingFor',
      'habit',
      'dependsOn',
      'attachments',
    ]);
  });

  it('a field added manually appears in fixed order, irrespective of addition order', () => {
    const sticky = new Set<OptionalField>();
    // User adds 'dependsOn' first, then 'habit'
    sticky.add('dependsOn');
    sticky.add('habit');

    const orderedVisible = OPTIONAL_FIELDS.filter((f) => sticky.has(f));
    // Habit must appear before dependsOn in OPTIONAL_FIELDS order
    expect(orderedVisible).toEqual(['habit', 'dependsOn']);

    expect(hiddenFields(sticky)).toEqual([
      'repeat',
      'key_result',
      'waitingFor',
      'attachments',
    ]);
  });

  it('a field whose value is cleared stays visible in the sticky set', () => {
    let task: Partial<Task> = {
      id: 'task-3',
      recurrence_rule: 'FREQ=DAILY',
    };

    // Initially populated
    const sticky = new Set<OptionalField>(fieldsWithValue(task));
    expect(sticky.has('repeat')).toBe(true);

    // User clears the recurrence rule mid-edit
    task = { ...task, recurrence_rule: null };
    const currentValues = fieldsWithValue(task);
    expect(currentValues.has('repeat')).toBe(false);

    // Union with sticky keeps the row on screen
    const visible = new Set<OptionalField>([...sticky, ...currentValues]);
    expect(visible.has('repeat')).toBe(true);
    expect(hiddenFields(visible)).not.toContain('repeat');
  });

  it('hidden list shrinks as fields are added and is empty when all six show', () => {
    const visible = new Set<OptionalField>();

    for (let i = 0; i < OPTIONAL_FIELDS.length; i++) {
      expect(hiddenFields(visible).length).toBe(OPTIONAL_FIELDS.length - i);
      visible.add(OPTIONAL_FIELDS[i]);
    }

    expect(visible.size).toBe(6);
    expect(hiddenFields(visible)).toEqual([]);
  });
});
