import { useEffect, useRef } from 'react';
import { useModuleStore } from '../stores/moduleStore.js';
import type { Task } from '@shared/types/task.js';

interface UseVimModeOptions {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask?: (task: Task | null) => void;
  onDeleteTask?: (taskId: string) => void;
  onToggleComplete?: (taskId: string) => void;
  onToggleStar?: (taskId: string) => void;
  onOpenQuickAdd?: () => void;
}

export function useVimMode({
  tasks,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
  onToggleComplete,
  onToggleStar,
  onOpenQuickAdd,
}: UseVimModeOptions): void {
  const isVimEnabled = useModuleStore((state) => state.isEnabled('vim_keybindings'));
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isVimEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      const currentIdx = tasks.findIndex((t) => t.id === selectedTaskId);

      // 'j' -> Move down
      if (e.key === 'j') {
        e.preventDefault();
        if (tasks.length === 0) return;
        const nextIdx = currentIdx < tasks.length - 1 ? currentIdx + 1 : 0;
        onSelectTask?.(tasks[nextIdx]);
        return;
      }

      // 'k' -> Move up
      if (e.key === 'k') {
        e.preventDefault();
        if (tasks.length === 0) return;
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : tasks.length - 1;
        onSelectTask?.(tasks[prevIdx]);
        return;
      }

      // 'gg' -> Jump to top
      if (e.key === 'g') {
        if (lastKeyRef.current === 'g' && now - lastKeyTimeRef.current < 500) {
          e.preventDefault();
          if (tasks.length > 0) {
            onSelectTask?.(tasks[0]);
          }
          lastKeyRef.current = null;
          return;
        } else {
          lastKeyRef.current = 'g';
          lastKeyTimeRef.current = now;
          return;
        }
      }

      // 'G' -> Jump to bottom
      if (e.key === 'G') {
        e.preventDefault();
        if (tasks.length > 0) {
          onSelectTask?.(tasks[tasks.length - 1]);
        }
        return;
      }

      // 'dd' -> Delete task
      if (e.key === 'd') {
        if (lastKeyRef.current === 'd' && now - lastKeyTimeRef.current < 500) {
          e.preventDefault();
          if (selectedTaskId) {
            onDeleteTask?.(selectedTaskId);
          }
          lastKeyRef.current = null;
          return;
        } else {
          lastKeyRef.current = 'd';
          lastKeyTimeRef.current = now;
          return;
        }
      }

      // 'cc' -> Toggle complete
      if (e.key === 'c') {
        if (lastKeyRef.current === 'c' && now - lastKeyTimeRef.current < 500) {
          e.preventDefault();
          if (selectedTaskId) {
            onToggleComplete?.(selectedTaskId);
          }
          lastKeyRef.current = null;
          return;
        } else {
          lastKeyRef.current = 'c';
          lastKeyTimeRef.current = now;
          return;
        }
      }

      // 'ss' -> Toggle star/priority
      if (e.key === 's') {
        if (lastKeyRef.current === 's' && now - lastKeyTimeRef.current < 500) {
          e.preventDefault();
          if (selectedTaskId) {
            onToggleStar?.(selectedTaskId);
          }
          lastKeyRef.current = null;
          return;
        } else {
          lastKeyRef.current = 's';
          lastKeyTimeRef.current = now;
          return;
        }
      }

      // 'o' -> Open quick add
      if (e.key === 'o') {
        e.preventDefault();
        onOpenQuickAdd?.();
        return;
      }

      // Reset sequence tracker on any other key
      lastKeyRef.current = null;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isVimEnabled,
    tasks,
    selectedTaskId,
    onSelectTask,
    onDeleteTask,
    onToggleComplete,
    onToggleStar,
    onOpenQuickAdd,
  ]);
}

export default useVimMode;
