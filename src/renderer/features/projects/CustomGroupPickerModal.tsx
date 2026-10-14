import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import type { CustomGroup } from '@shared/types/index.js';
import styles from './CustomGroupPickerModal.module.css';

interface CustomGroupPickerModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditor: (group?: CustomGroup | null) => void;
}

export function CustomGroupPickerModal({
  projectId,
  isOpen,
  onClose,
  onOpenEditor,
}: CustomGroupPickerModalProps): React.ReactElement {
  const { loadGroups, markGroupUsed, setActiveProjectAndGroup } = useCustomGroupStore();
  const storeGroups = useCustomGroupStore((state) => state.groups);
  const groups = typeof window === 'undefined' ? useCustomGroupStore.getState().groups : storeGroups;

  const viewId = `project:${projectId}`;
  const hookActiveGroupId = useViewGroupStore((state) => state.getActiveCustomGroup(viewId));
  const activeGroupId = typeof window === 'undefined' ? useViewGroupStore.getState().getActiveCustomGroup(viewId) : hookActiveGroupId;
  const hookGroupBy = useViewGroupStore((state) => state.getGroupBy(viewId));
  const currentGroupBy = typeof window === 'undefined' ? useViewGroupStore.getState().getGroupBy(viewId) : hookGroupBy;
  const { setActiveCustomGroup, setGroupBy } = useViewGroupStore.getState();

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadGroups();
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, loadGroups]);

  // Sort groups by MRU (last_used_at desc, then sort_order / name)
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.last_used_at && b.last_used_at) {
        return b.last_used_at.localeCompare(a.last_used_at);
      }
      if (a.last_used_at) return -1;
      if (b.last_used_at) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [groups]);

  // Filter groups by query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedGroups;
    return sortedGroups.filter((g) => {
      if (g.name.toLowerCase().includes(q)) return true;
      return g.sections?.some((s) => s.name.toLowerCase().includes(q));
    });
  }, [sortedGroups, searchQuery]);

  // Total selectable items: index 0 is "None", followed by filteredGroups (indices 1 .. filteredGroups.length)
  const totalItems = 1 + filteredGroups.length;

  const handleSelectNone = () => {
    setActiveCustomGroup(viewId, null);
    setGroupBy(viewId, 'none');
    setActiveProjectAndGroup(projectId, null);
    onClose();
  };

  const handleSelectGroup = async (group: CustomGroup) => {
    await markGroupUsed(group.id);
    setActiveCustomGroup(viewId, group.id);
    setGroupBy(viewId, 'custom');
    await setActiveProjectAndGroup(projectId, group.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex === 0) {
        handleSelectNone();
      } else {
        const selectedGroup = filteredGroups[highlightedIndex - 1];
        if (selectedGroup) {
          handleSelectGroup(selectedGroup);
        }
      }
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Group by Custom"
      description="Select a custom group to partition tasks under its sections."
    >
      <div className={styles.container} onKeyDown={handleKeyDown}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search custom groups..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            aria-label="Search custom groups"
          />
        </div>

        {groups.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              No custom groups yet. Create one to organize tasks into custom sections.
            </p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => onOpenEditor(null)}
            >
              Create custom group
            </button>
          </div>
        ) : (
          <div className={styles.list} role="listbox">
            {/* None Option */}
            <div
              role="option"
              aria-selected={highlightedIndex === 0}
              data-focused={highlightedIndex === 0}
              data-active={currentGroupBy === 'none' || (!activeGroupId && currentGroupBy !== 'custom')}
              className={styles.item}
              onClick={handleSelectNone}
              onMouseEnter={() => setHighlightedIndex(0)}
            >
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>None</span>
                  {(currentGroupBy === 'none' || (!activeGroupId && currentGroupBy !== 'custom')) && (
                    <span className={styles.activeCheck}>✓</span>
                  )}
                </div>
                <span className={styles.sectionPreview}>Switch custom grouping off</span>
              </div>
            </div>

            <div className={styles.divider} />

            {/* Filtered Groups */}
            {filteredGroups.map((group, idx) => {
              const itemIndex = idx + 1;
              const isSelected = activeGroupId === group.id && currentGroupBy === 'custom';
              const sectionNames = group.sections?.map((s) => s.name) ?? [];
              const previewText =
                sectionNames.length > 0
                  ? sectionNames.length <= 3
                    ? sectionNames.join(', ')
                    : `${sectionNames.slice(0, 3).join(', ')} (+${sectionNames.length - 3} more)`
                  : 'No sections';

              return (
                <div
                  key={group.id}
                  role="option"
                  aria-selected={highlightedIndex === itemIndex}
                  data-focused={highlightedIndex === itemIndex}
                  data-active={isSelected}
                  className={styles.item}
                  onClick={() => handleSelectGroup(group)}
                  onMouseEnter={() => setHighlightedIndex(itemIndex)}
                >
                  <div className={styles.itemContent}>
                    <div className={styles.itemHeader}>
                      <span className={styles.itemName}>{group.name}</span>
                      {isSelected && <span className={styles.activeCheck}>✓</span>}
                    </div>
                    <span className={styles.sectionPreview}>{previewText}</span>
                  </div>

                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.editButton}
                      title={`Edit ${group.name}`}
                      aria-label={`Edit ${group.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEditor(group);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.newGroupBtn}
            onClick={() => onOpenEditor(null)}
          >
            <span>+</span>
            <span>New custom group</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
