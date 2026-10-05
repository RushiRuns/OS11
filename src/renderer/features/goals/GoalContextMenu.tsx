import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Goal } from '../../../shared/types/Goal.js';
import styles from './GoalContextMenu.module.css';

export interface GoalContextMenuPosition {
  x: number;
  y: number;
}

export interface GoalContextMenuProps {
  goal: Goal;
  position: GoalContextMenuPosition | null;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
  onDuplicate: (goal: Goal) => void;
  onToggleComplete: (goal: Goal) => void;
  onTogglePause: (goal: Goal) => void;
  onToggleArchive: (goal: Goal) => void;
  onLinkResource: (goal: Goal) => void;
  onViewHistory: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}

export function GoalContextMenu({
  goal,
  position,
  onClose,
  onEdit,
  onDuplicate,
  onToggleComplete,
  onTogglePause,
  onToggleArchive,
  onLinkResource,
  onViewHistory,
  onDelete,
}: GoalContextMenuProps): React.ReactElement | null {
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
  const menuHeight = 280;
  const posX = Math.max(12, Math.min(position.x, window.innerWidth - menuWidth - 12));
  const posY = Math.max(12, Math.min(position.y, window.innerHeight - menuHeight - 12));

  const isCompleted = goal.status === 'completed';
  const isPaused = goal.status === 'paused';
  const isArchived = goal.status === 'archived';

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
        {/* Edit */}
        {!isArchived && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onEdit(goal);
            }}
          >
            <span className={styles.menuItemIcon}>✏️</span>
            <span>Edit Goal</span>
          </button>
        )}

        {/* Duplicate */}
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onDuplicate(goal);
          }}
        >
          <span className={styles.menuItemIcon}>📋</span>
          <span>Duplicate Goal</span>
        </button>

        {/* Link Resource */}
        {!isArchived && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onLinkResource(goal);
            }}
          >
            <span className={styles.menuItemIcon}>🔗</span>
            <span>Link Resource...</span>
          </button>
        )}

        {/* View Progress History */}
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onViewHistory(goal);
          }}
        >
          <span className={styles.menuItemIcon}>📈</span>
          <span>Progress History</span>
        </button>

        <div className={styles.separator} />

        {/* Complete / Reopen */}
        {isCompleted ? (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onToggleComplete(goal);
            }}
          >
            <span className={styles.menuItemIcon}>↺</span>
            <span>Reopen Goal</span>
          </button>
        ) : !isArchived ? (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onToggleComplete(goal);
            }}
          >
            <span className={styles.menuItemIcon}>✓</span>
            <span>Mark as Completed</span>
          </button>
        ) : null}

        {/* Pause / Resume */}
        {!isArchived && !isCompleted && (
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onTogglePause(goal);
            }}
          >
            <span className={styles.menuItemIcon}>{isPaused ? '▶' : '⏸'}</span>
            <span>{isPaused ? 'Resume Goal' : 'Pause Goal'}</span>
          </button>
        )}

        {/* Archive / Unarchive */}
        <button
          type="button"
          className={styles.menuItem}
          onClick={() => {
            onClose();
            onToggleArchive(goal);
          }}
        >
          <span className={styles.menuItemIcon}>{isArchived ? '↺' : '📦'}</span>
          <span>{isArchived ? 'Unarchive Goal' : 'Archive Goal'}</span>
        </button>

        <div className={styles.separator} />

        {/* Delete */}
        <button
          type="button"
          className={`${styles.menuItem} ${styles.menuItemDanger}`}
          onClick={() => {
            onClose();
            onDelete(goal);
          }}
        >
          <span className={styles.menuItemIcon}>🗑️</span>
          <span>Delete Goal</span>
        </button>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
}

export default GoalContextMenu;
