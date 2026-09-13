import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './QuickAdd.module.css';

interface QuickAddProps {
  onAdd: (title: string) => Promise<void> | void;
  placeholder?: string;
}

export function QuickAdd({
  onAdd,
  placeholder = "Add a task (e.g. 'Submit project plan tomorrow at 5pm')...",
}: QuickAddProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onAdd(title.trim());
    setTitle('');
  };

  return (
    <div className={styles.container}>
      <motion.form
        onSubmit={handleSubmit}
        className={styles.quickAddBar}
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.0, 0.0, 0.2, 1.0] }}
      >
        <button
          type="submit"
          className={styles.plusIcon}
          aria-label="Add task"
          disabled={!title.trim()}
        >
          +
        </button>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setTitle('');
              (e.target as HTMLElement).blur();
            }
          }}
        />
        {title.trim() && (
          <button type="submit" className={styles.submitButton}>
            Add Task
          </button>
        )}
      </motion.form>
    </div>
  );
}

export default QuickAdd;
