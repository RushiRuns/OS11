import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useUserLists } from '../../stores/listStore.js';
import styles from './SettingsView.module.css';

export function GeneralSettings(): React.ReactElement {
  const [launchAtLogin, setLaunchAtLogin] = useState(true);
  const [dayStartsAt, setDayStartsAt] = useState('08:00');
  const [defaultListId, setDefaultListId] = useState('smart_my_day');
  const [autoArchiveDays, setAutoArchiveDays] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const userLists = useUserLists();

  useEffect(() => {
    async function load() {
      try {
        const res = await invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
        if (res) {
          if (typeof res.launch_at_login === 'boolean') setLaunchAtLogin(res.launch_at_login);
          if (typeof res.day_starts_at === 'string') setDayStartsAt(res.day_starts_at);
          if (typeof res.default_list_id === 'string') setDefaultListId(res.default_list_id);
          if (typeof res.auto_archive_days === 'number') setAutoArchiveDays(res.auto_archive_days);
        }
      } catch {
        // Defaults
      }
    }
    load();
  }, []);

  const handleLaunchAtLoginToggle = async () => {
    const next = !launchAtLogin;
    setLaunchAtLogin(next);
    await invoke(IPC.SETTINGS.SET, { key: 'launch_at_login', value: next });
  };

  const handleDayStartsAtChange = async (val: string) => {
    setDayStartsAt(val);
    await invoke(IPC.SETTINGS.SET, { key: 'day_starts_at', value: val });
  };

  const handleDefaultListChange = async (val: string) => {
    setDefaultListId(val);
    await invoke(IPC.SETTINGS.SET, { key: 'default_list_id', value: val });
  };

  const handleAutoArchiveChange = async (val: number) => {
    setAutoArchiveDays(val);
    await invoke(IPC.SETTINGS.SET, { key: 'auto_archive_days', value: val });
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>General Preferences</h2>
        <p className={styles.sectionDesc}>Configure application startup, day boundary, and default task behavior</p>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Startup & Day Schedule</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Launch at System Login</div>
            <div className={styles.settingDescription}>Automatically start OS11 in background on system login</div>
          </div>
          <Button
            variant={launchAtLogin ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleLaunchAtLoginToggle}
          >
            {launchAtLogin ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Day Starts At</div>
            <div className={styles.settingDescription}>Time of day when My Day resets and morning summary triggers</div>
          </div>
          <select
            className={styles.selectInput}
            value={dayStartsAt}
            onChange={(e) => handleDayStartsAtChange(e.target.value)}
          >
            <option value="05:00">5:00 AM</option>
            <option value="06:00">6:00 AM</option>
            <option value="07:00">7:00 AM</option>
            <option value="08:00">8:00 AM (Default)</option>
            <option value="09:00">9:00 AM</option>
            <option value="10:00">10:00 AM</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Quick-Add Default List</div>
            <div className={styles.settingDescription}>Target list for omnibar tasks created without a specified list</div>
          </div>
          <select
            className={styles.selectInput}
            value={defaultListId}
            onChange={(e) => handleDefaultListChange(e.target.value)}
          >
            <option value="smart_my_day">☀️ My Day</option>
            <option value="smart_all">📋 All Tasks</option>
            {userLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.icon || '📁'} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide Advanced Options ▲' : 'Show Advanced Options ▼'}
        </Button>

        {showAdvanced && (
          <div className={styles.settingGroup} style={{ marginTop: 'var(--space-4)' }}>
            <div className={styles.groupTitle}>Advanced Task Scheduling</div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Auto-Archive Completed Tasks</div>
                <div className={styles.settingDescription}>Automatically move completed tasks to archive after specified days</div>
              </div>
              <select
                className={styles.selectInput}
                value={autoArchiveDays}
                onChange={(e) => handleAutoArchiveChange(Number(e.target.value))}
              >
                <option value={0}>Never (Keep completed visible)</option>
                <option value={7}>After 7 days</option>
                <option value={14}>After 14 days</option>
                <option value={30}>After 30 days</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GeneralSettings;
