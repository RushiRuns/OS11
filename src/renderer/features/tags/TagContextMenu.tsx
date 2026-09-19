import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Tag } from '@shared/types/Tag.js';
import styles from '../lists/ListContextMenu.module.css';

export interface TagContextMenuPosition {
  x: number;
  y: number;
}

interface TagContextMenuProps {
  tag: Tag | null;
  position: TagContextMenuPosition | null;
  onClose: () => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}

export function TagContextMenu({
  tag,
  position,
  onClose,
  onEdit,
  onDelete,
}: TagContextMenuProps): React.ReactElement | null {
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

  if (!position || !tag) return null;

  const menuWidth = 180;
  const menuHeight = 120;
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
            onEdit(tag);
          }}
        >
          <span>✏️</span>
          <span>Edit Tag</span>
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onClose();
            onDelete(tag);
          }}
        >
          <span>🗑️</span>
          <span>Delete Tag</span>
        </button>
      </div>
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default TagContextMenu;
