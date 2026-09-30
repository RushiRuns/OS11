import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@shared/types/index.js';
import { useListStore } from '../../stores/listStore.js';
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
  onMoveToGroup?: (project: Project, groupId: string | null) => void;
  onCreateGroupAndMove?: (project: Project) => void;
}

export function ProjectContextMenu({
  project,
  position,
  onClose,
  onEdit,
  onArchive,
  onDelete,
  onTogglePin,
  onMoveToGroup,
  onCreateGroupAndMove,
}: ProjectContextMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const { listGroupsById, orderedGroupIds } = useListStore();

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
  const menuHeight = 240;
  const posX = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const posY = Math.min(position.y, window.innerHeight - menuHeight - 8);

  const submenuWidth = 180;
  const submenuHeight = Math.min(320, (orderedGroupIds.length + 3) * 32);
  const submenuPosX =
    posX + menuWidth + submenuWidth <= window.innerWidth - 8
      ? posX + menuWidth - 4
      : Math.max(8, posX - submenuWidth + 4);
  const submenuPosY = Math.min(Math.max(8, posY + 65), window.innerHeight - submenuHeight - 8);

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
            onMouseEnter={() => setShowFolderSubmenu(false)}
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
          onMouseEnter={() => setShowFolderSubmenu(false)}
          onClick={() => {
            onClose();
            onEdit(project);
          }}
        >
          <span>✏️</span>
          <span>Edit Project</span>
        </button>

        {/* Move to Folder */}
        <button
          type="button"
          className={`${styles.menuItem} ${styles.submenuTrigger}`}
          onMouseEnter={() => setShowFolderSubmenu(true)}
          onClick={() => setShowFolderSubmenu((v) => !v)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>📁</span>
            <span>Move to Folder</span>
          </span>
          <span className={styles.submenuArrow}>▸</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onMouseEnter={() => setShowFolderSubmenu(false)}
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
          onMouseEnter={() => setShowFolderSubmenu(false)}
          onClick={() => {
            onClose();
            onDelete(project);
          }}
        >
          <span>🗑️</span>
          <span>Delete Project</span>
        </button>
      </div>

      {/* Submenu for Folders */}
      {showFolderSubmenu && (
        <div
          className={styles.menu}
          style={{
            left: submenuPosX,
            top: submenuPosY,
            minWidth: submenuWidth,
            zIndex: 1002,
          }}
          onMouseEnter={() => setShowFolderSubmenu(true)}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onMoveToGroup?.(project, null);
            }}
          >
            <span className={styles.checkIcon}>{!project.group_id ? '✓' : ''}</span>
            <span>No folder (Root)</span>
          </button>

          {orderedGroupIds.length > 0 && <div className={styles.separator} />}

          {orderedGroupIds.map((gid) => {
            const grp = listGroupsById[gid];
            if (!grp) return null;
            const isSelected = project.group_id === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onClose();
                  onMoveToGroup?.(project, grp.id);
                }}
              >
                <span className={styles.checkIcon}>{isSelected ? '✓' : ''}</span>
                <span>📁 {grp.name}</span>
              </button>
            );
          })}

          <div className={styles.separator} />

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onCreateGroupAndMove?.(project);
            }}
          >
            <span className={styles.emptyCheck} />
            <span>+ New Folder...</span>
          </button>
        </div>
      )}
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default ProjectContextMenu;
