import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore } from '../../stores/listStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { ParsedQuickAddResult } from '@shared/types/nlp.js';
import { ParsePreviewChip } from './ParsePreviewChip.js';
import styles from './QuickAddBar.module.css';

interface QuickAddBarProps {
  placeholder?: string;
  onAdded?: () => void;
}

export function QuickAddBar({
  placeholder = "Add a task (e.g. 'Review pull request tomorrow @work #dev !high 🍅')...",
  onAdded,
}: QuickAddBarProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedQuickAddResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { activeListId } = useAppStore();
  const { createTask } = useTaskStore();
  const listsById = useListStore((state) => state.listsById);
  const isNlpEnabled = useModuleStore((state) => state.isEnabled('nlp_parsing'));

  // Ctrl+N / Cmd+N keyboard shortcut focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for IPC quick add focus (e.g. from titlebar / tray / warm start)
  useEffect(() => {
    const unsub = ipc.on(IPC.APP.FOCUS_QUICK_ADD, () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Debounced NLP parsing call via IPC
  const requestParse = useCallback(
    (text: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!text.trim() || !isNlpEnabled) {
        setParsed(null);
        return;
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await ipc.invoke<ParsedQuickAddResult>(IPC.NLP.PARSE, text);
          setParsed(res);
        } catch {
          // Graceful fallback if IPC parse fails
          setParsed(null);
        }
      }, 80);
    },
    [isNlpEnabled]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    requestParse(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Determine clean title and attributes from parsed state or fallback
      let title = raw;
      let targetListId = 'list_inbox';
      if (!activeListId.startsWith('smart_') && listsById[activeListId]) {
        targetListId = activeListId;
      }
      let priority = 0;
      let dueDate: string | null = null;
      let dueTime: string | null = null;
      let allDay = true;
      let recurrenceRule: string | null = null;
      let myDayDate: string | null = null;

      if (parsed) {
        title = parsed.cleanTitle || raw;
        priority = parsed.priority;
        dueDate = parsed.dueDate;
        dueTime = parsed.dueTime;
        allDay = parsed.allDay;
        recurrenceRule = parsed.recurrenceRule;

        if (parsed.listName) {
          const targetName = parsed.listName.toLowerCase();
          const matched = Object.values(listsById).find(
            (l) => l.name.toLowerCase() === targetName
          );
          if (matched) {
            targetListId = matched.id;
          }
        }
      }

      // Ensure targetListId is a valid existing list in listsById
      if (!listsById[targetListId]) {
        if (listsById['list_inbox']) {
          targetListId = 'list_inbox';
        } else {
          const firstAvailable = Object.keys(listsById)[0];
          if (firstAvailable) {
            targetListId = firstAvailable;
          }
        }
      }

      // If adding from My Day view, auto-assign to today
      if (activeListId === 'smart_my_day') {
        myDayDate = new Date().toISOString().split('T')[0];
      }

      // Create the task
      await createTask({
        title,
        list_id: targetListId,
        priority,
        due_date: dueDate,
        due_time: dueTime,
        all_day: allDay ? 1 : 0,
        recurrence_rule: recurrenceRule,
        my_day_date: myDayDate,
      });

      // Clear input and parsed preview
      setInput('');
      setParsed(null);
      onAdded?.();
    } catch (err) {
      console.error('[QuickAddBar] Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘N' : 'Ctrl+N';

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.inputCard}>
        <span className={styles.plusIcon} aria-hidden="true">
          +
        </span>

        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={input}
          onChange={handleInputChange}
          disabled={isSubmitting}
          aria-label="Quick add task"
        />

        <span className={styles.kbdBadge} title={`Press ${shortcutLabel} to focus`}>
          {shortcutLabel}
        </span>
      </form>

      {/* Dynamic NLP preview chips */}
      {isNlpEnabled && parsed && (
        <ParsePreviewChip parsed={parsed} />
      )}
    </div>
  );
}

export default QuickAddBar;
