import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectViewMode } from '@shared/types/index.js';
import { renderViewIcon, PlusIcon, CheckIcon } from './ProjectViewIcons.js';
import styles from './ViewSwitcher.module.css';

export type { ProjectViewMode };

export interface ViewSwitcherProps {
  currentView: ProjectViewMode;
  availableViews?: ProjectViewMode[];
  onViewChange: (view: ProjectViewMode) => void;
  onUpdateViews?: (views: ProjectViewMode[]) => void | Promise<void>;
  isCustomizeOpen?: boolean;
  onCustomizeOpenChange?: (open: boolean) => void;
}

const ALL_VIEWS: Array<{ id: ProjectViewMode; label: string }> = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'table', label: 'Table' },
];

export function ViewSwitcher({
  currentView,
  availableViews,
  onViewChange,
  onUpdateViews,
  isCustomizeOpen,
  onCustomizeOpenChange,
}: ViewSwitcherProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const isControlled = isCustomizeOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isMenuOpen = isControlled ? isCustomizeOpen : internalOpen;

  const setIsMenuOpen = (open: boolean) => {
    if (isControlled) {
      onCustomizeOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  };

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    viewId: ProjectViewMode;
    label: string;
  } | null>(null);

  const activeViewsList = availableViews && availableViews.length > 0
    ? availableViews
    : (['list', 'board', 'timeline', 'calendar', 'table'] as ProjectViewMode[]);

  const visibleOptions = ALL_VIEWS.filter((opt) => activeViewsList.includes(opt.id));
  const finalVisibleOptions = visibleOptions.length > 0 ? visibleOptions : [ALL_VIEWS[0]];

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Close context menu on click or Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu]);

  const handleToggleView = (viewId: ProjectViewMode) => {
    if (activeViewsList.includes(viewId)) {
      if (activeViewsList.length <= 1) return;
      const next = activeViewsList.filter((v) => v !== viewId);
      onUpdateViews?.(next);
      if (currentView === viewId) {
        onViewChange(next[0]);
      }
    } else {
      const next = [...activeViewsList, viewId];
      onUpdateViews?.(next);
    }
  };

  const handleRemoveFromContext = (viewId: ProjectViewMode) => {
    if (activeViewsList.length <= 1) return;
    const next = activeViewsList.filter((v) => v !== viewId);
    onUpdateViews?.(next);
    if (currentView === viewId) {
      onViewChange(next[0]);
    }
    setContextMenu(null);
  };

  return (
    <div ref={containerRef} className={styles.switcherWrapper}>
      <div className={styles.switcherContainer} role="tablist" aria-label="Project View Switcher">
        {finalVisibleOptions.map((opt) => {
          const isActive = currentView === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={opt.label}
              className={`${styles.viewButton} ${isActive ? styles.viewButtonActive : ''}`}
              onClick={() => onViewChange(opt.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  x: Math.min(e.clientX, window.innerWidth - 170),
                  y: Math.min(e.clientY, window.innerHeight - 80),
                  viewId: opt.id,
                  label: opt.label,
                });
              }}
            >
              <span className={styles.viewIcon}>{renderViewIcon(opt.id, 15)}</span>
              {isActive && <span className={styles.viewLabel}>{opt.label}</span>}
            </button>
          );
        })}

        <div className={styles.divider} aria-hidden="true" />

        <button
          type="button"
          className={`${styles.addBtn} ${isMenuOpen ? styles.addBtnActive : ''}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Add or remove views"
          title="Add or remove views"
          aria-expanded={isMenuOpen}
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {isMenuOpen && (
        <div className={styles.popoverMenu} role="menu" aria-label="Manage project views">
          <div className={styles.popoverHeader}>Project Views</div>
          {ALL_VIEWS.map((opt) => {
            const isEnabled = activeViewsList.includes(opt.id);
            const isOnlyOne = isEnabled && activeViewsList.length === 1;

            return (
              <button
                key={opt.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isEnabled}
                disabled={isOnlyOne}
                className={styles.popoverItem}
                onClick={() => handleToggleView(opt.id)}
                title={
                  isOnlyOne
                    ? 'A project must have at least one view'
                    : isEnabled
                    ? `Remove ${opt.label} view`
                    : `Add ${opt.label} view`
                }
              >
                <div className={styles.popoverItemLeft}>
                  <span className={styles.viewIcon}>{renderViewIcon(opt.id, 14)}</span>
                  <span>{opt.label}</span>
                </div>
                <span
                  className={`${styles.popoverCheckbox} ${
                    isEnabled ? styles.popoverCheckboxChecked : ''
                  }`}
                >
                  {isEnabled && <CheckIcon size={10} />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {contextMenu &&
        createPortal(
          <div
            className={styles.contextMenuOverlay}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            <div
              className={styles.contextMenu}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.contextMenuItem}
                disabled={activeViewsList.length <= 1}
                onClick={() => handleRemoveFromContext(contextMenu.viewId)}
              >
                <span>✕</span>
                <span>
                  {activeViewsList.length <= 1
                    ? 'Cannot remove only view'
                    : `Remove ${contextMenu.label} view`}
                </span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default ViewSwitcher;
