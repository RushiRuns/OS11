import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompletionLingerTracker } from '../../src/renderer/hooks/useCompletionLinger.js';

describe('Completion Linger Motion Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows exact 0ms -> 420ms -> 720ms departure timeline in standard motion', () => {
    const tracker = new CompletionLingerTracker({ prefersReducedMotion: false });

    // 0ms: markCompleted
    tracker.markCompleted('task-1');
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(false);

    // Fast-forward to 419ms (not yet exiting)
    vi.advanceTimersByTime(419);
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(false);

    // At 420ms: marks as exiting
    vi.advanceTimersByTime(1);
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(true);

    // Fast-forward to 719ms (still exiting/lingering)
    vi.advanceTimersByTime(299);
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(true);

    // At 720ms: leaves active list completely
    vi.advanceTimersByTime(1);
    expect(tracker.isLingering('task-1')).toBe(false);
    expect(tracker.isExiting('task-1')).toBe(false);

    tracker.destroy();
  });

  it('cancels exit and restores resting state if undone before 420ms', () => {
    const tracker = new CompletionLingerTracker({ prefersReducedMotion: false });

    tracker.markCompleted('task-1');
    expect(tracker.isLingering('task-1')).toBe(true);

    // User unchecks at 200ms
    vi.advanceTimersByTime(200);
    tracker.cancelLinger('task-1');

    expect(tracker.isLingering('task-1')).toBe(false);
    expect(tracker.isExiting('task-1')).toBe(false);

    // Advance past 420ms and 720ms: nothing happens
    vi.advanceTimersByTime(600);
    expect(tracker.isLingering('task-1')).toBe(false);
    expect(tracker.isExiting('task-1')).toBe(false);

    tracker.destroy();
  });

  it('removes row at 420ms without exiting state under prefers-reduced-motion', () => {
    const tracker = new CompletionLingerTracker({ prefersReducedMotion: true });

    tracker.markCompleted('task-1');
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(false);

    // Advance to 419ms
    vi.advanceTimersByTime(419);
    expect(tracker.isLingering('task-1')).toBe(true);
    expect(tracker.isExiting('task-1')).toBe(false);

    // At 420ms: immediately drops id without ever entering exiting state
    vi.advanceTimersByTime(1);
    expect(tracker.isLingering('task-1')).toBe(false);
    expect(tracker.isExiting('task-1')).toBe(false);

    tracker.destroy();
  });

  it('handles five quick completions in a row independently and settles all', () => {
    const tracker = new CompletionLingerTracker({ prefersReducedMotion: false });

    const ids = ['t1', 't2', 't3', 't4', 't5'];
    ids.forEach((id) => {
      vi.advanceTimersByTime(20);
      tracker.markCompleted(id);
    });

    // All should be lingering, none exiting yet
    ids.forEach((id) => {
      expect(tracker.isLingering(id)).toBe(true);
      expect(tracker.isExiting(id)).toBe(false);
    });

    // Advance by 800ms: all should be settled and cleared
    vi.advanceTimersByTime(800);
    ids.forEach((id) => {
      expect(tracker.isLingering(id)).toBe(false);
      expect(tracker.isExiting(id)).toBe(false);
    });

    tracker.destroy();
  });

  it('retains lingering task snapshot in withLingering', () => {
    const tracker = new CompletionLingerTracker({ prefersReducedMotion: false });
    const dummyTask = { id: 't1', title: 'Task 1', is_completed: 1 } as any;

    tracker.markCompleted('t1', dummyTask);

    const activeList = tracker.withLingering([]);
    expect(activeList).toHaveLength(1);
    expect(activeList[0].id).toBe('t1');

    // Once completed and settled after 720ms
    vi.advanceTimersByTime(720);
    const settledList = tracker.withLingering([]);
    expect(settledList).toHaveLength(0);

    tracker.destroy();
  });
});
