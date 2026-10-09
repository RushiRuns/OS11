import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/Button/Button.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import {
  useShortcutStore,
  DEFAULT_SHORTCUTS,
  type ShortcutConflict,
} from '../../stores/shortcutStore.js';
import styles from './SettingsView.module.css';

export function KeyboardSettings(): React.ReactElement {
  const isVimEnabled = useModuleStore((state) => state.isEnabled('vim_keybindings'));
  const toggleModule = useModuleStore((state) => state.toggleModule);

  const {
    shortcuts,
    recordingActionId,
    loadShortcuts,
    updateShortcut,
    resetShortcut,
    resetAllToDefault,
    isCustomized,
    findConflict,
    startRecording,
    stopRecording,
  } = useShortcutStore();

  const [filterText, setFilterText] = useState('');
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [conflict, setConflict] = useState<ShortcutConflict | null>(null);

  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Handle key recording when an action is being recorded
  const handleRecordKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (!recordingActionId) return;

      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        stopRecording();
        setRecordedKeys([]);
        setConflict(null);
        return;
      }

      // Modifier key alone: show current modifier state
      const isModifierOnly =
        e.key === 'Control' ||
        e.key === 'Shift' ||
        e.key === 'Alt' ||
        e.key === 'Meta';

      const currentMods: string[] = [];
      if (e.ctrlKey) currentMods.push('Ctrl');
      if (e.altKey) currentMods.push('Alt');
      if (e.shiftKey) currentMods.push('Shift');
      if (e.metaKey) currentMods.push('Meta');

      if (isModifierOnly) {
        setRecordedKeys(currentMods);
        return;
      }

      // Primary key pressed
      let primaryKey = e.key;
      if (primaryKey === ' ') primaryKey = 'Space';
      else if (primaryKey.length === 1) primaryKey = primaryKey.toUpperCase();
      else primaryKey = primaryKey.charAt(0).toUpperCase() + primaryKey.slice(1);

      const fullCombo = [...currentMods, primaryKey];
      setRecordedKeys(fullCombo);

      // Conflict detection
      const foundConflict = findConflict(recordingActionId, fullCombo);
      if (foundConflict) {
        setConflict(foundConflict);
        // Disallow saving until the user picks a non-conflicting key
        return;
      }

      // No conflict: save and finish recording
      setConflict(null);
      await updateShortcut(recordingActionId, fullCombo);
      setRecordedKeys([]);
    },
    [recordingActionId, findConflict, updateShortcut, stopRecording]
  );

  useEffect(() => {
    if (recordingActionId) {
      window.addEventListener('keydown', handleRecordKeyDown, true);
      return () => {
        window.removeEventListener('keydown', handleRecordKeyDown, true);
      };
    }
  }, [recordingActionId, handleRecordKeyDown]);

  const handleStartRecording = (actionId: string) => {
    setRecordedKeys([]);
    setConflict(null);
    startRecording(actionId);
  };

  const handleCancelRecording = () => {
    setRecordedKeys([]);
    setConflict(null);
    stopRecording();
  };

  const filtered = DEFAULT_SHORTCUTS.filter(
    (s) =>
      s.label.toLowerCase().includes(filterText.toLowerCase()) ||
      s.category.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Keyboard Shortcuts & Vim Mode</h2>
        <p className={styles.sectionDesc}>
          Keyboard-driven shortcuts, conflict detection, and optional Vim modal bindings
        </p>
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div className={styles.groupTitle} style={{ margin: 0 }}>
            Registered Shortcuts
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="text"
              placeholder="Search shortcuts..."
              className={styles.textInput}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ width: '180px', fontSize: 'var(--text-xs)' }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetAllToDefault()}
              title="Reset all customized shortcuts back to original defaults"
            >
              Reset All to Default
            </Button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-raised)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
          }}
        >
          {filtered.map((s) => {
            const isRecording = recordingActionId === s.id;
            const currentKeys = shortcuts[s.id] || s.defaultKeys;
            const customized = isCustomized(s.id);

            return (
              <div key={s.id} className={styles.shortcutRow}>
                <div style={{ flex: 1, marginRight: 'var(--space-4)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      fontWeight: 'var(--weight-medium)',
                    }}
                  >
                    <span>{s.label}</span>
                    {customized && <span className={styles.badgeCustom}>Custom</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {s.category}
                  </div>

                  {isRecording && conflict && (
                    <div className={styles.conflictBadge}>
                      ⚠️ Conflict: Already assigned to &ldquo;{conflict.label}&rdquo;. Choose another key.
                    </div>
                  )}
                </div>

                <div className={styles.shortcutActionButtons}>
                  {isRecording ? (
                    <>
                      <div className={styles.recordingPill}>
                        {recordedKeys.length > 0
                          ? recordedKeys.join(' + ')
                          : 'Press key combination (Esc to cancel)...'}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelRecording}
                        title="Cancel recording"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{ display: 'flex', gap: 'var(--space-1)' }}
                        onClick={() => handleStartRecording(s.id)}
                        title="Click to customize shortcut"
                      >
                        {currentKeys.map((k, kIdx) => (
                          <span key={kIdx} className={styles.shortcutKeyInteractive}>
                            {k}
                          </span>
                        ))}
                      </div>

                      {customized && (
                        <button
                          type="button"
                          className={styles.resetPillBtn}
                          onClick={() => resetShortcut(s.id)}
                          title="Reset this shortcut to default"
                        >
                          ↺ Reset
                        </button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartRecording(s.id)}
                      >
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div
              style={{
                padding: 'var(--space-6)',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              No shortcuts match your search query.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KeyboardSettings;
