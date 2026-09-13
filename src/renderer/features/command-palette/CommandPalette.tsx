import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore } from '../../stores/listStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useSearchStore } from '../../stores/searchStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './CommandPalette.module.css';

interface PaletteItem {
  id: string;
  title: string;
  category: 'Action' | 'List' | 'Task' | 'Settings';
  icon: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleFocusMode?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onToggleFocusMode,
}: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setActiveListId, activeListId } = useAppStore();
  const listsById = useListStore((state) => state.listsById);
  const tasksById = useTaskStore((state) => state.tasksById);
  const { setSelectedTaskId } = useTaskStore();
  const { openSearch } = useSearchStore();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  // Build items catalogue
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // Core Actions
    items.push({
      id: 'action_focus_mode',
      title: 'Toggle Focus Mode',
      category: 'Action',
      icon: '🎯',
      shortcut: 'Ctrl+Shift+F',
      onSelect: () => onToggleFocusMode?.(),
    });

    items.push({
      id: 'action_quick_add',
      title: 'Quick Add Task',
      category: 'Action',
      icon: '➕',
      shortcut: 'Ctrl+N',
      onSelect: () => {
        const input = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
        input?.focus();
      },
    });

    items.push({
      id: 'action_search',
      title: 'Search Tasks (Full-Text Search)',
      category: 'Action',
      icon: '🔍',
      shortcut: 'Ctrl+F',
      onSelect: () => openSearch(),
    });

    items.push({
      id: 'action_theme',
      title: 'Toggle Dark / Light Theme',
      category: 'Action',
      icon: '🌓',
      shortcut: 'Ctrl+Shift+T',
      onSelect: async () => {
        const root = document.documentElement;
        const currentTheme = root.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', nextTheme);
        try {
          await ipc.invoke(IPC.SETTINGS.SET, { key: 'theme', value: nextTheme });
        } catch {
          // ignore
        }
      },
    });

    items.push({
      id: 'action_pomodoro',
      title: 'Start 25m Pomodoro Focus Session',
      category: 'Action',
      icon: '⏱️',
      onSelect: async () => {
        try {
          await ipc.invoke(IPC.POMODORO.START, {
            duration_seconds: 25 * 60,
            session_type: 'work',
          });
        } catch {
          // ignore
        }
      },
    });

    items.push({
      id: 'action_settings',
      title: 'Open Settings',
      category: 'Settings',
      icon: '⚙️',
      onSelect: () => setActiveListId('view_settings'),
    });

    // Lists
    Object.values(listsById).forEach((list) => {
      items.push({
        id: `list_${list.id}`,
        title: `Open List: ${list.name}`,
        category: 'List',
        icon: list.icon || '📋',
        onSelect: () => setActiveListId(list.id),
      });
    });

    // Recent Active Tasks (up to 20)
    const activeTasks = Object.values(tasksById)
      .filter((t) => t.is_trashed === 0 && t.is_completed === 0)
      .slice(0, 20);

    activeTasks.forEach((task) => {
      items.push({
        id: `task_${task.id}`,
        title: task.title,
        category: 'Task',
        icon: '✓',
        onSelect: () => {
          if (task.list_id && task.list_id !== activeListId) {
            setActiveListId(task.list_id);
          }
          setSelectedTaskId(task.id);
        },
      });
    });

    return items;
  }, [listsById, tasksById, activeListId, setActiveListId, setSelectedTaskId, openSearch, onToggleFocusMode]);

  // Fuzzy filter items
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 12);

    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [allItems, query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((selectedIndex + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((selectedIndex - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        selected.onSelect();
        onClose();
      }
    }
  };

  const handleItemClick = (item: PaletteItem) => {
    item.onSelect();
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className={styles.modal}>
        <div className={styles.inputWrapper}>
          <svg
            className={styles.searchIcon}
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
            className={styles.input}
            placeholder="Type a command, search lists, or find tasks..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />

          <kbd className={styles.escBadge} onClick={onClose}>
            ESC
          </kbd>
        </div>

        <div className={styles.itemList}>
          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>No matching commands or tasks found</div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className={`${styles.item} ${idx === selectedIndex ? styles.itemActive : ''}`}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className={styles.itemLeft}>
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.itemTitle}>{item.title}</span>
                </div>
                <div className={styles.itemRight}>
                  {item.shortcut && (
                    <span className={styles.shortcutBadge}>{item.shortcut}</span>
                  )}
                  <span className={styles.itemCategory}>{item.category}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.footerHint}>
          <span>
            Navigate <kbd>↑</kbd> <kbd>↓</kbd> • Select <kbd>↵</kbd>
          </span>
          <span>Command Palette (Ctrl+K)</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
