import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@shared/types/index.js';
import styles from '../lists/ListContextMenu.module.css';

export interface ProjectContextMenuPosition {
  x: number;
  y: number;
}

interface ProjectContextMenuProps {
  project: Project;
  position: ProjectContextMenuPosition | null;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  onTogglePin?: (project: Project) => void;
}

export function ProjectContextMenu({
  project,
  position,
  onClose,
  onEdit,
  onArchive,
  onDelete,
  onTogglePin,
}: ProjectContextMenuProps): React.ReactElement | null {
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

  const menuWidth = 190;
  const menuHeight = 230;
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
        {onTogglePin && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onTogglePin(project);
            }}
          >
            <span>📌</span>
            <span>{project.is_pinned === 1 ? 'Unpin from Top' : 'Pin to Top'}</span>
          </button>
        )}

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onEdit(project);
          }}
        >
          <span>✏️</span>
          <span>Edit Project</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onArchive(project);
          }}
        >
          <span>📦</span>
          <span>{project.status === 'archived' ? 'Unarchive Project' : 'Archive Project'}</span>
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onClose();
            onDelete(project);
          }}
        >
          <span>🗑️</span>
          <span>Delete Project</span>
        </button>
      </div>
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default ProjectContextMenu;
