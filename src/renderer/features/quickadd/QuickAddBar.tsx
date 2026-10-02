import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTaskStore } from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { ParsedQuickAddResult } from '@shared/types/nlp.js';
import type { Tag } from '@shared/types/Tag.js';
import {
  parseInlineTaskInput,
  tokenizeInlineSyntax,
  type InlineSyntaxToken,
} from '@shared/utils/inline-task-parser.js';
import { formatForDisplay } from '@shared/utils/date.js';
import { ParsePreviewChip } from './ParsePreviewChip.js';
import styles from './QuickAddBar.module.css';

interface QuickAddBarProps {
  placeholder?: string;
  onAdded?: () => void;
  defaultDueDate?: string | null;
}

interface AutocompleteMenuOption {
  type: 'tag' | 'area' | 'project' | 'tag-create';
  prefix: '#' | '@' | '/';
  name: string;
  badge?: string;
  tag?: Tag;
  id?: string;
}

interface MenuState {
  prefix: '#' | '@' | '/';
  query: string;
  startIndex: number;
}

export function QuickAddBar({
  placeholder = "Add a task (e.g. 'my first task :notes description: #work')...",
  onAdded,
  defaultDueDate,
}: QuickAddBarProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedQuickAddResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDefaultDueDate, setActiveDefaultDueDate] = useState<string | null>(
    defaultDueDate ?? null
  );

  useEffect(() => {
    setActiveDefaultDueDate(defaultDueDate ?? null);
  }, [defaultDueDate]);

  // Floating Autocomplete Menu state (# tags, @ areas, / projects)
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [highlightedMenuIndex, setHighlightedMenuIndex] = useState<number>(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { activeListId } = useAppStore();
  const { createTask } = useTaskStore();
  const isNlpEnabled = useModuleStore(state => state.isEnabled('nlp_parsing'));

  const { areasById, loadAreas } = useAreaStore();
  const { projectsById, loadProjects } = useProjectStore();
  const { tagsById, loadTags, createTag, addTagToTask } = useTagStore();

  useEffect(() => {
    loadTags();
    loadAreas();
    loadProjects();
  }, [loadTags, loadAreas, loadProjects]);

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

  // Check if cursor is right after a `#`, `@`, or `/` pattern to show autocomplete suggestions
  const evaluateMenu = useCallback((text: string, position: number) => {
    const textBeforeCursor = text.slice(0, position);
    const match = textBeforeCursor.match(/(?:^|\s)(#|@|\/)([a-zA-Z0-9_\-\u00C0-\u017F]*)$/);

    if (match) {
      const prefix = match[1] as '#' | '@' | '/';
      const query = match[2];
      const matchStart = textBeforeCursor.lastIndexOf(prefix + query);
      setMenuState({
        prefix,
        query,
        startIndex: matchStart,
      });
      setHighlightedMenuIndex(0);
    } else {
      setMenuState(null);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setInput(val);
    requestParse(val);
    evaluateMenu(val, pos);
  };

  const handleSelectOrClick = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const pos = (e.target as HTMLTextAreaElement).selectionStart ?? 0;
    evaluateMenu(input, pos);
  };

  // Build menu options based on menuState
  const menuOptions = useMemo<AutocompleteMenuOption[]>(() => {
    if (!menuState) return [];
    const { prefix, query } = menuState;
    const q = query.toLowerCase();

    if (prefix === '#') {
      const existing = Object.values(tagsById).filter(t => t.name.toLowerCase().startsWith(q));

      const exactMatch = existing.find(t => t.name.toLowerCase() === q);
      const options: AutocompleteMenuOption[] = existing.map(t => ({
        type: 'tag',
        prefix: '#',
        name: t.name,
        tag: t,
        id: t.id,
      }));

      if (!exactMatch && query.trim().length > 0) {
        options.push({
          type: 'tag-create',
          prefix: '#',
          name: query.trim(),
          badge: 'New',
        });
      }

      return options;
    }

    if (prefix === '@') {
      const existing = Object.values(areasById).filter(a => a.name.toLowerCase().includes(q));
      return existing.map(a => ({
        type: 'area',
        prefix: '@',
        name: a.name,
        badge: 'Area',
        id: a.id,
      }));
    }

    if (prefix === '/') {
      const existing = Object.values(projectsById).filter(
        p => p.status !== 'archived' && p.name.toLowerCase().includes(q)
      );
      return existing.map(p => ({
        type: 'project',
        prefix: '/',
        name: p.name,
        badge: 'Project',
        id: p.id,
      }));
    }

    return [];
  }, [menuState, tagsById, areasById, projectsById]);

  // Apply chosen option from menu into the text
  const applyOption = useCallback(
    (option: AutocompleteMenuOption) => {
      if (!menuState) return;

      const { startIndex, query } = menuState;
      const before = input.slice(0, startIndex);
      const after = input.slice(startIndex + query.length + 1); // +1 for trigger prefix

      let insertedToken = '';
      if (option.prefix === '#') {
        insertedToken = `#${option.name} `;
      } else if (option.prefix === '@') {
        insertedToken = option.name.includes(' ') ? `@"${option.name}" ` : `@${option.name} `;
      } else if (option.prefix === '/') {
        insertedToken = option.name.includes(' ') ? `/"${option.name}" ` : `/${option.name} `;
      }

      const newText = `${before}${insertedToken}${after}`;

      setInput(newText);
      setMenuState(null);

      setTimeout(() => {
        if (inputRef.current) {
          const newPos = before.length + insertedToken.length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [input, menuState]
  );

  const handleSubmit = async () => {
    const raw = input.trim();
    if (!raw || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Parse inline syntax for title, notes, and tags
      const inlineParsed = parseInlineTaskInput(raw);

      const title = inlineParsed.title || raw;
      const notes = inlineParsed.notes;
      const extractedTags = inlineParsed.tags;

      let targetAreaId: string | null = null;
      let targetProjectId: string | null = null;

      if (activeListId.startsWith('project:')) {
        targetProjectId = activeListId.slice(8);
        const proj = useProjectStore.getState().projectsById[targetProjectId];
        targetAreaId = proj?.area_id ?? null;
      } else if (activeListId.startsWith('area:')) {
        targetAreaId = activeListId.slice(5);
        targetProjectId = null;
      } else {
        targetAreaId = null;
        targetProjectId = null;
      }

      // Inline syntax override: @Area
      if (inlineParsed.areaName) {
        const lowerArea = inlineParsed.areaName.toLowerCase();
        const areas = Object.values(useAreaStore.getState().areasById);
        const matched = areas.find(a => a.name.toLowerCase() === lowerArea);
        if (matched) {
          targetAreaId = matched.id;
          targetProjectId = null;
        }
      }

      // Inline syntax override: /Project
      if (inlineParsed.projectName) {
        const lowerProj = inlineParsed.projectName.toLowerCase();
        const projects = Object.values(useProjectStore.getState().projectsById);
        const matched = projects.find(p => p.name.toLowerCase() === lowerProj);
        if (matched) {
          targetProjectId = matched.id;
          if (matched.area_id) {
            targetAreaId = matched.area_id;
          }
        }
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
      }

      if (activeListId === 'smart_my_day') {
        myDayDate = new Date().toISOString().split('T')[0];
      }

      if (activeListId === 'smart_planned') {
        targetAreaId = null;
        targetProjectId = null;
        if (!dueDate && activeDefaultDueDate) {
          dueDate = activeDefaultDueDate;
        }
      } else if (!dueDate && activeDefaultDueDate) {
        dueDate = activeDefaultDueDate;
      }

      // Create the task with contextual and parsed fields
      const createdTask = await createTask({
        title,
        notes,
        area_id: targetAreaId,
        project_id: targetProjectId,
        list_id: targetProjectId ?? (!targetAreaId ? 'list_inbox' : undefined),
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
        let tag = Object.values(tagsById).find(t => t.name.toLowerCase() === lower);
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
      setMenuState(null);
      onAdded?.();
    } catch (err) {
      console.error('[QuickAddBar] Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If floating autocomplete menu is visible
    if (menuState && menuOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedMenuIndex(prev => (prev + 1) % menuOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedMenuIndex(prev => (prev - 1 + menuOptions.length) % menuOptions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setHighlightedMenuIndex(prev => (prev + 1) % menuOptions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = menuOptions[highlightedMenuIndex];
        if (selected) {
          applyOption(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuState(null);
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

  return (
    <div className={styles.container}>
      <div className={styles.inputCard}>
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
                } else if (token.type === 'area') {
                  tokenClass = styles.tokenArea;
                } else if (token.type === 'project') {
                  tokenClass = styles.tokenProject;
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
      </div>

      {/* Floating Autocomplete Menu (# tags, @ areas, / projects) */}
      {menuState && menuOptions.length > 0 && (
        <div className={styles.tagMenu} role="listbox" aria-label="Suggestions">
          {menuOptions.map((opt, idx) => {
            let badgeClass = styles.tagMenuBadge;
            if (opt.type === 'project') {
              badgeClass = `${styles.tagMenuBadge} ${styles.tagMenuBadgeProject}`;
            } else if (opt.type === 'area') {
              badgeClass = `${styles.tagMenuBadge} ${styles.tagMenuBadgeArea}`;
            }

            return (
              <div
                key={`${opt.type}-${opt.name}-${idx}`}
                className={`${styles.tagMenuItem} ${idx === highlightedMenuIndex ? styles.tagMenuItemActive : ''}`}
                role="option"
                aria-selected={idx === highlightedMenuIndex}
                onMouseDown={e => {
                  e.preventDefault();
                  applyOption(opt);
                }}
                onMouseEnter={() => setHighlightedMenuIndex(idx)}
              >
                <span className={styles.tagMenuHash}>{opt.prefix}</span>
                <span className={styles.tagMenuName}>
                  {opt.type === 'tag-create' ? `Create this tag #${opt.name}` : opt.name}
                </span>
                {opt.badge && <span className={badgeClass}>{opt.badge}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic NLP preview chips */}
      {isNlpEnabled && parsed && <ParsePreviewChip parsed={parsed} />}

      {/* Removable default due date chip (e.g. Planned view date context) */}
      {activeDefaultDueDate && !parsed?.dueDate && (
        <div className={styles.defaultChipRow}>
          <span className={styles.defaultDateChip}>
            <span>📅 Due {formatForDisplay(activeDefaultDueDate)}</span>
            <button
              type="button"
              className={styles.chipRemoveBtn}
              onClick={() => setActiveDefaultDueDate(null)}
              aria-label="Remove default due date"
            >
              ✕
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

export default QuickAddBar;
