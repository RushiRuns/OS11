import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTaskStore } from '../../stores/task-store.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { Task } from '../../../shared/types/task.js';
import styles from './DetailPanel.module.css';

interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export function DetailPanel({ task, onClose }: DetailPanelProps): React.ReactElement {
  const { updateTask } = useTaskStore();
  const shouldReduceMotion = useReducedMotion();
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');

  useEffect(() => {
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
  }, [task]);

  if (!task) {
    return (
      <div className={styles.panelContainer}>
        <EmptyState
          title="No Task Selected"
          description="Select a task from the list to view and edit its details."
        />
      </div>
    );
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      updateTask({ id: task.id, title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== task.notes) {
      updateTask({ id: task.id, notes });
    }
  };

  return (
    <motion.aside
      className={styles.panelContainer}
      aria-label="Task Detail Panel"
      initial={shouldReduceMotion ? false : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { x: 40, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1.0] }} // --ease-spring
    >
      <div className={styles.header}>
        <span className={styles.headerTitle}>Task Details</span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close detail panel"
        >
          ✕
        </button>
      </div>

      <div className={styles.content}>
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Task title"
        />

        <div className={styles.section}>
          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.notesArea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add detailed notes or descriptions..."
          />
        </div>

        <div className={styles.section}>
          <div className={styles.metadataRow}>
            <span className={styles.metaLabel}>Priority</span>
            <span className={styles.metaValue}>
              {['None', 'Low', 'Medium', 'High', 'Critical'][task.priority] ?? 'None'}
            </span>
          </div>

          <div className={styles.metadataRow}>
            <span className={styles.metaLabel}>Status</span>
            <span className={styles.metaValue}>
              {task.is_completed === 1 ? 'Completed' : 'Pending'}
            </span>
          </div>

          {task.due_date && (
            <div className={styles.metadataRow}>
              <span className={styles.metaLabel}>Due Date</span>
              <span className={styles.metaValue}>{task.due_date}</span>
            </div>
          )}

          <div className={styles.metadataRow}>
            <span className={styles.metaLabel}>Created</span>
            <span className={styles.metaValue}>
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export default DetailPanel;
