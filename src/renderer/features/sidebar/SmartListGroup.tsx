import React, { useState } from 'react';
import type { List } from '@shared/types/List.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useUndoRedoStore } from '../../hooks/useUndoRedo.js';
import { toISODateOnly } from '@shared/utils/date.js';
import { SMART_LISTS } from '@shared/constants/index.js';
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
                if (list.id === SMART_LISTS.MY_DAY) {
                  e.preventDefault();
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId && list.id === SMART_LISTS.MY_DAY) {
                  const originalTask = useTaskStore.getState().tasksById[taskId]
                    ? { ...useTaskStore.getState().tasksById[taskId] }
                    : null;
                  try {
                    const today = toISODateOnly(new Date());
                    await useTaskStore.getState().updateTask({ id: taskId, my_day_date: today, bucket: null });
                    if (originalTask) {
                      useUndoRedoStore.getState().pushAction({
                        description: `Moved "${originalTask.title}" to My Day`,
                        undoFn: async () => {
                          await useTaskStore.getState().updateTask({
                            id: taskId,
                            bucket: originalTask.bucket ?? null,
                            my_day_date: originalTask.my_day_date ?? null,
                            project_id: originalTask.project_id ?? null,
                            area_id: originalTask.area_id ?? null,
                            list_id: originalTask.list_id ?? null,
                            due_date: originalTask.due_date ?? null,
                            due_time: originalTask.due_time ?? null,
                            waiting_on: originalTask.waiting_on ?? null,
                            waiting_since: originalTask.waiting_since ?? null,
                            follow_up_date: originalTask.follow_up_date ?? null,
                          });
                        },
                      });
                    }
                  } catch (err) {
                    console.error('[SmartListGroup] Failed to update task on drop:', err);
                  }
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
