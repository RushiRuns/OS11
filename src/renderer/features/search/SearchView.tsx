import React, { useEffect, useRef } from 'react';
import { useSearchStore } from '../../stores/searchStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import styles from './SearchView.module.css';

interface SearchViewProps {
  onSelectTask?: (taskId: string) => void;
}

export function SearchView({ onSelectTask }: SearchViewProps): React.ReactElement | null {
  const {
    isOpen,
    query,
    results,
    isLoading,
    selectedIndex,
    setQuery,
    setSelectedIndex,
    closeSearch,
  } = useSearchStore();

  const { setSelectedTaskId } = useTaskStore();
  const { setActiveListId } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((selectedIndex - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target) {
        handleSelect(target.id, target.listId);
      }
    }
  };

  const handleSelect = (taskId: string, listId?: string) => {
    if (listId) {
      setActiveListId(listId);
    }
    setSelectedTaskId(taskId);
    onSelectTask?.(taskId);
    closeSearch();
  };

  return (
    <div className={styles.container} role="search" aria-label="Task search">
      <div className={styles.inputBar}>
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search all tasks with full-text search (Esc to close)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search tasks"
        />

        {isLoading ? (
          <span className={styles.countBadge}>Searching...</span>
        ) : query.trim() ? (
          <span className={styles.countBadge}>
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </span>
        ) : null}

        <button
          type="button"
          className={styles.closeButton}
          onClick={closeSearch}
          title="Close search (Esc)"
          aria-label="Close search"
        >
          ✕
        </button>
      </div>

      {query.trim() && (
        <div className={styles.resultsList}>
          {results.length === 0 && !isLoading ? (
            <div className={styles.emptyResults}>No tasks matching &ldquo;{query}&rdquo;</div>
          ) : (
            results.map((item, idx) => (
              <div
                key={item.id}
                className={`${styles.resultItem} ${
                  idx === selectedIndex ? styles.resultActive : ''
                }`}
                onClick={() => handleSelect(item.id, item.listId)}
              >
                <div className={styles.resultRow}>
                  <span className={styles.resultTitle}>{item.title}</span>
                </div>
                {item.snippet && item.snippet !== item.title && (
                  <div
                    className={styles.resultSnippet}
                    dangerouslySetInnerHTML={{ __html: item.snippet }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default SearchView;
