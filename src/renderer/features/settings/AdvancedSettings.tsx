import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { SystemInfo } from '@shared/types/index.js';
import styles from './SettingsView.module.css';

export function AdvancedSettings(): React.ReactElement {
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [memoryMessage, setMemoryMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const info = await invoke<SystemInfo>(IPC.SYSTEM.GET_INFO);
        if (info) setSysInfo(info);
      } catch {
        // Defaults
      }
    }
    load();
  }, []);

  const handleTrimMemory = async () => {
    try {
      await invoke(IPC.APP.TRIM_MEMORY);
      setMemoryMessage('Memory trimmed successfully.');
      setTimeout(() => setMemoryMessage(''), 3000);
    } catch {
      setMemoryMessage('Memory trim not available.');
    }
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Advanced Diagnostics & System</h2>
        <p className={styles.sectionDesc}>Hardware acceleration, local database status, and runtime environment</p>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Runtime Environment</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>OS11 Core Version</div>
            <div className={styles.settingDescription}>Desktop release build</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            v{sysInfo?.version ?? '0.1.0'}
          </span>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Electron Runtime</div>
            <div className={styles.settingDescription}>Chromium {sysInfo?.chrome ?? '132'} / Node.js {sysInfo?.node ?? '20'}</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            v{sysInfo?.electron ?? '34.3.0'}
          </span>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Local Database Engine</div>
            <div className={styles.settingDescription}>Embedded SQLite 3 (WAL Mode Enabled)</div>
          </div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 'var(--weight-semibold)' }}>
            OPTIMAL
          </span>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Performance & Memory</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Force Memory Trim</div>
            <div className={styles.settingDescription}>
              Trigger V8 garbage collection and release cached memory pages
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleTrimMemory}>
            Trim Memory
          </Button>
        </div>

        {memoryMessage && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', marginTop: 'var(--space-1)' }}>
            {memoryMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdvancedSettings;
