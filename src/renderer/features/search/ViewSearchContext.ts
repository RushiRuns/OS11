import React, { useContext } from 'react';
import type { TaskMatchResult } from './matchTaskSearch.js';

export const VIEW_SEARCH_OPEN_EVENT = 'os11:open-view-search';

export interface ViewSearchState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  focus: () => void;
  query: string;
  setQuery: (q: string) => void;
  tokens: string[];
  isFiltering: boolean;
  matchCount: number;
  cursorTaskId: string | null;
  moveCursor: (delta: number) => void;
  results: Map<string, TaskMatchResult>;
  isRowVisible: (id: string) => boolean;
  pin: (id: string) => void;
  unpin: (id: string) => void;
  groupOpen: (key: string, userOpen: boolean, hasMatches: boolean) => boolean;
  setGroupOverride: (key: string, open: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  viewName: string;
  viewKey: string;
  enabled: boolean;
}

export const ViewSearchContext = React.createContext<ViewSearchState | null>(null);

export function useViewSearchContext(): ViewSearchState {
  const ctx = useContext(ViewSearchContext);
  if (!ctx) {
    throw new Error('useViewSearchContext must be used within a ViewSearchContext.Provider');
  }
  return ctx;
}

export function useOptionalViewSearchContext(): ViewSearchState | null {
  try {
    const dispatcher = (React as any)?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current;
    if (dispatcher === null || dispatcher === undefined) {
      return null;
    }
    return useContext(ViewSearchContext);
  } catch {
    return null;
  }
}

