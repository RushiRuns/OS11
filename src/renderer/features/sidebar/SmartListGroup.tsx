import React, { useState } from 'react';
import type { List } from '@shared/types/List.js';
import { useTaskStore } from '../../stores/taskStore.js';
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
              onDragOver={(e) => {
                if (list.id === 'smart_my_day') {
                  e.preventDefault();
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId && list.id === 'smart_my_day') {
                  const today = new Date().toISOString().split('T')[0];
                  useTaskStore.getState().updateTask({ id: taskId, my_day_date: today });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SmartListGroup;
