import React, { useState } from 'react';
import { Button } from '../../components/Button/Button.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import styles from './SettingsView.module.css';

interface ShortcutItem {
  category: string;
  action: string;
  keys: string[];
}

const SHORTCUTS: ShortcutItem[] = [
  { category: 'Navigation', action: 'Open Command Palette', keys: ['Ctrl', 'K'] },
  { category: 'Navigation', action: 'Toggle Full-Screen Focus Mode', keys: ['Ctrl', 'Shift', 'F'] },
  { category: 'Navigation', action: 'Navigate to Today (My Day)', keys: ['G', 'T'] },
  { category: 'Navigation', action: 'Navigate to Agenda View', keys: ['G', 'A'] },
  { category: 'Navigation', action: 'Open Global Preferences', keys: ['Ctrl', ','] },
  { category: 'Tasks', action: 'Quick Add Task (Global Omnibar)', keys: ['Ctrl', 'Space'] },
  { category: 'Tasks', action: 'Mark Selected Task Complete', keys: ['Space'] },
  { category: 'Tasks', action: 'Star / Unstar Task', keys: ['S'] },
  { category: 'Tasks', action: 'Delete Task (Move to Trash)', keys: ['Delete'] },
  { category: 'Tasks', action: 'Duplicate Selected Task', keys: ['Ctrl', 'D'] },
  { category: 'Editing', action: 'Undo Last Action', keys: ['Ctrl', 'Z'] },
  { category: 'Editing', action: 'Redo Last Action', keys: ['Ctrl', 'Shift', 'Z'] },
];

export function KeyboardSettings(): React.ReactElement {
  const isVimEnabled = useModuleStore((state) => state.isEnabled('vim_keybindings'));
  const toggleModule = useModuleStore((state) => state.toggleModule);
  const [filterText, setFilterText] = useState('');

  const filtered = SHORTCUTS.filter(
    (s) =>
      s.action.toLowerCase().includes(filterText.toLowerCase()) ||
      s.category.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Keyboard Shortcuts & Vim Mode</h2>
        <p className={styles.sectionDesc}>Keyboard-driven shortcuts, conflict detection, and optional Vim modal bindings</p>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Vim Keybindings Mode</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Vim Navigation Controls</div>
            <div className={styles.settingDescription}>
              Use j/k for list navigation, x for completion, / for search, and esc to blur inputs
            </div>
          </div>

          <Button
            variant={isVimEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => toggleModule('vim_keybindings', !isVimEnabled)}
          >
            {isVimEnabled ? 'Enabled ✓' : 'Disabled'}
          </Button>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <div className={styles.groupTitle} style={{ margin: 0 }}>Registered Shortcuts</div>
          <input
            type="text"
            placeholder="Search shortcuts..."
            className={styles.textInput}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ width: '200px', fontSize: 'var(--text-xs)' }}
          />
        </div>

        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {filtered.map((s, idx) => (
            <div key={idx} className={styles.shortcutRow}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>
                  {s.action}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.category}</div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                {s.keys.map((k, kIdx) => (
                  <span key={kIdx} className={styles.shortcutKey}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
              No shortcuts match your search query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeyboardSettings;
