import { useState, useRef, useEffect, useMemo, useDeferredValue, useCallback } from 'react';
import {
  tokenize,
  matchTaskTree,
  type TaskMatchResult,
} from '../features/search/matchTaskSearch.js';
import { useShortcutStore, matchesShortcut } from '../stores/shortcutStore.js';
import {
  VIEW_SEARCH_OPEN_EVENT,
  type ViewSearchState,
} from '../features/search/ViewSearchContext.js';

// Module-level registry in development to warn if multiple active instances mount simultaneously
const activeHookInstances = new Set<string>();

export interface UseViewSearchOptions<T extends { id: string; title: string; parent_task_id?: string | null }> {
  tasks: T[];
  getChildren?: (id: string) => Array<{ id: string; title: string }>;
  viewKey: string;
  viewName: string;
  enabled?: boolean;
  onOpenTaskDetail?: (taskId: string) => void;
}

export function useViewSearch<T extends { id: string; title: string; parent_task_id?: string | null }>({
  tasks,
  getChildren,
  viewKey,
  viewName,
  enabled = true,
  onOpenTaskDetail,
}: UseViewSearchOptions<T>): ViewSearchState {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [groupOverrides, setGroupOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [cursorIndex, setCursorIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const prevViewKeyRef = useRef(viewKey);
  const onOpenTaskDetailRef = useRef(onOpenTaskDetail);
  onOpenTaskDetailRef.current = onOpenTaskDetail;

  // Development safety check: warn on multiple live instances
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && enabled) {
      if (activeHookInstances.size > 0 && !activeHookInstances.has(viewKey)) {
        console.error(
          `[useViewSearch] Multiple active useViewSearch instances detected: ${Array.from(
            activeHookInstances
          ).join(', ')} and ${viewKey}. Only one hook instance should be mounted per visible view.`
        );
      }
      activeHookInstances.add(viewKey);
      return () => {
        activeHookInstances.delete(viewKey);
      };
    }
  }, [viewKey, enabled]);

  // Reset when viewKey changes (except project list <-> board, which share project:{id})
  useEffect(() => {
    if (prevViewKeyRef.current !== viewKey) {
      prevViewKeyRef.current = viewKey;
      setIsOpen(false);
      setQueryState('');
      setPinnedIds(new Set());
      setGroupOverrides(new Map());
      setCursorIndex(0);
    }
  }, [viewKey]);

  // Reset if disabled turns false
  useEffect(() => {
    if (!enabled && isOpen) {
      setIsOpen(false);
      setQueryState('');
      setPinnedIds(new Set());
      setGroupOverrides(new Map());
      setCursorIndex(0);
    }
  }, [enabled, isOpen]);

  // Deferred query keeps typing responsive on larger lists
  const deferredQuery = useDeferredValue(query);
  const isFiltering = Boolean(enabled && isOpen && query.trim().length > 0);
  const tokens = useMemo(() => tokenize(deferredQuery), [deferredQuery]);

  // Synchronous in-memory tree evaluation for all tasks
  const { results, matchingTopLevelTasks } = useMemo(() => {
    const resMap = new Map<string, TaskMatchResult>();
    const topLevelMatches: T[] = [];

    if (!isFiltering || tokens.length === 0) {
      return { results: resMap, matchingTopLevelTasks: topLevelMatches };
    }

    const defaultGetChildren = (id: string) =>
      tasks.filter((t) => t.parent_task_id === id);
    const childFetcher = getChildren || defaultGetChildren;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const matchResult = matchTaskTree(task, childFetcher, tokens);
      resMap.set(task.id, matchResult);

      // Collect matching top-level tasks for matchCount and cursor navigation
      const isTopLevel = !task.parent_task_id;
      if (isTopLevel && matchResult.isMatch) {
        topLevelMatches.push(task);
      }
    }

    return { results: resMap, matchingTopLevelTasks: topLevelMatches };
  }, [tasks, getChildren, tokens, isFiltering]);

  // Match count represents unique top-level tasks (open + completed)
  const matchCount = matchingTopLevelTasks.length;

  // Reset cursor index to 0 whenever matching results change
  useEffect(() => {
    setCursorIndex(0);
  }, [tokens]);

  // Ensure cursor index is within bounds
  const clampedCursorIndex = matchCount > 0 ? Math.min(cursorIndex, matchCount - 1) : 0;
  const cursorTaskId = matchCount > 0 ? matchingTopLevelTasks[clampedCursorIndex]?.id ?? null : null;

  const moveCursor = useCallback(
    (delta: number) => {
      if (matchCount === 0) return;
      setCursorIndex((prev) => (prev + delta + matchCount) % matchCount);
    },
    [matchCount]
  );

  const focus = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const open = useCallback(() => {
    if (!enabled) return;
    setIsOpen(true);
    // Focus and select input on next frame after mounting / expanding
    requestAnimationFrame(() => {
      focus();
    });
  }, [enabled, focus]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setPinnedIds(new Set());
    setGroupOverrides(new Map());
    setCursorIndex(0);
  }, []);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
  }, []);

  const pin = useCallback((id: string) => {
    setPinnedIds((prev) => new Set(prev).add(id));
  }, []);

  const unpin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isRowVisible = useCallback(
    (id: string) => {
      if (!isFiltering) return true;
      if (pinnedIds.has(id)) return true;
      return Boolean(results.get(id)?.isMatch);
    },
    [isFiltering, pinnedIds, results]
  );

  const groupOpen = useCallback(
    (key: string, userOpen: boolean, hasMatches: boolean) => {
      if (!isFiltering) return userOpen;
      const override = groupOverrides.get(key);
      return override !== undefined ? override : hasMatches;
    },
    [isFiltering, groupOverrides]
  );

  const setGroupOverride = useCallback((key: string, openState: boolean) => {
    setGroupOverrides((prev) => new Map(prev).set(key, openState));
  }, []);

  // Window keydown listener (capture phase) for Ctrl+F, /, and Command Palette event
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if shortcut recording is active
      if (useShortcutStore.getState().isSuspended) return;

      // Ignore if a modal / dialog is open
      const hasOpenModal = Boolean(
        document.querySelector('[role="dialog"][data-state="open"], [aria-modal="true"]')
      );
      if (hasOpenModal) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const shortcuts = useShortcutStore.getState().shortcuts;
      const searchShortcut = shortcuts['search_tasks'] || ['Ctrl', 'F'];

      // 1. Ctrl+F / Cmd+F: open search or focus & select if already open
      if (matchesShortcut(e, searchShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
          focus();
        } else {
          open();
        }
        return;
      }

      // 2. Slash '/' -> open search when NOT in an editable input
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        open();
        return;
      }
    };

    const handleCustomOpen = () => {
      if (enabled) {
        open();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener(VIEW_SEARCH_OPEN_EVENT, handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener(VIEW_SEARCH_OPEN_EVENT, handleCustomOpen);
    };
  }, [enabled, isOpen, open, focus]);

  return {
    isOpen,
    open,
    close,
    focus,
    query,
    setQuery,
    tokens,
    isFiltering,
    matchCount,
    cursorTaskId,
    moveCursor,
    results,
    isRowVisible,
    pin,
    unpin,
    groupOpen,
    setGroupOverride,
    inputRef,
    viewName,
    viewKey,
    enabled,
  };
}

export default useViewSearch;
