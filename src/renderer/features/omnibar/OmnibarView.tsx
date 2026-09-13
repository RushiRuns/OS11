import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { ParsePreviewChip } from '../quickadd/ParsePreviewChip.js';
import type { ParsedQuickAddResult } from '@shared/types/nlp.js';
import type { SearchResult } from '@shared/types/search.js';
import styles from './OmnibarView.module.css';

type OmnibarMode = 'add' | 'search' | 'list' | 'pomodoro';

const MODES: Array<{ id: OmnibarMode; label: string; icon: string; placeholder: string }> = [
  { id: 'add', label: 'Add Task', icon: '➕', placeholder: "Type a task, #tag, @list, !priority, 🍅, or date (Esc to close)..." },
  { id: 'search', label: 'Search Tasks', icon: '🔍', placeholder: "Search tasks by keyword, notes, tags..." },
  { id: 'list', label: 'Open List', icon: '📋', placeholder: "Filter and switch list (e.g. My Day, Work, Inbox)..." },
  { id: 'pomodoro', label: 'Start Pomodoro', icon: '⏱️', placeholder: "Select or type focus session duration in minutes (e.g. 25, 50)..." },
];

const DEFAULT_LISTS = [
  { id: 'smart_my_day', name: 'My Day', icon: '☀️' },
  { id: 'smart_important', name: 'Important', icon: '⭐' },
  { id: 'smart_planned', name: 'Planned', icon: '📅' },
  { id: 'smart_all', name: 'All Tasks', icon: '📋' },
  { id: 'list_inbox', name: 'Inbox', icon: '📥' },
];

const POMODORO_PRESETS = [
  { minutes: 25, label: '25 Minutes (Standard Focus)' },
  { minutes: 50, label: '50 Minutes (Deep Work)' },
  { minutes: 15, label: '15 Minutes (Sprint)' },
];

