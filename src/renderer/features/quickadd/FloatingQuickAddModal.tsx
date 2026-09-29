import React, { useState, useEffect, useRef } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { playTaskCreateSound } from '../../utils/sound-effects.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './FloatingQuickAddModal.module.css';

interface CreatedSessionItem {
  id: string;
  title: string;
}

export function FloatingQuickAddModal(): React.ReactElement {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<number>(0);
  const [isStarred, setIsStarred] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [isContinue, setIsContinue] = useState(false);
  const [sessionTasks, setSessionTasks] = useState<CreatedSessionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pickers toggle
  const [activePicker, setActivePicker] = useState<'priority' | 'tags' | 'date' | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const createTask = useTaskStore((state) => state.createTask);
  const tagsById = useTagStore((state) => state.tagsById);
  const loadTags = useTagStore((state) => state.loadTags);

  useEffect(() => {
    loadTags();
    titleInputRef.current?.focus();
  }, [loadTags]);

  const handleClose = () => {
    ipc.invoke(IPC.APP.CLOSE).catch(() => {});
  };

  // Global key bindings within modal (Escape to close, Ctrl+Shift+C to toggle Continue)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsContinue((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await createTask({
        title: trimmedTitle,
        notes: notes.trim() || null,
        list_id: 'list_inbox',
        priority,
        is_starred: isStarred ? 1 : 0,
        due_date: dueDate,
      });

      // Associate selected tags
      if (selectedTagNames.length > 0 && created?.id) {
        for (const tagName of selectedTagNames) {
          const existing = Object.values(tagsById).find(
            (t) => t.name.toLowerCase() === tagName.toLowerCase()
          );
          if (existing) {
            await useTagStore.getState().addTagToTask(created.id, existing.id);
          } else {
            const newTag = await useTagStore.getState().createTag({ name: tagName });
            if (newTag?.id) {
              await useTagStore.getState().addTagToTask(created.id, newTag.id);
            }
          }
        }
      }

      playTaskCreateSound();

      if (isContinue) {
        setSessionTasks((prev) => [...prev, { id: created.id, title: trimmedTitle }]);
        // Reset form inputs for next task
        setTitle('');
        setNotes('');
        setPriority(0);
        setIsStarred(false);
        setDueDate(null);
        setSelectedTagNames([]);
        setActivePicker(null);
        setTimeout(() => {
          titleInputRef.current?.focus();
        }, 50);
      } else {
        handleClose();
      }
    } catch (err) {
      console.error('[QuickAddModal] Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.modalLayout}>
        <div className={styles.modalCard}>
          <form onSubmit={handleSubmit}>
            <div className={styles.body}>
              <div className={styles.titleRow}>
                <div
                  className={styles.checkboxIndicator}
                  title="New task"
                  aria-hidden="true"
                />
                <input
                  ref={titleInputRef}
                  type="text"
                  className={styles.titleInput}
                  placeholder="Task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                />
              </div>

              <textarea
                className={styles.notesInput}
                placeholder="Notes..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>

            {/* Quick Action Icons Row */}
            <div className={styles.metaRow}>
              {/* Due Date Icon */}
              <button
                type="button"
                className={`${styles.metaBtn} ${dueDate ? styles.metaBtnActive : ''}`}
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setDueDate(dueDate ? null : todayStr);
                }}
                title={dueDate ? `Due: ${dueDate}` : 'Add Due Date (Today)'}
                aria-label="Toggle due date"
              >
                <span>📅</span>
                {dueDate && <span style={{ fontSize: '11px' }}>Today</span>}
              </button>

              {/* Tag Picker Icon */}
              <button
                type="button"
                className={`${styles.metaBtn} ${selectedTagNames.length > 0 ? styles.metaBtnActive : ''}`}
                onClick={() => setActivePicker((prev) => (prev === 'tags' ? null : 'tags'))}
                title="Add Tags"
                aria-label="Add tags"
              >
                <span>🏷️</span>
                {selectedTagNames.length > 0 && (
                  <span style={{ fontSize: '11px' }}>{selectedTagNames.join(', ')}</span>
                )}
              </button>

              {/* Starred / Important Icon */}
              <button
                type="button"
                className={`${styles.metaBtn} ${isStarred ? styles.metaBtnActive : ''}`}
                onClick={() => setIsStarred((prev) => !prev)}
                title={isStarred ? 'Marked as Important' : 'Mark as Important'}
                aria-label="Toggle important"
              >
                <span>{isStarred ? '⭐' : '☆'}</span>
              </button>

              {/* Priority Flag Icon */}
              <button
                type="button"
                className={`${styles.metaBtn} ${priority > 0 ? styles.metaBtnActive : ''}`}
                onClick={() =>
                  setPriority((prev) => (prev >= 4 ? 0 : (prev + 1 as 0 | 1 | 2 | 3 | 4)))
                }
                title={`Priority P${priority}`}
                aria-label="Toggle priority"
              >
                <span>🚩</span>
                {priority > 0 && <span style={{ fontSize: '11px' }}>P{priority}</span>}
              </button>
            </div>

            {/* Tag Selection Popover */}
            {activePicker === 'tags' && (
              <div className={styles.pickerPopover}>
                {Object.values(tagsById).length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '4px' }}>
                    No tags available
                  </div>
                ) : (
                  Object.values(tagsById).map((t) => {
                    const isSelected = selectedTagNames.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={styles.pickerOption}
                        onClick={() => {
                          setSelectedTagNames((prev) =>
                            isSelected ? prev.filter((n) => n !== t.name) : [...prev, t.name]
                          );
                        }}
                      >
                        {isSelected ? '✓ ' : ''}#{t.name}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer with Continue toggle and Action Buttons */}
            <div className={styles.footerBar}>
              <button
                type="button"
                className={`${styles.continueToggleBtn} ${
                  isContinue ? styles.continueToggleActive : ''
                }`}
                onClick={() => setIsContinue((prev) => !prev)}
                title="Keep modal open to add tasks one after another (Ctrl+Shift+C)"
              >
                <span>{isContinue ? '⚡' : '🔄'}</span>
                <span>Continue</span>
              </button>

              <div className={styles.actionsGroup}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={!title.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Attached Session Task Drawer when Continue is active and tasks were captured */}
        {isContinue && sessionTasks.length > 0 && (
          <div className={styles.sessionDrawer}>
            <div className={styles.sessionHeader}>
              <span>Captured This Session</span>
              <span className={styles.sessionCount}>{sessionTasks.length}</span>
            </div>
            <div className={styles.sessionList}>
              {sessionTasks.map((t, idx) => (
                <div key={t.id || idx} className={styles.sessionItem}>
                  <span className={styles.sessionBullet}>✓</span>
                  <span className={styles.sessionTitle}>{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FloatingQuickAddModal;
