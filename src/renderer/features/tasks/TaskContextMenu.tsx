import React, { useState, useEffect } from 'react';
import { useListStore } from '../../stores/listStore.js';
import { DatePicker } from '../../components/DatePicker/DatePicker.js';
import type { Task } from '@shared/types/task.js';
import styles from './TaskContextMenu.module.css';

export interface TaskContextMenuPosition {
  x: number;
  y: number;
}

interface TaskContextMenuProps {
  task: Task | null;
  position: TaskContextMenuPosition | null;
  onClose: () => void;
  onToggleComplete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onSetPriority?: (id: string, priority: number) => void;
  onSetDueDate?: (id: string, date: string | null, time: string | null, allDay: boolean) => void;
  onToggleMyDay?: (id: string) => void;
  onMoveToList?: (id: string, listId: string) => void;
  onDuplicate?: (id: string) => void;
  onCreateSubtask?: (parentId: string) => void;
  onOpenDetail?: (task: Task) => void;
  onDelete?: (id: string) => void;
}

export function TaskContextMenu({
  task,
  position,
  onClose,
  onToggleComplete,
  onToggleStar,
  onSetPriority,
  onSetDueDate,
  onToggleMyDay,
  onMoveToList,
  onDuplicate,
  onCreateSubtask,
  onOpenDetail,
  onDelete,
}: TaskContextMenuProps): React.ReactElement | null {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoveLists, setShowMoveLists] = useState(false);
  const listsById = useListStore((state) => state.listsById);

  useEffect(() => {
    setShowDatePicker(false);
    setShowMoveLists(false);
  }, [task, position]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!task || !position) return null;

  // Prevent overflowing window bounds
  const x = Math.min(position.x, window.innerWidth - 220);
  const y = Math.min(position.y, window.innerHeight - 380);

  const isCompleted = task.is_completed === 1;
  const isStarred = task.is_starred === 1;
  const today = new Date().toISOString().split('T')[0];
  const isInMyDay = task.my_day_date === today;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
        <div
          className={styles.menu}
          style={{ top: `${y}px`, left: `${x}px` }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {/* Complete / Uncomplete */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onToggleComplete?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>{isCompleted ? '↩' : '✓'}</span>
            <span>{isCompleted ? 'Mark Incomplete' : 'Complete Task'}</span>
          </button>

          {/* Star / Unstar */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onToggleStar?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>{isStarred ? '★' : '☆'}</span>
            <span>{isStarred ? 'Remove Star' : 'Star Task'}</span>
          </button>

          {/* My Day */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onToggleMyDay?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>☀️</span>
            <span>{isInMyDay ? 'Remove from My Day' : 'Add to My Day'}</span>
          </button>

          {/* Set Due Date */}
          <button
            type="button"
            className={styles.item}
            onClick={() => setShowDatePicker(true)}
          >
            <span className={styles.itemIcon}>📅</span>
            <span>{task.due_date ? `Due: ${task.due_date}` : 'Set Due Date...'}</span>
          </button>

          <div className={styles.divider} />

          {/* Priority Row */}
          <div className={styles.priorityRow}>
            {[
              { val: 0, label: 'None' },
              { val: 1, label: '!Low' },
              { val: 2, label: '!Med' },
              { val: 3, label: '!High' },
              { val: 4, label: '!Crit' },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                className={`${styles.priorityBtn} ${
                  task.priority === p.val ? styles.priorityBtnActive : ''
                }`}
                onClick={() => {
                  onSetPriority?.(task.id, p.val);
                  onClose();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={styles.divider} />

          {/* Move to List toggle */}
          <button
            type="button"
            className={styles.item}
            onClick={() => setShowMoveLists(!showMoveLists)}
          >
            <span className={styles.itemIcon}>📋</span>
            <span>Move to List...</span>
          </button>

          {showMoveLists && (
            <div className={styles.subListContainer}>
              {Object.values(listsById).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={styles.item}
                  onClick={() => {
                    onMoveToList?.(task.id, l.id);
                    onClose();
                  }}
                >
                  <span className={styles.itemIcon}>{l.icon || '•'}</span>
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Duplicate */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onDuplicate?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>⧉</span>
            <span>Duplicate Task</span>
          </button>

          {/* Create Subtask */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onCreateSubtask?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>↳</span>
            <span>Add Subtask</span>
          </button>

          {/* Open Detail */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onOpenDetail?.(task);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>ℹ️</span>
            <span>Open Details</span>
          </button>

          <div className={styles.divider} />

          {/* Delete */}
          <button
            type="button"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={() => {
              onDelete?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>✕</span>
            <span>Delete Task</span>
          </button>
        </div>
      </div>

      {/* Inline Date Picker modal */}
      {showDatePicker && (
        <DatePicker
          initialDate={task.due_date}
          initialTime={task.due_time}
          initialAllDay={task.all_day === 1}
          position={{ x: x + 215, y }}
          onSelect={(date, time, allDay) => {
            onSetDueDate?.(task.id, date, time, allDay);
            setShowDatePicker(false);
            onClose();
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </>
  );
}

export default TaskContextMenu;