export function OmnibarView(): React.ReactElement {
  const [mode, setMode] = useState<OmnibarMode>('add');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [parsed, setParsed] = useState<ParsedQuickAddResult | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentModeConfig = MODES.find((m) => m.id === mode) || MODES[0];

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Handle Tab / Shift+Tab mode cycling and Esc closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        ipc.invoke(IPC.APP.HIDE_OMNIBAR).catch(() => {});
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setMode((prev) => {
          const currentIndex = MODES.findIndex((m) => m.id === prev);
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + MODES.length) % MODES.length
            : (currentIndex + 1) % MODES.length;
          return MODES[nextIndex].id;
        });
        setInput('');
        setSelectedIndex(0);
        return;
      }

      // Up / Down arrow navigation for search / list / pomodoro results
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced action based on mode
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInput(val);
      setSelectedIndex(0);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!val.trim()) {
        setParsed(null);
        setSearchResults([]);
        return;
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (mode === 'add') {
          try {
            const res = await ipc.invoke<ParsedQuickAddResult>(IPC.NLP.PARSE, val);
            setParsed(res);
          } catch {
            setParsed(null);
          }
        } else if (mode === 'search') {
          try {
            const res = await ipc.invoke<{ ok: boolean; data: SearchResult[] }>(
              IPC.SEARCH.QUERY,
              val
            );
            if (res && Array.isArray(res.data)) {
              setSearchResults(res.data);
            } else if (Array.isArray(res)) {
              setSearchResults(res);
            }
          } catch {
            setSearchResults([]);
          }
        }
      }, 70);
    },
    [mode]
  );

  // Form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (mode === 'add') {
        const title = parsed?.cleanTitle || input.trim();
        if (!title) return;

        await ipc.invoke(IPC.TASKS.CREATE, {
          title,
          priority: parsed?.priority ?? 0,
          due_date: parsed?.dueDate ?? null,
          due_time: parsed?.dueTime ?? null,
          all_day: parsed?.allDay ? 1 : 0,
          recurrence_rule: parsed?.recurrenceRule ?? null,
        });
      } else if (mode === 'search') {
        if (searchResults.length > 0) {
          const selected = searchResults[selectedIndex % searchResults.length];
          if (selected) {
            // Focus task or notify
            await ipc.invoke(IPC.TASKS.GET_BY_ID, selected.id).catch(() => {});
          }
        }
      } else if (mode === 'list') {
        const filtered = DEFAULT_LISTS.filter((l) =>
          l.name.toLowerCase().includes(input.toLowerCase().trim())
        );
        const selected = filtered[selectedIndex % filtered.length];
        if (selected) {
          // Switch active list
          await ipc.invoke(IPC.LISTS.GET_BY_ID, selected.id).catch(() => {});
        }
      } else if (mode === 'pomodoro') {
        const customMins = parseInt(input.trim(), 10);
        const durationMinutes = !isNaN(customMins) && customMins > 0 ? customMins : 25;
        await ipc.invoke(IPC.POMODORO.START, {
          duration_seconds: durationMinutes * 60,
          session_type: 'work',
        });
      }

      setInput('');
      setParsed(null);
      await ipc.invoke(IPC.APP.HIDE_OMNIBAR);
    } catch (err) {
      console.error('[Omnibar] Action failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLists =
    mode === 'list'
      ? DEFAULT_LISTS.filter((l) =>
          l.name.toLowerCase().includes(input.toLowerCase().trim())
        )
      : [];

  return (
    <div
      className={styles.omnibarOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          ipc.invoke(IPC.APP.HIDE_OMNIBAR).catch(() => {});
        }
      }}
    >
      <div className={styles.omnibarCard} onClick={(e) => e.stopPropagation()}>
        {/* Mode Switcher Tabs */}
        <div className={styles.tabsRow}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`${styles.tabBtn} ${mode === m.id ? styles.tabBtnActive : ''}`}
              onClick={() => {
                setMode(m.id);
                setInput('');
                setSelectedIndex(0);
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
          <span className={styles.tabKeyHint}>Tab ⇥ to cycle</span>
        </div>

        {/* Input Row */}
        <form onSubmit={handleSubmit} className={styles.inputRow}>
          <svg
            className={styles.omnibarIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            className={styles.omnibarInput}
            placeholder={currentModeConfig.placeholder}
            value={input}
            onChange={handleInputChange}
            disabled={submitting}
            autoFocus
          />

          <kbd
            className={styles.escBadge}
            onClick={() => ipc.invoke(IPC.APP.HIDE_OMNIBAR).catch(() => {})}
          >
            ESC
          </kbd>
        </form>

        {/* Content Section by Mode */}
        <div className={styles.previewSection}>
          {mode === 'add' && (
            <>
              {parsed ? (
                <ParsePreviewChip parsed={parsed} />
              ) : (
                <div className={styles.emptyHint}>
                  Type natural language like <em>&ldquo;Buy groceries tomorrow @shopping !high 🍅&rdquo;</em>
                </div>
              )}
            </>
          )}

          {mode === 'search' && (
            <div className={styles.resultsList}>
              {searchResults.length === 0 ? (
                <div className={styles.emptyHint}>
                  {input.trim() ? 'No matching tasks found' : 'Type to search all tasks with FTS5'}
                </div>
              ) : (
                searchResults.slice(0, 8).map((res, i) => (
                  <div
                    key={res.id}
                    className={`${styles.resultItem} ${
                      selectedIndex % searchResults.length === i ? styles.resultActive : ''
                    }`}
                    onClick={() => {
                      setSelectedIndex(i);
                      handleSubmit();
                    }}
                  >
                    <div className={styles.resultLeft}>
                      <span>✓</span>
                      <div>
                        <div className={styles.resultTitle}>{res.title}</div>
                        {res.snippet && (
                          <div
                            className={styles.resultSnippet}
                            dangerouslySetInnerHTML={{ __html: res.snippet }}
                          />
                        )}
                      </div>
                    </div>
                    <span className={styles.resultBadge}>Task</span>
                  </div>
                ))
              )}
            </div>
          )}

          {mode === 'list' && (
            <div className={styles.resultsList}>
              {filteredLists.map((l, i) => (
                <div
                  key={l.id}
                  className={`${styles.resultItem} ${
                    selectedIndex % filteredLists.length === i ? styles.resultActive : ''
                  }`}
                  onClick={() => {
                    setSelectedIndex(i);
                    handleSubmit();
                  }}
                >
                  <div className={styles.resultLeft}>
                    <span>{l.icon}</span>
                    <span className={styles.resultTitle}>{l.name}</span>
                  </div>
                  <span className={styles.resultBadge}>List</span>
                </div>
              ))}
            </div>
          )}

          {mode === 'pomodoro' && (
            <div className={styles.resultsList}>
              {POMODORO_PRESETS.map((p, i) => (
                <div
                  key={p.minutes}
                  className={`${styles.resultItem} ${
                    selectedIndex % POMODORO_PRESETS.length === i ? styles.resultActive : ''
                  }`}
                  onClick={() => {
                    setSelectedIndex(i);
                    setInput(p.minutes.toString());
                    handleSubmit();
                  }}
                >
                  <div className={styles.resultLeft}>
                    <span>🍅</span>
                    <span className={styles.resultTitle}>{p.label}</span>
                  </div>
                  <span className={styles.resultBadge}>{p.minutes}m</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className={styles.hintRow}>
          <span>
            Press <span className={styles.hintShortcut}>↵ Enter</span> to execute •{' '}
            <span className={styles.hintShortcut}>↑/↓</span> to navigate
          </span>
          <span>OS11 Omnibar</span>
        </div>
      </div>
    </div>
  );
}

export default OmnibarView;
