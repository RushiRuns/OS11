import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './SettingsView.module.css';

export function PrivacySettings(): React.ReactElement {
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [stealthMode, setStealthMode] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [trashDeletedMessage, setTrashDeletedMessage] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const status = await invoke<{ isEnabled: boolean; isLocked: boolean }>(IPC.SECURITY.GET_STATUS);
        if (status) {
          setAppLockEnabled(status.isEnabled);
        }
        const res = await invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
        if (res && typeof res.stealth_mode === 'boolean') {
          setStealthMode(res.stealth_mode);
        }
      } catch {
        // Defaults
      }
    }
    load();
  }, []);

  const handleToggleLock = async () => {
    if (!appLockEnabled) {
      // Opening modal to configure new PIN
      setPinInput('');
      setPinConfirm('');
      setPinError('');
      setIsPinModalOpen(true);
    } else {
      // Prompt or disable
      try {
        await invoke(IPC.SECURITY.SET_ENABLED, { enabled: false });
        setAppLockEnabled(false);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError('PIN entries do not match');
      return;
    }

    try {
      await invoke(IPC.SECURITY.SET_PIN, { pin: pinInput });
      setAppLockEnabled(true);
      setIsPinModalOpen(false);
      setPinInput('');
      setPinConfirm('');
      setPinError('');
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Failed to save PIN');
    }
  };

  const handleLockNow = async () => {
    try {
      await invoke(IPC.SECURITY.LOCK);
      window.location.reload();
    } catch {
      // Ignore
    }
  };

  const handleStealthToggle = async () => {
    const next = !stealthMode;
    setStealthMode(next);
    await invoke(IPC.SETTINGS.SET, { key: 'stealth_mode', value: next });
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to permanently delete all items in Trash? This cannot be undone.')) {
      return;
    }
    try {
      const count = await invoke<number>(IPC.SETTINGS.EMPTY_TRASH);
      setTrashDeletedMessage(`Emptied trash (${count ?? 0} items permanently deleted).`);
      setTimeout(() => setTrashDeletedMessage(''), 4000);
    } catch {
      setTrashDeletedMessage('Failed to empty trash.');
    }
  };

  const handleFactoryReset = async () => {
    try {
      await invoke(IPC.SETTINGS.RESET);
      setIsResetConfirmOpen(false);
      window.location.reload();
    } catch {
      // Ignore
    }
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Privacy & Security</h2>
        <p className={styles.sectionDesc}>Local encryption, OS keychain App Lock, and data lifecycle management</p>
      </div>

      {/* App Lock */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>App Lock (PIN Protection)</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Passcode Protection</div>
            <div className={styles.settingDescription}>
              Encrypt and lock OS11 behind a secure PIN stored in the OS Keychain via Keytar
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {appLockEnabled && (
              <Button variant="ghost" size="sm" onClick={handleLockNow}>
                🔒 Lock Now
              </Button>
            )}
            <Button
              variant={appLockEnabled ? 'primary' : 'ghost'}
              size="sm"
              onClick={handleToggleLock}
            >
              {appLockEnabled ? 'Enabled ✓' : 'Setup PIN'}
            </Button>
          </div>
        </div>

        {isPinModalOpen && (
          <div
            style={{
              marginTop: 'var(--space-3)',
              padding: 'var(--space-4)',
              background: 'var(--surface-base)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
              Set New Application PIN
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <input
                type="password"
                maxLength={6}
                placeholder="4-6 digit PIN"
                className={styles.textInput}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                style={{ width: '140px' }}
              />
              <input
                type="password"
                maxLength={6}
                placeholder="Confirm PIN"
                className={styles.textInput}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                style={{ width: '140px' }}
              />
              <Button variant="primary" size="sm" onClick={handleSavePin}>
                Save PIN
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsPinModalOpen(false)}>
                Cancel
              </Button>
            </div>

            {pinError && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)' }}>{pinError}</div>
            )}
          </div>
        )}
      </div>

      {/* Stealth Mode */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Display Privacy</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Stealth Mode (Masking)</div>
            <div className={styles.settingDescription}>
              Automatically blur task titles when the application window loses focus
            </div>
          </div>
          <Button
            variant={stealthMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleStealthToggle}
          >
            {stealthMode ? 'Active' : 'Off'}
          </Button>
        </div>
      </div>

      {/* Data Management */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Data Storage & Cleanup</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Empty Trash</div>
            <div className={styles.settingDescription}>
              Permanently delete all tasks currently located in the trash bin
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleEmptyTrash}>
            🗑️ Empty Trash
          </Button>
        </div>

        {trashDeletedMessage && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>
            {trashDeletedMessage}
          </div>
        )}

        <div className={styles.settingRow} style={{ marginTop: 'var(--space-2)' }}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel} style={{ color: 'var(--color-danger)' }}>
              Factory Reset Preferences
            </div>
            <div className={styles.settingDescription}>
              Reset all application settings, themes, and feature toggles to defaults
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            style={{ color: 'var(--color-danger)' }}
          >
            Reset All Settings
          </Button>
        </div>

        {isResetConfirmOpen && (
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--color-danger-muted)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
              Are you sure? This will revert all appearance, shortcut, and module settings.
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsResetConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleFactoryReset} style={{ backgroundColor: 'var(--color-danger)' }}>
                Confirm Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PrivacySettings;
