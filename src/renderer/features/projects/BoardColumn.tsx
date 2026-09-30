import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Section, Task } from '@shared/types/index.js';
import { BoardCard } from './BoardCard.js';
import styles from './BoardColumn.module.css';
import menuStyles from '../lists/ListContextMenu.module.css';

export interface BoardColumnProps {
  section: Section;
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask: (task: Task) => void;
  onToggleComplete: (id: string) => void;
  onTaskContextMenu: (e: React.MouseEvent, task: Task) => void;
  onAddCard: (sectionId: string, title: string) => void;
  onRenameSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
}

export function BoardColumn({
  section,
  tasks,
  selectedTaskId,
  onSelectTask,
  onToggleComplete,
  onTaskContextMenu,
  onAddCard,
  onRenameSection,
  onDeleteSection,
}: BoardColumnProps): React.ReactElement {
  // Droppable setup
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col_${section.id}`,
  });

  // Local states
  const [addCardTitle, setAddCardTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Menu states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  // Focus rename input on entering edit mode
  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    setRenameValue(section.name);
  }, [section.name]);

  // Click outside and Esc handler for column menu
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuDropdownRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsMenuOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Toggle column menu with viewport clamping
  const handleToggleMenu = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }

    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const menuWidth = 160;
      const x = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8);
      const y = rect.bottom + 4;
      setMenuPos({ x: Math.max(8, x), y });
      setIsMenuOpen(true);
    }
  };

  // Save rename
  const handleSaveRename = () => {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== section.name) {
      onRenameSection(section.id, trimmed);
    } else {
      setRenameValue(section.name);
    }
  };

  // Add card submission
  const handleAddCardKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = addCardTitle.trim();
      if (trimmed) {
        onAddCard(section.id, trimmed);
        setAddCardTitle('');
      }
    } else if (e.key === 'Escape') {
      setAddCardTitle('');
      (e.target as HTMLInputElement).blur();
    }
  };

  // Metrics for Column Ring SVG
  const totalCount = tasks.length;
  const completedCount = useMemo(
    () => tasks.filter((t) => t.is_completed === 1).length,
    [tasks]
  );
  const colPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const colRadius = 7.5;
  const colCircumference = 2 * Math.PI * colRadius;
  const colOffset = colCircumference - (colPercent / 100) * colCircumference;

  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div className={styles.column} id={`col_${section.id}`}>
      {/* Column Header */}
      <div className={styles.columnHeader}>
        <div className={styles.columnHeaderLeft}>
          <svg className={styles.columnRingSvg} viewBox="0 0 20 20" aria-hidden="true">
            <circle className={styles.columnRingBg} cx="10" cy="10" r={colRadius} />
            <circle
              className={`${styles.columnRingProg} ${
                colPercent === 100 ? styles.columnRingProgComplete : ''
              }`}
              cx="10"
              cy="10"
              r={colRadius}
              style={{
                strokeDasharray: colCircumference,
                strokeDashoffset: colOffset,
              }}
            />
          </svg>

          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              className={styles.columnTitleInput}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setRenameValue(section.name);
                }
              }}
              aria-label="Column name"
            />
          ) : (
            <span
              className={styles.columnTitle}
              title={section.name}
              onDoubleClick={() => setIsRenaming(true)}
            >
              {section.name}
            </span>
          )}

          <span className={styles.columnCountBadge} aria-label={`${totalCount} tasks in column`}>
            {totalCount}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.columnMenuBtn}
            onClick={handleToggleMenu}
            aria-label={`Actions for column ${section.name}`}
            title="Column actions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="5" cy="12" r="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Column Menu Portal */}
      {isMenuOpen &&
        menuPos &&
        ReactDOM.createPortal(
          <>
            <div
              className={menuStyles.overlay}
              onClick={() => setIsMenuOpen(false)}
            />
            <div
              ref={menuDropdownRef}
              className={menuStyles.menu}
              style={{
                left: menuPos.x,
                top: menuPos.y,
                minWidth: '150px',
                zIndex: 1001,
              }}
              role="menu"
            >
              <button
                type="button"
                className={menuStyles.menuItem}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsRenaming(true);
                }}
                role="menuitem"
              >
                <span>✏️</span>
                <span>Rename Column</span>
              </button>

              <div className={menuStyles.separator} />

              <button
                type="button"
                className={`${menuStyles.menuItem} ${menuStyles.menuItemDanger}`}
                onClick={() => {
                  setIsMenuOpen(false);
                  if (
                    window.confirm(
                      `Are you sure you want to delete the column "${section.name}"? Tasks in it will remain in the project.`
                    )
                  ) {
                    onDeleteSection(section.id);
                  }
                }}
                role="menuitem"
              >
                <span>🗑️</span>
                <span>Delete Column</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {/* Droppable Column Body with Sortable cards */}
      <div
        ref={setDroppableRef}
        className={styles.columnBody}
        data-dragover={isOver ? 'true' : 'false'}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
              onSelect={onSelectTask}
              onToggleComplete={onToggleComplete}
              onContextMenu={onTaskContextMenu}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className={styles.emptyColumn}>
            <span>Drop cards here</span>
          </div>
        )}
      </div>

      {/* Column Footer: Add Card Input */}
      <div className={styles.columnFooter}>
        <input
          type="text"
          className={styles.addCardInput}
          placeholder="+ Add a card..."
          aria-label={`Add card to ${section.name}`}
          value={addCardTitle}
          onChange={(e) => setAddCardTitle(e.target.value)}
          onKeyDown={handleAddCardKeyDown}
        />
      </div>
    </div>
  );
}

export default BoardColumn;
