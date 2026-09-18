import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EMOJI_CATEGORIES, type EmojiEntry } from './emojiData.js';
import styles from './EmojiPicker.module.css';

export interface EmojiPickerProps {
  selectedEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({
  selectedEmoji,
  onSelect,
  onClose,
}: EmojiPickerProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>(EMOJI_CATEGORIES[0].id);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose]);

  // Filtered results when user enters a query
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const results: EmojiEntry[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (!seen.has(item.emoji)) {
          if (
            item.name.toLowerCase().includes(q) ||
            item.keywords.some((k) => k.toLowerCase().includes(q))
          ) {
            seen.add(item.emoji);
            results.push(item);
          }
        }
      }
    }

    return results;
  }, [searchQuery]);

  // Jump scroll to a category section
  const handleCategoryClick = (catId: string) => {
    setActiveCategoryId(catId);
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
    // Defer scroll until after state update if search query was cleared
    requestAnimationFrame(() => {
      const el = categoryRefs.current[catId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const handleSelectEmoji = (emoji: string) => {
    onSelect(emoji);
  };

  return (
    <div
      ref={containerRef}
      className={styles.popoverContainer}
      role="dialog"
      aria-label="Emoji Picker"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Header */}
      <div className={styles.header}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className={styles.tabBar} role="tablist" aria-label="Emoji categories">
        {EMOJI_CATEGORIES.map((cat) => {
          const isActive = !searchQuery.trim() && activeCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
              onClick={() => handleCategoryClick(cat.id)}
              title={cat.label}
              aria-label={cat.label}
            >
              {cat.icon}
            </button>
          );
        })}
      </div>

      {/* Emoji Scroll Area */}
      <div ref={scrollBodyRef} className={styles.scrollBody}>
        {searchResults !== null ? (
          // Search Results Mode
          searchResults.length > 0 ? (
            <div className={styles.categorySection}>
              <div className={styles.categoryTitle}>Results ({searchResults.length})</div>
              <div className={styles.emojiGrid}>
                {searchResults.map((item) => {
                  const isSelected = selectedEmoji === item.emoji;
                  return (
                    <button
                      key={item.emoji}
                      type="button"
                      className={`${styles.emojiButton} ${
                        isSelected ? styles.emojiButtonSelected : ''
                      }`}
                      onClick={() => handleSelectEmoji(item.emoji)}
                      title={item.name}
                      aria-label={item.name}
                    >
                      {item.emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.emptyNotice}>
              No emojis found for &quot;{searchQuery}&quot;
            </div>
          )
        ) : (
          // Category Browse Mode
          EMOJI_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => {
                categoryRefs.current[cat.id] = el;
              }}
              className={styles.categorySection}
            >
              <div className={styles.categoryTitle}>
                {cat.label} ({cat.emojis.length})
              </div>
              <div className={styles.emojiGrid}>
                {cat.emojis.map((item) => {
                  const isSelected = selectedEmoji === item.emoji;
                  return (
                    <button
                      key={item.emoji}
                      type="button"
                      className={`${styles.emojiButton} ${
                        isSelected ? styles.emojiButtonSelected : ''
                      }`}
                      onClick={() => handleSelectEmoji(item.emoji)}
                      title={item.name}
                      aria-label={item.name}
                    >
                      {item.emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
