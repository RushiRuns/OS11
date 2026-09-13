import React, { useState } from 'react';
import type { List } from '@shared/types/List.js';
import { ListItem } from './ListItem.js';
import styles from './SmartListGroup.module.css';

interface SmartListGroupProps {
  smartLists: List[];
  activeListId: string;
  onSelectList: (id: string) => void;
  getTaskCount?: (listId: string) => number;
}

export function SmartListGroup({
  smartLists,
  activeListId,
  onSelectList,
  getTaskCount,
}: SmartListGroupProps): React.ReactElement {
  // Collapsed by default per Phase 6 specification
  const isAnyActive = smartLists.some((l) => l.id === activeListId);
  const [isOpen, setIsOpen] = useState(isAnyActive);

  return (
    <div className={styles.groupContainer}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={styles.headerTitle}>Smart Lists</span>
        <span className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}>
          ▶
        </span>
      </button>

      {isOpen && (
        <div className={styles.listContent}>
          {smartLists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              isActive={activeListId === list.id}
              taskCount={getTaskCount?.(list.id) ?? 0}
              onClick={onSelectList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SmartListGroup;
