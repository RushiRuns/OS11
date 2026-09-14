import React, { useState, useEffect, useCallback } from 'react';
import { IPC } from '../../../shared/ipc-channels.js';
import type { Reminder } from '../../../shared/types/index.js';
import { invoke } from '../../services/ipc.js';
import styles from './ReminderEditor.module.css';

export interface ReminderEditorProps {
  taskId: string;
  dueDate?: string | null;
  dueTime?: string | null;
}

export function ReminderEditor({ taskId, dueDate, dueTime }: ReminderEditorProps): React.ReactElement {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [customDate, setCustomDate] = useState<string>(() => {
    return dueDate ?? new Date().toISOString().split('T')[0];
  });
  const [customTime, setCustomTime] = useState<string>(() => {
    return dueTime ?? '09:00';
  });

  const loadReminders = useCallback(async () => {
    try {
      const data = await invoke<Reminder[]>(IPC.REMINDERS.GET_BY_TASK, taskId);
      if (Array.isArray(data)) {
        setReminders(data);
      }
    } catch {
      // Best-effort load
    }
  }, [taskId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const addReminder = async (isoString: string) => {
    try {
      await invoke(IPC.REMINDERS.SET, {
        task_id: taskId,
        remind_at: isoString,
      });
      await loadReminders();
    } catch {
      // Failed to set reminder
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await invoke(IPC.REMINDERS.DELETE, id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Failed to delete
    }
  };

  const handleCustomAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate || !customTime) return;
    const isoString = new Date(`${customDate}T${customTime}:00`).toISOString();
    await addReminder(isoString);
  };

  const handlePresetAtDue = async () => {
    if (!dueDate) return;
    const time = dueTime || '09:00';
    const iso = new Date(`${dueDate}T${time}:00`).toISOString();
    await addReminder(iso);
  };

  const handlePresetOneHourBefore = async () => {
    let baseTime: number;
    if (dueDate) {
      const time = dueTime || '09:00';
      baseTime = new Date(`${dueDate}T${time}:00`).getTime();
    } else {
      baseTime = Date.now() + 2 * 60 * 60 * 1000;
    }
    const target = new Date(baseTime - 60 * 60 * 1000).toISOString();
    await addReminder(target);
  };

  const handlePresetOneDayBefore = async () => {
    let baseTime: number;
    if (dueDate) {
      const time = dueTime || '09:00';
      baseTime = new Date(`${dueDate}T${time}:00`).getTime();
    } else {
      baseTime = Date.now() + 2 * 24 * 60 * 60 * 1000;
    }
    const target = new Date(baseTime - 24 * 60 * 60 * 1000).toISOString();
    await addReminder(target);
  };

  const formatReminderDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.container}>
      {/* Existing Reminders List */}
      <div className={styles.reminderList}>
        {reminders.length === 0 ? (
          <span className={styles.emptyText}>No reminders set for this task</span>
        ) : (
          reminders.map((r) => (
            <div key={r.id} className={styles.reminderItem}>
              <div className={styles.reminderInfo}>
                <span className={styles.reminderIcon}>🔔</span>
                <span className={styles.reminderTime}>{formatReminderDate(r.remind_at)}</span>
                {r.is_triggered === 1 && (
                  <span className={styles.reminderStatus}>Triggered</span>
                )}
                {r.snoozed_until && (
                  <span className={styles.reminderStatus}>
                    Snoozed to {formatReminderDate(r.snoozed_until)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => deleteReminder(r.id)}
                title="Delete reminder"
                aria-label="Delete reminder"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Quick Presets */}
      <div className={styles.quickRow}>
        {dueDate && (
          <button type="button" className={styles.presetBtn} onClick={handlePresetAtDue}>
            + At due time
          </button>
        )}
        <button type="button" className={styles.presetBtn} onClick={handlePresetOneHourBefore}>
          + 1 hour before
        </button>
        <button type="button" className={styles.presetBtn} onClick={handlePresetOneDayBefore}>
          + 1 day before
        </button>
      </div>

      {/* Custom Add Form */}
      <form onSubmit={handleCustomAdd} className={styles.customAddRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          aria-label="Reminder Date"
        />
        <input
          type="time"
          className={styles.timeInput}
          value={customTime}
          onChange={(e) => setCustomTime(e.target.value)}
          aria-label="Reminder Time"
        />
        <button type="submit" className={styles.addBtn}>
          Add
        </button>
      </form>
    </div>
  );
}

export default ReminderEditor;
