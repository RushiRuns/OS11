import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectionStore } from '../../stores/selectionStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useListStore } from '../../stores/listStore.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import styles from './BulkActionBar.module.css';

export function BulkActionBar(): React.ReactElement {
  const { selectedIds, isMultiSelectActive, clearSelection } = useSelectionStore();
  const { tasksById, updateTask, deleteTask, restoreTask } = useTaskStore();
  const { listsById } = useListStore();
  const { pushAction } = useUndoRedo();

  const [showPriorityPopover, setShowPriorityPopover] = useState(false);
  const [showMovePopover, setShowMovePopover] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiSelectActive) {
        e.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectActive, clearSelection]);

  const count = selectedIds.size;
  const idsArray = Array.from(selectedIds);

  const handleBulkComplete = async () => {
    const now = new Date().toISOString();
    for (const id of idsArray) {
      await updateTask({ id, is_completed: 1, completed_at: now });
    }
    clearSelection();
  };

  const handleBulkDelete = async () => {
    const targets = idsArray.map((id) => tasksById[id]).filter(Boolean);
    for (const id of idsArray) {
      await deleteTask(id);
    }

    pushAction({
      description: `Deleted ${count} tasks`,
      undoFn: async () => {
        for (const t of targets) {
          await restoreTask(t.id);
        }
      },
      redoFn: async () => {
        for (const t of targets) {
          await deleteTask(t.id);
        }
      },
    });

    clearSelection();
  };

  const handleBulkMove = async (listId: string) => {
    for (const id of idsArray) {
      await updateTask({ id, list_id: listId });
    }
    setShowMovePopover(false);
    clearSelection();
  };

  const handleBulkPriority = async (priority: number) => {
    for (const id of idsArray) {
      await updateTask({ id, priority });
    }
    setShowPriorityPopover(false);
    clearSelection();
  };

  const handleBulkMyDay = async () => {
    const today = new Date().toISOString().split('T')[0];
    for (const id of idsArray) {
      await updateTask({ id, my_day_date: today });
    }
    clearSelection();
  };

  return (
    <AnimatePresence>
      {isMultiSelectActive && count > 0 && (
        <motion.div
          className={styles.barContainer}
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="toolbar"
          aria-label="Bulk actions toolbar"
        >
          <span className={styles.countBadge}>{count} selected</span>

          <div className={styles.actionsGroup}>
            {/* Complete */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleBulkComplete}
              title="Complete all selected tasks"
            >
              <span>✓</span>
              <span>Complete</span>
            </button>

            {/* My Day */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleBulkMyDay}
              title="Add all to My Day"
            >
              <span>☀️</span>
              <span>My Day</span>
            </button>

            {/* Priority Popover Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setShowPriorityPopover(!showPriorityPopover);
                  setShowMovePopover(false);
                }}
                title="Set priority for all"
              >
                <span>!</span>
                <span>Priority</span>
              </button>

              {showPriorityPopover && (
                <div className={styles.priorityPopover}>
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
                      className={styles.actionBtn}
                      onClick={() => handleBulkPriority(p.val)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Move to List Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setShowMovePopover(!showMovePopover);
                  setShowPriorityPopover(false);
                }}
                title="Move all to list"
              >
                <span>📋</span>
                <span>Move</span>
              </button>

              {showMovePopover && (
                <div className={styles.moveListPopover}>
                  {Object.values(listsById).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={styles.moveListItem}
                      onClick={() => handleBulkMove(l.id)}
                    >
                      <span>{l.icon || '•'}</span>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.divider} />

            {/* Delete */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={handleBulkDelete}
              title="Delete all selected tasks"
            >
              <span>✕</span>
              <span>Delete</span>
            </button>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={clearSelection}
            title="Deselect all (Esc)"
            aria-label="Exit multi-select mode"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BulkActionBar;
