import React, { useState, useRef, useEffect } from 'react';
import type { ProjectViewMode } from '@shared/types/index.js';
import { renderViewIcon, CheckIcon } from './ProjectViewIcons.js';
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

  const setIsMenuOpen = (open: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof open === 'function' ? open(isMenuOpen) : open;
    if (isControlled) {
      onCustomizeOpenChange?.(nextVal);
    } else {
      setInternalOpen(nextVal);
    }
  };

  const activeViewsList =
    availableViews && availableViews.length > 0
      ? availableViews
      : (['list', 'board', 'timeline', 'calendar', 'table'] as ProjectViewMode[]);

  const currentViewLabel =
    ALL_VIEWS.find((v) => v.id === currentView)?.label || currentView;

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

  const handleViewCycleClick = (e: React.MouseEvent) => {
    // Trackpad / Keyboard shortcut: Ctrl + click (or Cmd + click on macOS) opens the view menu
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setIsMenuOpen((prev) => !prev);
      return;
    }

    // Case 1: Single view enabled - do not cycle
    if (activeViewsList.length <= 1) {
      return;
    }

    // Case 2: Multiple views enabled - cycle in order user enabled them
    const currentIndex = activeViewsList.indexOf(currentView);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % activeViewsList.length;
    const nextView = activeViewsList[nextIndex];
    onViewChange(nextView);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen((prev) => !prev);
  };

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

  const buttonTitle =
    activeViewsList.length <= 1
      ? `Current view: ${currentViewLabel} (Only 1 view enabled. Right-click or Ctrl+click to configure views)`
      : `Current view: ${currentViewLabel}. Click to switch view, Right-click or Ctrl+click to configure views`;

  return (
    <div ref={containerRef} className={styles.switcherWrapper}>
      <button
        type="button"
        className={`${styles.cycleBtn} ${isMenuOpen ? styles.cycleBtnActive : ''}`}
        onClick={handleViewCycleClick}
        onContextMenu={handleContextMenu}
        aria-label={`View switcher: currently ${currentViewLabel}`}
        title={buttonTitle}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <span
          key={currentView}
          className={`${styles.cycleIcon} ${styles.cycleIconAnimate}`}
        >
          {renderViewIcon(currentView, 16)}
        </span>
      </button>

      {isMenuOpen && (
        <div
          className={styles.popoverMenu}
          role="menu"
          aria-label="Manage project views"
        >
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
                  <span className={styles.cycleIcon}>{renderViewIcon(opt.id, 14)}</span>
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
    </div>
  );
}

export default ViewSwitcher;
