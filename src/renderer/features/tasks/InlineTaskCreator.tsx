import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { playTaskCreateSound } from '../../utils/sound-effects.js';
import { DatePicker } from '../../components/DatePicker/DatePicker.js';
import { formatForDisplay } from '@shared/utils/date.js';
import type { Task } from '@shared/types/task.js';
import styles from './InlineTaskCreator.module.css';

export interface InlineTaskCreatorProps {
  listId?: string | null;
  defaultDueDate?: string | null;
  defaultBucket?: 'anytime' | 'someday' | null;
  defaultAreaId?: string | null;
  defaultProjectId?: string | null;
  initialOpen?: boolean;
  onTaskCreated?: (task: Task) => void;
}

export function InlineTaskCreator({
  listId,
  defaultDueDate,
  defaultBucket,
  defaultAreaId,
  defaultProjectId,
  initialOpen = false,
  onTaskCreated,
}: InlineTaskCreatorProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate ?? null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);

  const createTask = useTaskStore((state) => state.createTask);

  // Sync defaultDueDate if it changes from outside
  useEffect(() => {
    if (defaultDueDate !== undefined) {
      setDueDate(defaultDueDate);
    }
  }, [defaultDueDate]);

  // Sync initialOpen
  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  // Focus title input whenever creator opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global Ctrl+N / Cmd+N shortcut to open task creator
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        setIsOpen(true);
        titleInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Close helper
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTitle('');
    setNotes('');
    setIsNotesOpen(false);
    setDueDate(defaultDueDate ?? null);
    setIsDatePickerOpen(false);
    if (notesInputRef.current) {
      notesInputRef.current.style.height = 'auto';
    }
  }, [defaultDueDate]);

  // Commit task to store
  const commitTask = useCallback(async (): Promise<Task | null> => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isSubmitting) return null;

    setIsSubmitting(true);
    try {
      let targetListId = listId;
      if (defaultProjectId) {
        targetListId = defaultProjectId;
      } else if (!targetListId && !defaultAreaId) {
        targetListId = 'list_inbox';
      }

      const created = await createTask({
        title: trimmedTitle,
        notes: notes.trim() || null,
        project_id: defaultProjectId ?? null,
        area_id: defaultAreaId ?? null,
        list_id: targetListId ?? undefined,
        bucket: defaultBucket ?? null,
        due_date: dueDate ?? null,
      });

      playTaskCreateSound();
      onTaskCreated?.(created);
      return created;
    } catch (err) {
      console.error('[InlineTaskCreator] Failed to create task:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    notes,
    isSubmitting,
    listId,
    defaultProjectId,
    defaultAreaId,
    defaultBucket,
    dueDate,
    createTask,
    onTaskCreated,
  ]);

  // Continue session (Shift+Enter or Continue icon)
  const handleContinue = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    await commitTask();

    // Reset inputs for the next task but stay open
    setTitle('');
    setNotes('');
    setIsNotesOpen(false);
    setDueDate(defaultDueDate ?? null);
    setIsDatePickerOpen(false);
    if (notesInputRef.current) {
      notesInputRef.current.style.height = 'auto';
    }

    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 30);
  };

  // Submit and Close (Enter without Shift)
  const handleSubmitAndClose = async () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      await commitTask();
    }
    handleClose();
  };

  // Handle title input changes with ":" NLP colon trigger
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (val.includes(':')) {
      // Remove colon and transition smoothly to notes
      const cleanTitle = val.replace(':', '');
      setTitle(cleanTitle);
      setIsNotesOpen(true);

      setTimeout(() => {
        notesInputRef.current?.focus();
      }, 20);
      return;
    }

    setTitle(val);
  };

  // Handle notes textarea change with auto-resizing
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    if (notesInputRef.current) {
      notesInputRef.current.style.height = 'auto';
      notesInputRef.current.style.height = `${notesInputRef.current.scrollHeight}px`;
    }
  };

  // Keyboard navigation on Title input
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleContinue();
      } else {
        handleSubmitAndClose();
      }
    }
  };

  // Keyboard navigation on Notes input
  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.preventDefault();
        handleContinue();
      } else if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSubmitAndClose();
      }
    }
  };

  // Handle clicking outside the active creator card
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (isDatePickerOpen) return;

      const target = e.target as Node;
      if (cardRef.current && !cardRef.current.contains(target)) {
        if (title.trim()) {
          commitTask().then(() => handleClose());
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isDatePickerOpen, title, commitTask, handleClose]);

  return (
    <>
      {/* Active State: Top-of-list creation row */}
      {isOpen && (
        <div ref={cardRef} className={styles.creatorCard}>
          {/* Primary Row: Circle Indicator + Title input */}
          <div className={styles.primaryRow}>
            <div
              className={styles.circleIndicator}
              aria-hidden="true"
              title="New task"
            />
            <input
              ref={titleInputRef}
              type="text"
              className={styles.titleInput}
              placeholder="New Task..."
              aria-label="New Task"
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
            />
          </div>

          {/* Notes Row: Expands via Notes Icon or ":" NLP Colon */}
          {isNotesOpen && (
            <div className={styles.notesRow}>
              <textarea
                ref={notesInputRef}
                className={styles.notesInput}
                placeholder="Notes..."
                aria-label="Notes"
                rows={1}
                value={notes}
                onChange={handleNotesChange}
                onKeyDown={handleNotesKeyDown}
              />
            </div>
          )}

          {/* Icon Toolbar Row: Exactly 3 vector icon buttons (no text) */}
          <div className={styles.toolbarRow}>
            {/* 1. Notes Icon */}
            <button
              type="button"
              className={`${styles.iconBtn} ${isNotesOpen ? styles.iconBtnActive : ''}`}
              onClick={() => {
                const nextState = !isNotesOpen;
                setIsNotesOpen(nextState);
                if (nextState) {
                  setTimeout(() => notesInputRef.current?.focus(), 20);
                }
              }}
              title="Toggle notes"
              aria-label="Toggle notes"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </button>

            {/* 2. Date Icon */}
            <button
              ref={dateBtnRef}
              type="button"
              className={`${styles.iconBtn} ${dueDate ? styles.iconBtnActive : ''}`}
              onClick={() => setIsDatePickerOpen((prev) => !prev)}
              title="Add date"
              aria-label="Add date"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>

            {/* Date Pill if selected */}
            {dueDate && (
              <span className={styles.datePill}>
                <span>{formatForDisplay(dueDate)}</span>
                <button
                  type="button"
                  className={styles.dateClearBtn}
                  onClick={() => setDueDate(null)}
                  aria-label="Clear due date"
                >
                  ✕
                </button>
              </span>
            )}

            {/* 3. Continue Icon */}
            <button
              type="button"
              className={`${styles.iconBtn} ${!title.trim() ? styles.iconBtnDisabled : ''}`}
              onClick={handleContinue}
              disabled={!title.trim() || isSubmitting}
              title="Continue (Shift+Enter)"
              aria-label="Continue"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>

          {/* Inline DatePicker Popover */}
          {isDatePickerOpen && (
            <div
              role="dialog"
              aria-label="Select due date"
              className={styles.datePickerWrapper}
            >
              <DatePicker
                initialDate={dueDate}
                onSelect={(selectedDate) => {
                  setDueDate(selectedDate);
                  setIsDatePickerOpen(false);
                }}
                onClose={() => setIsDatePickerOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Resting State: Transparent ~30px block touching bottom */}
      {!isOpen && (
        <button
          type="button"
          className={styles.restingTrigger}
          onClick={() => setIsOpen(true)}
          role="button"
          aria-label="New task trigger"
        >
          <span className={styles.triggerLabel}>New task</span>
        </button>
      )}
    </>
  );
}

export default InlineTaskCreator;
