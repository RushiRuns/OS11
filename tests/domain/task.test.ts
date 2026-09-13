import { describe, it, expect } from 'vitest';
import {
  validateCreateTask,
  validateUpdateTask,
  buildNewTask,
  ValidationError,
} from '../../src/main/domain/task.js';
import { parseQuickAdd } from '../../src/main/domain/nlp.js';
import { IPC } from '../../src/shared/ipc-channels.js';

describe('Domain: Task Validation', () => {
  it('should validate valid task creation payload', () => {
    expect(() => validateCreateTask({ title: 'Read governance files' })).not.toThrow();
  });

  it('should throw ValidationError on empty task title', () => {
    expect(() => validateCreateTask({ title: '   ' })).toThrow(ValidationError);
  });

  it('should throw ValidationError on invalid priority level', () => {
    expect(() => validateCreateTask({ title: 'Valid title', priority: 10 })).toThrow(ValidationError);
  });

  it('should validate valid task update payload', () => {
    expect(() => validateUpdateTask({ id: '123', title: 'Updated title' })).not.toThrow();
  });

  it('should throw ValidationError on update without id', () => {
    expect(() => validateUpdateTask({ id: '', title: 'Missing id' })).toThrow(ValidationError);
  });

  it('should build a new task model conforming to SCHEMA.md', () => {
    const task = buildNewTask({ title: 'Build OS11 scaffold' });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Build OS11 scaffold');
    expect(task.is_completed).toBe(0);
    expect(task.all_day).toBe(0);
    expect(task.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Domain: NLP Quick-Add Parsing', () => {
  it('should extract title without date', () => {
    const result = parseQuickAdd('Deploy release package');
    expect(result.cleanTitle).toBe('Deploy release package');
    expect(result.dueDate).toBeNull();
  });

  it('should parse human date from title', () => {
    const result = parseQuickAdd('Submit quarterly report tomorrow');
    expect(result.cleanTitle).toBe('Submit quarterly report');
    expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Shared: IPC Channels', () => {
  it('should have all mandatory task channels defined', () => {
    expect(IPC.TASKS.GET_ALL).toBe('tasks:get-all');
    expect(IPC.TASKS.CREATE).toBe('tasks:create');
    expect(IPC.TASKS.TOGGLE_COMPLETE).toBe('tasks:toggle-complete');
    expect(IPC.TASKS.DELETE).toBe('tasks:delete');
  });
});
