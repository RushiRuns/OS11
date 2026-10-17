import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getRadixPortalContainer } from '../../components/primitives/portal.js';
import contextMenuStyles from '../tasks/TaskContextMenu.module.css';
import detailStyles from './GoalDetail.module.css';

export interface GoalDropdownOption {
  id: string;
  label: string;
  value: string | null;
}

export interface GoalDropdownMenuProps {
  icon?: React.ReactNode;
  chipText: string;
  items: GoalDropdownOption[];
  currentValue: string | null;
  onSelect: (value: string | null) => void;
  ariaLabel: string;
  disabled?: boolean;
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export const GoalDropdownMenu: React.FC<GoalDropdownMenuProps> = ({
  icon,
  chipText,
  items,
  currentValue,
  onSelect,
  ariaLabel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  const chipRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    const menuHeight = items.length * 30 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipsAbove = spaceBelow < menuHeight && rect.top > menuHeight;

    setMenuPosition({
      top: flipsAbove ? rect.top - menuHeight - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8)),
      minWidth: rect.width,
    });
  }, [items.length]);

  const handleOpen = () => {
    if (disabled) return;
    const initialIdx = items.findIndex((item) => item.value === currentValue);
    setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    chipRef.current?.focus();
  }, []);

  const handlePick = useCallback(
    (val: string | null) => {
      onSelect(val);
      handleClose();
    },
    [onSelect, handleClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[highlightedIndex]) {
          handlePick(items[highlightedIndex].value);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, items, handlePick, handleClose]);

  // Reposition on scroll or resize while open
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const portalContainer = getRadixPortalContainer();

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={detailStyles.metaPill}
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        {icon && <span className={detailStyles.metaChipIcon}>{icon}</span>}
        <span className={detailStyles.metaChipText}>{chipText}</span>
        <span className={detailStyles.metaChipChevron}>
          <ChevronDownIcon />
        </span>
      </button>

      {isOpen &&
        createPortal(
          <>
            <div
              className={contextMenuStyles.backdrop}
              onClick={handleClose}
              onContextMenu={(e) => {
                e.preventDefault();
                handleClose();
              }}
            />
            <div
              ref={menuRef}
              className={contextMenuStyles.menu}
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                minWidth: `${menuPosition.minWidth}px`,
                width: 'auto',
              }}
              role="menu"
              aria-label={ariaLabel}
            >
              {items.map((item, idx) => {
                const isSelected = item.value === currentValue;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    className={`${contextMenuStyles.item} ${isHighlighted ? contextMenuStyles.itemHighlighted : ''}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handlePick(item.value)}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </>,
          portalContainer || document.body
        )}
    </>
  );
};

export default GoalDropdownMenu;
