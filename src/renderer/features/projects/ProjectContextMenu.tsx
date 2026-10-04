import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@shared/types/index.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
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
  onMoveToArea?: (project: Project, areaId: string) => void;
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
  onMoveToArea,
}: ProjectContextMenuProps): React.ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAreaSubmenu, setShowAreaSubmenu] = useState(false);
  const { areasById, orderedAreaIds } = useAreaStore();
  const updateProject = useProjectStore((state) => state.updateProject);
  const isSomedayEnabled = useModuleStore((state) => state.isEnabled('someday'));

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
  const submenuHeight = Math.min(320, (orderedAreaIds.length + 1) * 32);
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
        {/* Pin / Unpin */}
        {onTogglePin && (
          <button
            type="button"
            className={styles.menuItem}
            onMouseEnter={() => setShowAreaSubmenu(false)}
            onClick={() => {
              onClose();
              onTogglePin(project);
            }}
          >
            <span>📌</span>
            <span>{(project.is_pinned ?? 0) === 1 ? 'Unpin from Top' : 'Pin to Top'}</span>
          </button>
        )}

        <button
          type="button"
          className={styles.menuItem}
          onMouseEnter={() => setShowAreaSubmenu(false)}
          onClick={() => {
            onClose();
            onEdit(project);
          }}
        >
          <span>✏️</span>
          <span>Edit Project</span>
        </button>

        {/* Move to Area */}
        <button
          type="button"
          className={`${styles.menuItem} ${styles.submenuTrigger}`}
          onMouseEnter={() => setShowAreaSubmenu(true)}
          onClick={() => setShowAreaSubmenu((v) => !v)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span>📁</span>
            <span>Move to Area</span>
          </span>
          <span className={styles.submenuArrow}>▸</span>
        </button>

        <button
          type="button"
          className={styles.menuItem}
          onMouseEnter={() => setShowAreaSubmenu(false)}
          onClick={() => {
            onClose();
            onArchive(project);
          }}
        >
          <span>📦</span>
          <span>{project.status === 'archived' ? 'Unarchive Project' : 'Archive Project'}</span>
        </button>

        {isSomedayEnabled && (
          <button
            type="button"
            className={styles.menuItem}
            onMouseEnter={() => setShowAreaSubmenu(false)}
            onClick={async () => {
              onClose();
              if (project.is_someday === 1 || project.status === 'parked') {
                await updateProject(project.id, { is_someday: 0, status: 'active' });
              } else {
                await updateProject(project.id, { is_someday: 1, status: 'parked' });
              }
            }}
          >
            <span>{project.is_someday === 1 ? '🚀' : '📦'}</span>
            <span>{project.is_someday === 1 ? 'Unpark Project' : 'Park in Someday'}</span>
          </button>
        )}

        <div className={styles.separator} />

        <button
          type="button"
          className={styles.menuItem}
          onMouseEnter={() => setShowAreaSubmenu(false)}
          onClick={() => {
            onClose();
            ipc.invoke(IPC.APP.TOGGLE_DEV_TOOLS).catch(() => {});
          }}
        >
          <span>🛠️</span>
          <span>Developer Tools</span>
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onMouseEnter={() => setShowAreaSubmenu(false)}
          onClick={() => {
            onClose();
            onDelete(project);
          }}
        >
          <span>🗑️</span>
          <span>Delete Project</span>
        </button>
      </div>

      {/* Submenu for Areas */}
      {showAreaSubmenu && (
        <div
          className={styles.menu}
          style={{
            left: submenuPosX,
            top: submenuPosY,
            minWidth: submenuWidth,
            zIndex: 1002,
          }}
          onMouseEnter={() => setShowAreaSubmenu(true)}
          onClick={(e) => e.stopPropagation()}
        >
          {orderedAreaIds.map((aid) => {
            const area = areasById[aid];
            if (!area) return null;
            const isSelected = project.area_id === area.id;
            return (
              <button
                key={area.id}
                type="button"
                className={styles.menuItem}
                onClick={async () => {
                  onClose();
                  if (onMoveToArea) {
                    onMoveToArea(project, area.id);
                  } else {
                    await updateProject(project.id, { area_id: area.id });
                  }
                }}
              >
                <span className={styles.checkIcon}>{isSelected ? '✓' : ''}</span>
                <span>{area.icon || '📁'} {area.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const portalRoot = document.getElementById('radix-portal') || document.body;
  return createPortal(menuContent, portalRoot);
}

export default ProjectContextMenu;
