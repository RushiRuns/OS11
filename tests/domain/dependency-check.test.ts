import { describe, it, expect } from 'vitest';
import { wouldCreateCycle } from '../../src/main/domain/dependency-check.js';

describe('Domain: Task Dependency Cycle Check', () => {
  it('should detect self-dependency as a cycle', () => {
    expect(wouldCreateCycle('task-1', 'task-1', () => [])).toBe(true);
  });

  it('should allow independent dependencies', () => {
    const deps = [
      { task_id: 'task-2', depends_on_task_id: 'task-1' },
      { task_id: 'task-3', depends_on_task_id: 'task-2' },
    ];
    // task-4 depends on task-3 is fine
    expect(wouldCreateCycle('task-4', 'task-3', () => deps)).toBe(false);
  });

  it('should detect direct cycle', () => {
    const deps = [
      { task_id: 'task-2', depends_on_task_id: 'task-1' },
    ];
    // If task-1 tries to depend on task-2, it creates task-1 -> task-2 -> task-1
    expect(wouldCreateCycle('task-1', 'task-2', () => deps)).toBe(true);
  });

  it('should detect transitive cycle', () => {
    const deps = [
      { task_id: 'task-2', depends_on_task_id: 'task-1' },
      { task_id: 'task-3', depends_on_task_id: 'task-2' },
      { task_id: 'task-4', depends_on_task_id: 'task-3' },
    ];
    // If task-1 tries to depend on task-4: task-1 -> task-4 -> task-3 -> task-2 -> task-1
    expect(wouldCreateCycle('task-1', 'task-4', () => deps)).toBe(true);
  });

  it('should allow branching trees without cycles', () => {
    const deps = [
      { task_id: 'task-b', depends_on_task_id: 'task-a' },
      { task_id: 'task-c', depends_on_task_id: 'task-a' },
      { task_id: 'task-d', depends_on_task_id: 'task-b' },
    ];
    // task-d also depends on task-c
    expect(wouldCreateCycle('task-d', 'task-c', () => deps)).toBe(false);
  });
});
