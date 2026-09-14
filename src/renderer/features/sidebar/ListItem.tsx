import React, { memo } from 'react';
import type { List } from '@shared/types/List.js';
import styles from './ListItem.module.css';

interface ListItemProps {
  list: List;
  isActive: boolean;
  taskCount?: number;
  onClick: (listId: string) => void;
  onContextMenu?: (e: React.MouseEvent, list: List) => void;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent, listId: string) => void;
  onDragOver?: (e: React.DragEvent, listId: string) => void;
  onDrop?: (e: React.DragEvent, listId: string) => void;
}

export const ListItem = memo(function ListItem({
  list,
  isActive,
  taskCount = 0,
  onClick,
  onContextMenu,
  isDraggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: ListItemProps): React.ReactElement {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick(list.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, list);
    }
  };

  return (
    <button
      type="button"
      className={`${styles.itemButton} ${isActive ? styles.itemActive : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart?.(e, list.id)}
      onDragOver={(e) => onDragOver?.(e, list.id)}
      onDrop={(e) => onDrop?.(e, list.id)}
      aria-selected={isActive}
      aria-label={`${list.name}${taskCount > 0 ? `, ${taskCount} items` : ''}`}
    >
      {list.icon && <span className={styles.icon}>{list.icon}</span>}
      {!list.icon && list.color && (
        <span
          className={styles.colorDot}
          style={{ backgroundColor: list.color }}
        />
      )}
      <span className={styles.label}>{list.name}</span>

      {/* FEEL UI: Pending count badge only rendered when count > 0 */}
      {taskCount > 0 && <span className={styles.badge}>{taskCount}</span>}
    </button>
  );
});

export default ListItem;
