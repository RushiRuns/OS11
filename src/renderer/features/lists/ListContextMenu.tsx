import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { List } from '@shared/types/List.js';
import styles from './ListContextMenu.module.css';

export interface ListContextMenuPosition {
  x: number;
  y: number;
}

interface ListContextMenuProps {
  list: List;
  position: ListContextMenuPosition | null;
  onClose: () => void;
  onEdit: (list: List) => void;
  onDuplicate: (list: List) => void;
  onExport: (list: List) => void;
  onDelete: (list: List) => void;
  onTogglePin?: (list: List) => void;
}

export function ListContextMenu({
  list,
  position,
  onClose,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  onTogglePin,
}: ListContextMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!position) return null;

  const isSmart = list.is_smart === 1;
  const isDeletable = list.is_smart !== 1 && list.id !== 'list_inbox';

  // Clamping to avoid viewport overflow
  const menuWidth = 190;
  const menuHeight = 250;
  const posX = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(position.y, window.innerHeight - menuHeight - 8);

  const menuContent = (
    <div className={styles.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: posX, top: posY }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isSmart && onTogglePin && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onTogglePin(list);
            }}
          >
            <span>📌</span>
            <span>{list.is_pinned === 1 ? 'Unpin from Top' : 'Pin to Top'}</span>
          </button>
        )}

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onEdit(list);
          }}
        >
          <span>✏️</span>
          <span>Rename & Edit</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onDuplicate(list);
          }}
          disabled={isSmart}
        >
          <span>📋</span>
          <span>Duplicate List</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onExport(list);
          }}
        >
          <span>📤</span>
          <span>Export List</span>
        </button>

        {isDeletable && (
          <>
            <div className={styles.separator} />
            <button
              type="button"
              className={`${styles.menuItem} ${styles.menuItemDanger}`}
              onClick={() => {
                onClose();
                onDelete(list);
              }}
            >
              <span>🗑️</span>
              <span>Delete List</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default ListContextMenu;
