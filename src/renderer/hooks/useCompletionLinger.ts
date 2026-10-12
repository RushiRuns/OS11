import { useState, useRef, useEffect, useMemo } from 'react';
import type { Task } from '../../shared/types/task.js';

export interface UseCompletionLingerOptions {
  tasks?: Task[];
  prefersReducedMotion?: boolean;
}

export interface UseCompletionLingerResult {
  lingeringIds: Set<string>;
  exitingIds: Set<string>;
  isLingering: (id: string) => boolean;
  isExiting: (id: string) => boolean;
  markCompleted: (id: string, task?: Task) => void;
  cancelLinger: (id: string) => void;
  withLingering: (activeTasks: Task[]) => Task[];
}

export class CompletionLingerTracker {
  public lingeringIds = new Set<string>();
  public exitingIds = new Set<string>();
  private lingeringMap = new Map<string, Task>();
  private timers = new Map<
    string,
    { exitTimer?: ReturnType<typeof setTimeout>; doneTimer: ReturnType<typeof setTimeout> }
  >();
  private isReducedMotion: boolean;
  private onChange?: () => void;

  constructor(options?: { prefersReducedMotion?: boolean; onChange?: () => void }) {
    this.isReducedMotion = options?.prefersReducedMotion ?? false;
    this.onChange = options?.onChange;
  }

  setReducedMotion(value: boolean) {
    this.isReducedMotion = value;
  }

  isLingering = (id: string): boolean => {
    return this.lingeringIds.has(id);
  };

  isExiting = (id: string): boolean => {
    return this.exitingIds.has(id);
  };

  cancelLinger = (id: string) => {
    const existing = this.timers.get(id);
    if (existing) {
      if (existing.exitTimer) clearTimeout(existing.exitTimer);
      clearTimeout(existing.doneTimer);
      this.timers.delete(id);
    }
    this.lingeringMap.delete(id);

    const changed = this.lingeringIds.delete(id) || this.exitingIds.delete(id);
    if (changed) {
      this.onChange?.();
    }
  };

  markCompleted = (id: string, task?: Task) => {
    this.cancelLinger(id);

    if (task) {
      this.lingeringMap.set(id, task);
    }

    this.lingeringIds.add(id);
    this.onChange?.();

    if (this.isReducedMotion) {
      // Reduced motion: removes at 420ms without exiting state
      const doneTimer = setTimeout(() => {
        this.timers.delete(id);
        this.lingeringMap.delete(id);
        this.lingeringIds.delete(id);
        this.onChange?.();
      }, 420);

      this.timers.set(id, { doneTimer });
    } else {
      // Normal motion: exiting at 420ms, leaves active list at 720ms
      const exitTimer = setTimeout(() => {
        this.exitingIds.add(id);
        this.onChange?.();
      }, 420);

      const doneTimer = setTimeout(() => {
        this.timers.delete(id);
        this.lingeringMap.delete(id);
        this.lingeringIds.delete(id);
        this.exitingIds.delete(id);
        this.onChange?.();
      }, 720);

      this.timers.set(id, { exitTimer, doneTimer });
    }
  };

  withLingering = (activeTasks: Task[]): Task[] => {
    if (this.lingeringMap.size === 0) return activeTasks;
    const result = [...activeTasks];
    const activeIds = new Set(activeTasks.map((t) => t.id));
    for (const [id, task] of this.lingeringMap.entries()) {
      if (!activeIds.has(id) && this.lingeringIds.has(id)) {
        result.push(task);
      }
    }
    return result;
  };

  destroy = () => {
    for (const timers of this.timers.values()) {
      if (timers.exitTimer) clearTimeout(timers.exitTimer);
      clearTimeout(timers.doneTimer);
    }
    this.timers.clear();
    this.lingeringMap.clear();
    this.lingeringIds.clear();
    this.exitingIds.clear();
  };
}

export function useCompletionLinger(
  tasksOrOptions?: Task[] | UseCompletionLingerOptions
): UseCompletionLingerResult {
  const options: UseCompletionLingerOptions = Array.isArray(tasksOrOptions)
    ? { tasks: tasksOrOptions }
    : tasksOrOptions || {};

  const { tasks, prefersReducedMotion: customReducedMotion } = options;

  const isReducedMotion =
    customReducedMotion !== undefined
      ? customReducedMotion
      : typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  const [, setTick] = useState(0);
  const trackerRef = useRef<CompletionLingerTracker | null>(null);

  if (!trackerRef.current) {
    trackerRef.current = new CompletionLingerTracker({
      prefersReducedMotion: isReducedMotion,
      onChange: () => setTick((n) => n + 1),
    });
  }

  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.setReducedMotion(isReducedMotion);
    }
  }, [isReducedMotion]);

  const prevCompletedStateRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!tasks || !trackerRef.current) return;

    for (const t of tasks) {
      const prevStatus = prevCompletedStateRef.current.get(t.id);
      if (prevStatus === 0 && t.is_completed === 1) {
        trackerRef.current.markCompleted(t.id, t);
      } else if (prevStatus === 1 && t.is_completed === 0) {
        trackerRef.current.cancelLinger(t.id);
      }
      prevCompletedStateRef.current.set(t.id, t.is_completed);
    }
  }, [tasks]);

  useEffect(() => {
    return () => {
      trackerRef.current?.destroy();
    };
  }, []);

  const tracker = trackerRef.current;

  return useMemo(
    () => ({
      lingeringIds: tracker.lingeringIds,
      exitingIds: tracker.exitingIds,
      isLingering: tracker.isLingering,
      isExiting: tracker.isExiting,
      markCompleted: tracker.markCompleted,
      cancelLinger: tracker.cancelLinger,
      withLingering: tracker.withLingering,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracker, tracker.lingeringIds.size, tracker.exitingIds.size]
  );
}

export default useCompletionLinger;
