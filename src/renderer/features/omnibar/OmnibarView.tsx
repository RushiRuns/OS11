import React, { useState, useEffect, useRef } from 'react';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './OmnibarView.module.css';

export function OmnibarView(): React.ReactElement {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on load
    inputRef.current?.focus();

    // Listen for Escape key to close omnibar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        ipc.invoke(IPC.APP.HIDE_OMNIBAR).catch(() => {});
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Quick heuristic parsing for live badge hints
  const tags = Array.from(input.matchAll(/#([a-zA-Z0-9_-]+)/g)).map((m) => m[1]);
  const listMatch = input.match(/@([a-zA-Z0-9_-]+)/);
  const listName = listMatch ? listMatch[1] : null;
  const priorityMatch = input.match(/!(urgent|high|med|low|p[1-4]|[1-4])/i);
  const hasPomodoro = input.includes('🍅');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    try {
      setSubmitting(true);
      await ipc.invoke(IPC.TASKS.CREATE, { title: input.trim() });
      setInput('');
      await ipc.invoke(IPC.APP.HIDE_OMNIBAR);
    } catch (err) {
      console.error('[Omnibar] Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.omnibarOverlay}>
      <div className={styles.omnibarCard}>
        <form onSubmit={handleSubmit} className={styles.inputRow}>
          <svg className={styles.omnibarIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            className={styles.omnibarInput}
            placeholder="Type a task, #tag, @list, !priority, 🍅, or date (Esc to close)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={submitting}
            autoFocus
          />

          <kbd className={styles.escBadge}>ESC</kbd>
        </form>

        <div className={styles.previewSection}>
          <div className={styles.badgesRow}>
            {tags.map((tag) => (
              <span key={tag} className={`${styles.badge} ${styles.badgeTag}`}>
                #{tag}
              </span>
            ))}
            {listName && (
              <span className={`${styles.badge} ${styles.badgeList}`}>
                @{listName}
              </span>
            )}
            {priorityMatch && (
              <span className={`${styles.badge} ${styles.badgePriority}`}>
                !{priorityMatch[1]}
              </span>
            )}
            {hasPomodoro && (
              <span className={`${styles.badge} ${styles.badgePomodoro}`}>
                🍅 Pomodoro
              </span>
            )}
          </div>

          <div className={styles.hintRow}>
            <span>Press <span className={styles.hintShortcut}>↵ Enter</span> to create task</span>
            <span>OS11 Quick Capture</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OmnibarView;
