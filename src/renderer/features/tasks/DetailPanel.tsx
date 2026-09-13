import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { useTaskStore, useSubtasks } from '../../stores/taskStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import type { Task } from '@shared/types/task.js';
import styles from './DetailPanel.module.css';

export interface DetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

export function DetailPanel({ task, onClose }: DetailPanelProps): React.ReactElement {
  const { updateTask, toggleComplete, createTask } = useTaskStore();
  const shouldReduceMotion = useReducedMotion();

  const [title, setTitle] = useState(task?.title ?? '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const subtasks = useSubtasks(task?.id ?? '');

  // TipTap Rich Text Editor for Notes
  const editor = useEditor({
    extensions: [StarterKit],
    content: task?.notes ?? '',
    onBlur: ({ editor: currentEditor }) => {
      if (!task) return;
      const html = currentEditor.getHTML();
      const sanitized = DOMPurify.sanitize(html);
      if (sanitized !== task.notes) {
        updateTask({ id: task.id, notes: sanitized });
      }
    },
  });

  // Sync state on task change
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      if (editor && editor.getHTML() !== (task.notes ?? '')) {
        editor.commands.setContent(task.notes ?? '');
      }
    }
  }, [task, editor]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!task) {
    return (
      <aside className={styles.panelContainer} aria-label="Task Detail Panel">
        <EmptyState
          title="No Task Selected"
          description="Select a task from the list to view its details."
        />
      </aside>
    );
  }

  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== task.title) {
      updateTask({ id: task.id, title: title.trim() });
    } else {
      setTitle(task.title);
    }
  };

  const handleAddSubtask = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      await createTask({
        title: newSubtaskTitle.trim(),
        list_id: task.list_id,
        project_id: task.project_id,
        parent_task_id: task.id,
      });
      setNewSubtaskTitle('');
    }
  };

  const isMyDay = Boolean(task.my_day_date);

  return (
    <motion.aside
      className={styles.panelContainer}
      aria-label="Task Detail Panel"
      initial={shouldReduceMotion ? false : { x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { x: 320, opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }} // Framer Motion Site #2
    >
      {/* Header */}
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
        {/* Title Input */}
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          placeholder="Task title..."
        />

        {/* Quick Metadata Controls */}
        <div className={styles.metaGrid}>
          {/* Due Date */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Due Date</span>
            <input
              type="date"
              className={styles.metaInput}
              value={task.due_date ?? ''}
              onChange={(e) =>
                updateTask({
                  id: task.id,
                  due_date: e.target.value || null,
                })
              }
            />
          </div>

          {/* Priority */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Priority</span>
            <select
              className={styles.metaInput}
              value={task.priority}
              onChange={(e) =>
                updateTask({
                  id: task.id,
                  priority: Number(e.target.value),
                })
              }
            >
              <option value="0">None (P0)</option>
              <option value="1">Low (P1)</option>
              <option value="2">Medium (P2)</option>
              <option value="3">High (P3)</option>
              <option value="4">Critical (P4)</option>
            </select>
          </div>

          {/* Star & My Day Toggles */}
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>Quick Actions</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`${styles.metaBtn} ${task.is_starred === 1 ? styles.metaBtnActive : ''}`}
                onClick={() =>
                  updateTask({
                    id: task.id,
                    is_starred: task.is_starred === 1 ? 0 : 1,
                  })
                }
              >
                ★ {task.is_starred === 1 ? 'Starred' : 'Star'}
              </button>

              <button
                type="button"
                className={`${styles.metaBtn} ${isMyDay ? styles.metaBtnActive : ''}`}
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  updateTask({
                    id: task.id,
                    my_day_date: isMyDay ? null : today,
                  });
                }}
              >
                ☀️ {isMyDay ? 'In My Day' : 'Add to My Day'}
              </button>
            </div>
          </div>
        </div>

        {/* Subtasks Section */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>
            Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.is_completed === 1).length}/${subtasks.length})`}
          </span>

          <div className={styles.subtasksList}>
            {subtasks.map((sub) => (
              <div key={sub.id} className={styles.subtaskRow}>
                <div>
                  <Checkbox
                    checked={sub.is_completed === 1}
                    onChange={() => toggleComplete(sub.id)}
                  />
                </div>
                <span
                  className={`${styles.subtaskTitle} ${
                    sub.is_completed === 1 ? styles.subtaskCompleted : ''
                  }`}
                >
                  {sub.title}
                </span>
              </div>
            ))}

            <input
              type="text"
              className={styles.subtaskInput}
              placeholder="Add a subtask (Press Enter)..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={handleAddSubtask}
            />
          </div>
        </div>

        {/* Rich Notes Section (TipTap) */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionHeader}>Notes</span>
          <div className={styles.editorWrapper}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export default DetailPanel;
