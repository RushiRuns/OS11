import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTagStore, TAG_COLOR_PALETTE, buildTagTree, type TagTreeNode } from '../../stores/tagStore.js';
import type { Tag } from '@shared/types/Tag.js';
import styles from './TagPicker.module.css';

export interface TagPickerProps {
  taskId?: string;
  selectedTagIds?: string[];
  onSelectTag?: (tag: Tag) => void;
  onClose: () => void;
}

export function TagPicker({
  taskId,
  selectedTagIds = [],
  onSelectTag,
  onClose,
}: TagPickerProps): React.ReactElement {
  const { tagsById, loadTags, createTag, addTagToTask, removeTagFromTask } = useTagStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLOR_PALETTE[0].token);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
    inputRef.current?.focus();
  }, [loadTags]);

  const allTags = useMemo(() => Object.values(tagsById), [tagsById]);

  // Filtered tags or tree
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return allTags;
    const q = searchQuery.toLowerCase().trim();
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, searchQuery]);

  const tagTree = useMemo(() => {
    return buildTagTree(allTags);
  }, [allTags]);

  const exactMatch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allTags.find((t) => t.name.toLowerCase() === q);
  }, [allTags, searchQuery]);

  const handleTagClick = useCallback(
    async (tag: Tag) => {
      if (taskId) {
        const isAlreadyAssigned = selectedTagIds.includes(tag.id);
        if (isAlreadyAssigned) {
          await removeTagFromTask(taskId, tag.id);
        } else {
          await addTagToTask(taskId, tag.id);
        }
      }
      onSelectTag?.(tag);
    },
    [taskId, selectedTagIds, removeTagFromTask, addTagToTask, onSelectTag]
  );

  const handleCreateInline = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      const newTag = await createTag({
        name: searchQuery.trim(),
        color: selectedColor,
      });
      if (taskId) {
        await addTagToTask(taskId, newTag.id);
      }
      onSelectTag?.(newTag);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  }, [searchQuery, createTag, selectedColor, taskId, addTagToTask, onSelectTag]);

  // Handle click outside & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, Math.max(0, filteredTags.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTags[highlightIndex]) {
          handleTagClick(filteredTags[highlightIndex]);
        } else if (searchQuery.trim() && !exactMatch) {
          handleCreateInline();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTags, highlightIndex, searchQuery, exactMatch, onClose, handleTagClick, handleCreateInline]);

  const renderTreeNodes = (nodes: TagTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isSelected = node.tag ? selectedTagIds.includes(node.tag.id) : false;

      return (
        <div key={node.id} className={styles.treeItem}>
          <button
            type="button"
            className={`${styles.tagItem} ${isSelected ? styles.tagItemSelected : ''}`}
            onClick={() => {
              if (node.tag) {
                handleTagClick(node.tag);
              }
            }}
          >
            {Array.from({ length: depth }).map((_, i) => (
              <span key={i} className={styles.treeIndent} />
            ))}
            <span
              className={styles.tagColorDot}
              style={{ background: node.tag?.color ?? 'var(--tag-gray)' }}
            />
            <span className={styles.tagName}>{node.name}</span>
            {isSelected && <span className={styles.checkMark}>✓</span>}
          </button>
          {hasChildren && renderTreeNodes(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className={styles.popoverContainer}
        role="dialog"
        aria-label="Tag Picker"
      >
        <div className={styles.header}>
          <span className={styles.searchIcon}>🏷️</span>
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search or create tag..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightIndex(0);
            }}
          />
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close Tag Picker"
          >
            ✕
          </button>
        </div>

        <div className={styles.tagList}>
          {searchQuery.trim() ? (
            // Flat filtered list when querying
            filteredTags.length > 0 ? (
              filteredTags.map((tag, idx) => {
                const isSelected = selectedTagIds.includes(tag.id);
                const isHighlighted = idx === highlightIndex;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`${styles.tagItem} ${isSelected ? styles.tagItemSelected : ''} ${
                      isHighlighted ? styles.tagItemActive : ''
                    }`}
                    onClick={() => handleTagClick(tag)}
                  >
                    <span
                      className={styles.tagColorDot}
                      style={{ background: tag.color ?? 'var(--tag-gray)' }}
                    />
                    <span className={styles.tagName}>{tag.name}</span>
                    {isSelected && <span className={styles.checkMark}>✓</span>}
                  </button>
                );
              })
            ) : (
              <div className={styles.emptyNotice}>No existing tags match &quot;{searchQuery}&quot;</div>
            )
          ) : (
            // Hierarchical tree when not searching
            allTags.length > 0 ? (
              renderTreeNodes(tagTree)
            ) : (
              <div className={styles.emptyNotice}>No tags created yet. Type above to create one.</div>
            )
          )}
        </div>

        {/* Inline Create Section */}
        {searchQuery.trim() && !exactMatch && (
          <div className={styles.createSection}>
            <div className={styles.createLabel}>
              Create tag: <strong>#{searchQuery.trim()}</strong>
            </div>

            <div className={styles.colorPalette}>
              {TAG_COLOR_PALETTE.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`${styles.colorSwatch} ${
                    selectedColor === c.token ? styles.colorSwatchSelected : ''
                  }`}
                  style={{ background: c.token }}
                  onClick={() => setSelectedColor(c.token)}
                  title={c.name}
                />
              ))}
            </div>

            <div className={styles.createButtonRow}>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleCreateInline}
              >
                Create Tag
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TagPicker;
