import React, { useState, useEffect } from 'react';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { DatePicker } from '../../components/DatePicker/DatePicker.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
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
  onMoveTo?: (id: string, destination: { area_id: string | null; project_id: string | null }) => void;
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
  onMoveToList: _onMoveToList,
  onMoveTo,
  onDuplicate,
  onCreateSubtask,
  onOpenDetail,
  onDelete,
}: TaskContextMenuProps): React.ReactElement | null {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoveLists, setShowMoveLists] = useState(false);
  const areas = useAreaStore((state) => state.orderedAreaIds.map((id) => state.areasById[id]).filter(Boolean));
  const projects = useProjectStore((state) => Object.values(state.projectsById).filter((p) => p.status !== 'archived'));
  const updateTask = useTaskStore((state) => state.updateTask);

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

          {/* Move to... toggle */}
          <button
            type="button"
            className={styles.item}
            onClick={() => setShowMoveLists(!showMoveLists)}
          >
            <span className={styles.itemIcon}>↗️</span>
            <span>Move to...</span>
          </button>

          {showMoveLists && (
            <div className={styles.subListContainer}>
              {/* Inbox */}
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  if (onMoveTo) {
                    onMoveTo(task.id, { area_id: null, project_id: null });
                  } else {
                    updateTask({ id: task.id, area_id: null, project_id: null, list_id: null });
                  }
                  onClose();
                }}
              >
                <span className={styles.itemIcon}>📥</span>
                <span>Inbox</span>
              </button>

              {/* Areas & Projects */}
              {areas.map((area) => {
                const areaProjects = projects.filter((p) => p.area_id === area.id);
                return (
                  <React.Fragment key={area.id}>
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => {
                        if (onMoveTo) {
                          onMoveTo(task.id, { area_id: area.id, project_id: null });
                        } else {
                          updateTask({ id: task.id, area_id: area.id, project_id: null, list_id: null });
                        }
                        onClose();
                      }}
                    >
                      <span className={styles.itemIcon}>{area.icon || '📁'}</span>
                      <span>{area.name} (Loose)</span>
                    </button>
                    {areaProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.item}
                        style={{ paddingLeft: '24px' }}
                        onClick={() => {
                          if (onMoveTo) {
                            onMoveTo(task.id, { area_id: p.area_id ?? null, project_id: p.id });
                          } else {
                            updateTask({ id: task.id, area_id: p.area_id ?? null, project_id: p.id, list_id: p.id });
                          }
                          onClose();
                        }}
                      >
                        <span className={styles.itemIcon}>{p.icon || '📁'}</span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </React.Fragment>
                );
              })}
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

          {/* Inspect / DevTools */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              ipc.invoke(IPC.APP.TOGGLE_DEV_TOOLS).catch(() => {});
              onClose();
            }}
          >
            <span className={styles.itemIcon}>🛠️</span>
            <span>Developer Tools</span>
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
