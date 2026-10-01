import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Area } from '@shared/types/Area.js';
import styles from '../lists/ListContextMenu.module.css';

export interface AreaContextMenuPosition {
  x: number;
  y: number;
}

export interface AreaContextMenuProps {
  area: Area;
  position: AreaContextMenuPosition | null;
  onClose: () => void;
  onRename: (area: Area) => void;
  onDelete: (area: Area) => void;
  onNewProject: (area: Area) => void;
  canDelete: boolean;
  deleteDisabledReason?: string;
}

export function AreaContextMenu({
  area,
  position,
  onClose,
  onRename,
  onDelete,
  onNewProject,
  canDelete,
  deleteDisabledReason,
}: AreaContextMenuProps): React.ReactElement | null {
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

  const menuWidth = 200;
  const menuHeight = 160;
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
        role="menu"
      >
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onNewProject(area);
          }}
          role="menuitem"
        >
          <span className={styles.itemIcon}>+</span>
          <span>New Project</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onRename(area);
          }}
          role="menuitem"
        >
          <span className={styles.itemIcon}>✏️</span>
          <span>Edit Area</span>
        </button>

        <div className={styles.separator} role="separator" />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.deleteItem}`}
          disabled={!canDelete}
          title={!canDelete ? deleteDisabledReason : undefined}
          style={!canDelete ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          onClick={() => {
            if (!canDelete) return;
            onClose();
            onDelete(area);
          }}
          role="menuitem"
        >
          <span className={styles.itemIcon}>🗑️</span>
          <span>Delete Area</span>
        </button>
        {!canDelete && deleteDisabledReason && (
          <div style={{ padding: '4px 12px', fontSize: '11px', color: 'var(--text-tertiary, #888)' }}>
            {deleteDisabledReason}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}

export default AreaContextMenu;
