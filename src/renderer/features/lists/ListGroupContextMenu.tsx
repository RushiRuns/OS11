import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ListGroup } from '@shared/types/ListGroup.js';
import type { ListContextMenuPosition } from './ListContextMenu.js';
import styles from './ListContextMenu.module.css';

export interface ListGroupContextMenuProps {
  group: ListGroup;
  position: ListContextMenuPosition | null;
  onClose: () => void;
  onRename: (group: ListGroup) => void;
  onDelete: (group: ListGroup) => void;
}

export function ListGroupContextMenu({
  group,
  position,
  onClose,
  onRename,
  onDelete,
}: ListGroupContextMenuProps): React.ReactElement | null {
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

  // Clamping to avoid viewport overflow
  const menuWidth = 180;
  const menuHeight = 100;
  const posX = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(position.y, window.innerHeight - menuHeight - 8);

  const menuContent = (
    <div
      className={styles.overlay}
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        className={styles.menu}
        style={{ left: posX, top: posY }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onRename(group);
          }}
        >
          <span>✏️</span>
          <span>Rename Folder</span>
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onClose();
            onDelete(group);
          }}
        >
          <span>🗑️</span>
          <span>Delete Folder</span>
        </button>
      </div>
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default ListGroupContextMenu;
