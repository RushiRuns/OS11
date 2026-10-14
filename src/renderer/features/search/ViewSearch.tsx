import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useViewSearchContext, type ViewSearchState } from './ViewSearchContext.js';
import { Tooltip } from '../../components/Tooltip/Tooltip.js';
import { useShortcutStore } from '../../stores/shortcutStore.js';
import styles from './ViewSearch.module.css';

export interface ViewSearchProps {
  searchState?: ViewSearchState;
  className?: string;
  onOpenDetail?: (taskId: string) => void;
}

/**
 * ViewSearch renders the 32px search trigger button that smoothly expands
 * into an inline 264px search field on the view header.
 */
export function ViewSearch({
  searchState: propState,
  className,
  onOpenDetail,
}: ViewSearchProps): React.ReactElement | null {
  // Can be used either via context or via explicit propState
  let ctxState: ViewSearchState | null = null;
  try {
    ctxState = useViewSearchContext();
  } catch {
    // If not wrapped in context, will use propState
  }
  const state = propState || ctxState;

  if (!state || !state.enabled) {
    return null;
  }

  const {
    isOpen,
    open,
    close,
    query,
    setQuery,
    matchCount,
    cursorTaskId,
    moveCursor,
    inputRef,
    viewName,
  } = state;

  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const [debouncedCountText, setDebouncedCountText] = useState('');
  const shortcuts = useShortcutStore((s) => s.shortcuts);

  const shortcutLabel = (shortcuts['search_tasks'] || ['Ctrl', 'F']).join(' ');
  const tooltipContent = `Search this view  ·  ${shortcutLabel}`;

  const countText =
    matchCount === 0 ? 'No matches' : matchCount === 1 ? '1 match' : `${matchCount} matches`;

  // Debounce screen reader announcement by 300ms after user stops typing
  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setDebouncedCountText('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedCountText(countText);
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, query, countText]);

  // Handle close action and restore focus to trigger button
  const handleClose = useCallback(() => {
    close();
    triggerBtnRef.current?.focus();
  }, [close]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Stop propagation so typing letters or task keys never leak to outer shortcuts
    e.stopPropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    // Ignore Enter / Arrow keys while IME composition is active (e.g. Hindi, Marathi)
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveCursor(1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveCursor(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (cursorTaskId) {
        onOpenDetail?.(cursorTaskId);
      }
      return;
    }
  };

  return (
    <div
      className={`${styles.container} ${isOpen ? styles.containerOpen : ''} ${className || ''}`}
      role="search"
      aria-label={`Search ${viewName}`}
    >
      {!isOpen ? (
        <Tooltip content={tooltipContent} delayDuration={450}>
          <button
            ref={triggerBtnRef}
            type="button"
            className={styles.triggerBtn}
            aria-label={`Search ${viewName}`}
            aria-expanded={false}
            onClick={open}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </Tooltip>
      ) : (
        <div className={`${styles.fieldContent} ${styles.fieldContentOpen}`}>
          <span className={styles.searchIconOpen} aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>

          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            className={styles.searchInput}
            placeholder={`Search ${viewName}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            aria-label={`Search ${viewName}`}
            autoComplete="off"
            spellCheck={false}
          />

          <div className={styles.endArea}>
            {!query.trim() ? (
              <kbd className={styles.escKeycap}>Esc</kbd>
            ) : (
              <span className={styles.matchCount} aria-hidden="true">
                {countText}
              </span>
            )}

            <button
              type="button"
              className={styles.closeBtn}
              onClick={handleClose}
              title="Close search (Esc)"
              aria-label="Close search"
            >
              ✕
            </button>
          </div>

          {/* Visually hidden aria-live region for screen reader polite announcement */}
          <div className={styles.srOnly} role="status" aria-live="polite">
            {debouncedCountText}
          </div>
        </div>
      )}
    </div>
  );
}

export default ViewSearch;
