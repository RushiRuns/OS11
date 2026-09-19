import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore } from '../../stores/listStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { ParsedQuickAddResult } from '@shared/types/nlp.js';
import type { Tag } from '@shared/types/Tag.js';
import { parseInlineTaskInput, tokenizeInlineSyntax, type InlineSyntaxToken } from '@shared/utils/inline-task-parser.js';
import { ParsePreviewChip } from './ParsePreviewChip.js';
import styles from './QuickAddBar.module.css';

interface QuickAddBarProps {
  placeholder?: string;
  onAdded?: () => void;
}

interface TagMenuOption {
  type: 'existing' | 'create';
  tag?: Tag;
  name: string;
}

export function QuickAddBar({
  placeholder = "Add a task (e.g. 'my first task :notes description: #work')...",
  onAdded,
}: QuickAddBarProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedQuickAddResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Floating Tag Menu state
  const [tagMenuQuery, setTagMenuQuery] = useState<string | null>(null);
  const [tagMenuStartIndex, setTagMenuStartIndex] = useState<number>(-1);
  const [highlightedMenuIndex, setHighlightedMenuIndex] = useState<number>(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { activeListId } = useAppStore();
  const { createTask } = useTaskStore();
  const listsById = useListStore((state) => state.listsById);
  const isNlpEnabled = useModuleStore((state) => state.isEnabled('nlp_parsing'));

  const { tagsById, loadTags, createTag, addTagToTask } = useTagStore();

  useEffect(() => {
    loadTags();
  }, [loadTags]);

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

  // Listen for IPC quick add focus
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
          setParsed(null);
        }
      }, 80);
    },
    [isNlpEnabled]
  );

  // Check if cursor is right after a `#<word>` pattern to show tag suggestions
  const evaluateTagMenu = useCallback((text: string, position: number) => {
    const textBeforeCursor = text.slice(0, position);
    const match = textBeforeCursor.match(/(?:^|\s)#([a-zA-Z0-9_\-\u00C0-\u017F]+)$/);

    if (match) {
      const query = match[1];
      const matchStart = textBeforeCursor.lastIndexOf('#' + query);
      setTagMenuQuery(query);
      setTagMenuStartIndex(matchStart);
      setHighlightedMenuIndex(0);
    } else {
      setTagMenuQuery(null);
      setTagMenuStartIndex(-1);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setInput(val);
    requestParse(val);
    evaluateTagMenu(val, pos);
  };

  const handleSelectOrClick = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const pos = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
    evaluateTagMenu(input, pos);
  };

  // Build menu options based on tagMenuQuery
  const tagMenuOptions = useMemo<TagMenuOption[]>(() => {
    if (!tagMenuQuery) return [];
    const q = tagMenuQuery.toLowerCase();
    const existing = Object.values(tagsById).filter((t) =>
      t.name.toLowerCase().startsWith(q)
    );

    const exactMatch = existing.find((t) => t.name.toLowerCase() === q);
    const options: TagMenuOption[] = existing.map((t) => ({
      type: 'existing',
      tag: t,
      name: t.name,
    }));

    if (!exactMatch && tagMenuQuery.trim().length > 0) {
      options.push({
        type: 'create',
        name: tagMenuQuery.trim(),
      });
    }

    return options;
  }, [tagMenuQuery, tagsById]);

  // Apply chosen tag from menu into the text
  const applyTagOption = useCallback(
    (option: TagMenuOption) => {
      if (tagMenuStartIndex < 0 || !tagMenuQuery) return;

      const before = input.slice(0, tagMenuStartIndex);
      const after = input.slice(tagMenuStartIndex + tagMenuQuery.length + 1); // +1 for '#'
      const newText = `${before}#${option.name} ${after}`;

      setInput(newText);
      setTagMenuQuery(null);
      setTagMenuStartIndex(-1);

      setTimeout(() => {
        if (inputRef.current) {
          const newPos = before.length + option.name.length + 2;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [input, tagMenuStartIndex, tagMenuQuery]
  );

  const handleSubmit = async () => {
    const raw = input.trim();
    if (!raw || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Parse inline syntax for title, notes, and tags
      const inlineParsed = parseInlineTaskInput(raw);

      let title = inlineParsed.title || raw;
      const notes = inlineParsed.notes;
      const extractedTags = inlineParsed.tags;

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

      // Extract NLP date/priority if available
      if (parsed) {
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

      if (activeListId === 'smart_my_day') {
        myDayDate = new Date().toISOString().split('T')[0];
      }

      // Create the task with parsed title and notes
      const createdTask = await createTask({
        title,
        notes,
        list_id: targetListId,
        priority,
        due_date: dueDate,
        due_time: dueTime,
        all_day: allDay ? 1 : 0,
        recurrence_rule: recurrenceRule,
        my_day_date: myDayDate,
      });

      // Link or create all extracted tags
      for (const tagName of extractedTags) {
        const lower = tagName.toLowerCase();
        let tag = Object.values(tagsById).find((t) => t.name.toLowerCase() === lower);
        if (!tag) {
          try {
            tag = await createTag({
              name: tagName,
              color: 'var(--tag-gray)',
            });
          } catch (err) {
            console.error('[QuickAddBar] Failed to create tag:', tagName, err);
          }
        }
        if (tag && createdTask.id) {
          try {
            await addTagToTask(createdTask.id, tag.id);
          } catch (err) {
            console.error('[QuickAddBar] Failed to associate tag:', tag.name, err);
          }
        }
      }

      // Clear input and parsed preview
      setInput('');
      setParsed(null);
      setTagMenuQuery(null);
      onAdded?.();
    } catch (err) {
      console.error('[QuickAddBar] Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If floating tag menu is visible
    if (tagMenuQuery && tagMenuOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedMenuIndex((prev) => (prev + 1) % tagMenuOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedMenuIndex((prev) => (prev - 1 + tagMenuOptions.length) % tagMenuOptions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setHighlightedMenuIndex((prev) => (prev + 1) % tagMenuOptions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = tagMenuOptions[highlightedMenuIndex];
        if (selected) {
          applyTagOption(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTagMenuQuery(null);
        return;
      }
    }

    // Multiline handling: Shift+Enter inserts newline
    if (e.key === 'Enter' && e.shiftKey) {
      return; // Allow native textarea newline insertion
    }

    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Generate tokens for syntax highlighting
  const tokens: InlineSyntaxToken[] = useMemo(() => {
    return tokenizeInlineSyntax(input);
  }, [input]);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘N' : 'Ctrl+N';

  return (
    <div className={styles.container}>
      <div className={styles.inputCard}>
        <span className={styles.plusIcon} aria-hidden="true">
          +
        </span>

        {/* Text Input Wrapper with Real-time Syntax Coloring */}
        <div className={styles.inputWrapper}>
          {/* Syntax Highlighter Layer */}
          <div className={styles.syntaxOverlay} aria-hidden="true">
            {tokens.length === 0 ? (
              <span className={styles.tokenPlaceholder}>{placeholder}</span>
            ) : (
              tokens.map((token, idx) => {
                let tokenClass = styles.tokenTitle;
                if (token.type === 'notes') {
                  tokenClass = styles.tokenNotes;
                } else if (token.type === 'tag') {
                  tokenClass = styles.tokenTag;
                } else if (token.type === 'delimiter') {
                  tokenClass = styles.tokenDelimiter;
                }
                return (
                  <span key={idx} className={tokenClass}>
                    {token.text}
                  </span>
                );
              })
            )}
          </div>

          {/* Transparent Input Layer */}
          <textarea
            ref={inputRef}
            className={styles.inputArea}
            value={input}
            onChange={handleInputChange}
            onSelect={handleSelectOrClick}
            onClick={handleSelectOrClick}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            aria-label="Quick add task"
            rows={input.includes('\n') ? Math.min(input.split('\n').length, 4) : 1}
          />
        </div>

        <span className={styles.kbdBadge} title={`Press ${shortcutLabel} to focus`}>
          {shortcutLabel}
        </span>
      </div>

      {/* Floating Tag Autocomplete Menu */}
      {tagMenuQuery && tagMenuOptions.length > 0 && (
        <div className={styles.tagMenu} role="listbox" aria-label="Tag suggestions">
          {tagMenuOptions.map((opt, idx) => (
            <div
              key={`${opt.type}-${opt.name}`}
              className={`${styles.tagMenuItem} ${idx === highlightedMenuIndex ? styles.tagMenuItemActive : ''}`}
              role="option"
              aria-selected={idx === highlightedMenuIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                applyTagOption(opt);
              }}
              onMouseEnter={() => setHighlightedMenuIndex(idx)}
            >
              <span className={styles.tagMenuHash}>#</span>
              <span className={styles.tagMenuName}>
                {opt.type === 'create' ? `Create this tag #${opt.name}` : opt.name}
              </span>
              {opt.type === 'create' && (
                <span className={styles.tagMenuBadge}>New</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dynamic NLP preview chips */}
      {isNlpEnabled && parsed && (
        <ParsePreviewChip parsed={parsed} />
      )}
    </div>
  );
}

export default QuickAddBar;

