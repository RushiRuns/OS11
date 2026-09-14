import React, { useState, useEffect } from 'react';
import { Button } from '../../components/Button/Button.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { playPomodoroSound } from '../../utils/audio.js';
import styles from './SettingsView.module.css';

export function NotificationSettings(): React.ReactElement {
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [notificationSound, setNotificationSound] = useState('chime');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [pomodoroAlerts, setPomodoroAlerts] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
        if (res) {
          if (typeof res.quiet_hours_enabled === 'boolean') setQuietHoursEnabled(res.quiet_hours_enabled);
          if (typeof res.quiet_hours_start === 'string') setQuietHoursStart(res.quiet_hours_start);
          if (typeof res.quiet_hours_end === 'string') setQuietHoursEnd(res.quiet_hours_end);
          if (typeof res.notification_sound === 'string') setNotificationSound(res.notification_sound);
        }
      } catch {
        // Defaults
      }
    }
    load();
  }, []);

  const handleQuietToggle = async () => {
    const next = !quietHoursEnabled;
    setQuietHoursEnabled(next);
    await invoke(IPC.SETTINGS.SET, { key: 'quiet_hours_enabled', value: next });
  };

  const handleSoundChange = async (val: string) => {
    setNotificationSound(val);
    await invoke(IPC.SETTINGS.SET, { key: 'notification_sound', value: val });
  };

  const handleTestSound = () => {
    playPomodoroSound(notificationSound as 'chime');
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Notifications & Quiet Hours</h2>
        <p className={styles.sectionDesc}>Configure reminder alerts, Do Not Disturb schedules, and audio feedback</p>
      </div>

      {/* Quiet Hours */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Quiet Hours (Do Not Disturb)</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Scheduled Quiet Hours</div>
            <div className={styles.settingDescription}>Mute all non-critical notifications during sleep or focus windows</div>
          </div>
          <Button
            variant={quietHoursEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleQuietToggle}
          >
            {quietHoursEnabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        {quietHoursEnabled && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Active Window</div>
              <div className={styles.settingDescription}>Start and end times for DND mode</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="time"
                className={styles.selectInput}
                value={quietHoursStart}
                onChange={async (e) => {
                  setQuietHoursStart(e.target.value);
                  await invoke(IPC.SETTINGS.SET, { key: 'quiet_hours_start', value: e.target.value });
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>to</span>
              <input
                type="time"
                className={styles.selectInput}
                value={quietHoursEnd}
                onChange={async (e) => {
                  setQuietHoursEnd(e.target.value);
                  await invoke(IPC.SETTINGS.SET, { key: 'quiet_hours_end', value: e.target.value });
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category Toggles */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Notification Categories</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Task Reminders & Due Dates</div>
            <div className={styles.settingDescription}>Scheduled deadline notifications</div>
          </div>
          <Button
            variant={remindersEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setRemindersEnabled(!remindersEnabled)}
          >
            {remindersEnabled ? 'On' : 'Off'}
          </Button>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Daily Morning Briefing</div>
            <div className={styles.settingDescription}>Summary notification of today’s tasks at day start</div>
          </div>
          <Button
            variant={briefingEnabled ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setBriefingEnabled(!briefingEnabled)}
          >
            {briefingEnabled ? 'On' : 'Off'}
          </Button>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Pomodoro Session Alerts</div>
            <div className={styles.settingDescription}>Interval completion and break transition reminders</div>
          </div>
          <Button
            variant={pomodoroAlerts ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setPomodoroAlerts(!pomodoroAlerts)}
          >
            {pomodoroAlerts ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {/* Audio Sound */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Audio Notification Tone</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Alert Tone</div>
            <div className={styles.settingDescription}>Harmonic sound played when a reminder fires</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <select
              className={styles.selectInput}
              value={notificationSound}
              onChange={(e) => handleSoundChange(e.target.value)}
            >
              <option value="chime">Calm Chime (Default)</option>
              <option value="bell">Tibetan Bell</option>
              <option value="calm">Gentle Harmonic</option>
              <option value="digital">Digital Pulse</option>
              <option value="none">Mute (Silent)</option>
            </select>

            <Button variant="ghost" size="sm" onClick={handleTestSound}>
              ▶ Test Tone
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;
