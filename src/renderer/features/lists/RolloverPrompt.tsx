import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore.js';
import styles from './RolloverPrompt.module.css';

export function RolloverPrompt(): React.ReactElement | null {
  const { tasksById, updateTask } = useTaskStore();
  const [isDismissed, setIsDismissed] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Tasks from yesterday or earlier that were in My Day but not finished
  const expiredTasks = useMemo(() => {
    return Object.values(tasksById).filter(
      (t) =>
        t.is_trashed === 0 &&
        t.is_completed === 0 &&
        Boolean(t.my_day_date && t.my_day_date < today)
    );
  }, [tasksById, today]);

  // Selected task IDs for cherry-picking
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(expiredTasks.map((t) => t.id))
  );

  // Sync selectedIds when expiredTasks change
  React.useEffect(() => {
    setSelectedIds(new Set(expiredTasks.map((t) => t.id)));
  }, [expiredTasks]);

  if (isDismissed || expiredTasks.length === 0) {
    return null;
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleKeepSelected = async () => {
    for (const task of expiredTasks) {
      if (selectedIds.has(task.id)) {
        await updateTask({ id: task.id, my_day_date: today });
      } else {
        await updateTask({ id: task.id, my_day_date: null });
      }
    }
    setIsDismissed(true);
  };

  const handleDismissAll = async () => {
    for (const task of expiredTasks) {
      await updateTask({ id: task.id, my_day_date: null });
    }
    setIsDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        className={styles.banner}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <div className={styles.title}>
            <span>☀️</span>
            <span>Yesterday&apos;s Incomplete Tasks</span>
          </div>
        </div>

        <div className={styles.description}>
          You have {expiredTasks.length} task{expiredTasks.length > 1 ? 's' : ''} left from previous days. Would you like to roll them over into Today?
        </div>

        <div className={styles.taskList}>
          {expiredTasks.map((task) => (
            <label key={task.id} className={styles.taskItem}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selectedIds.has(task.id)}
                onChange={() => toggleSelect(task.id)}
              />
              <span className={styles.taskTitle}>{task.title}</span>
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={handleDismissAll}
          >
            Dismiss All
          </button>
          <button
            type="button"
            className={styles.keepBtn}
            onClick={handleKeepSelected}
          >
            {selectedIds.size === expiredTasks.length
              ? 'Keep All in Today'
              : `Keep Selected (${selectedIds.size})`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default RolloverPrompt;
