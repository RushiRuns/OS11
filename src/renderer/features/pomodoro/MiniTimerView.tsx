import React, { useState, useEffect } from 'react';
import { IPC } from '../../../shared/ipc-channels.js';
import type { ActivePomodoroSession } from '../../../shared/types/index.js';
import { invoke, ipc } from '../../services/ipc.js';
import styles from './MiniTimerView.module.css';

export function MiniTimerView(): React.ReactElement {
  const [session, setSession] = useState<ActivePomodoroSession | null>(null);
  const [timeText, setTimeText] = useState<string>('25:00');
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  useEffect(() => {
    const unsub = ipc.on(
      'pomodoro:state-update',
      (_event, payload: unknown) => {
        const data = payload as {
          activeSession: ActivePomodoroSession | null;
          timeText: string | null;
          taskTitle?: string | null;
          sourceView?: string | null;
        };
        if (data) {
          setSession(data.activeSession);
          if (data.timeText) {
            setTimeText(data.timeText);
          } else if (!data.activeSession) {
            setTimeText('25:00');
          }
          if (data.taskTitle !== undefined) {
            setTaskTitle(data.taskTitle);
          } else if (data.activeSession?.taskTitle !== undefined) {
            setTaskTitle(data.activeSession.taskTitle);
          } else if (!data.activeSession) {
            setTaskTitle(null);
          }
        }
      }
    );

    return () => {
      unsub?.();
    };
  }, []);

  const handleAction = async (action: 'pause' | 'resume' | 'skip' | 'reset' | 'complete') => {
    try {
      if (action === 'reset') {
        setTimeText('25:00');
        setSession(null);
        setTaskTitle(null);
      }
      await invoke(IPC.POMODORO.ACTION, action);
    } catch {
      // Ignore
    }
  };

  const isPaused = session?.isPaused ?? false;
  const sessionType = session?.type ?? 'work';
  const typeLabel =
    sessionType === 'work' ? 'Focus' : sessionType === 'short_break' ? 'Short Break' : 'Long Break';

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.leftInfo}>
          <span className={styles.tomato}>🍅</span>
          <div className={styles.timeWrap}>
            <span className={styles.timeText}>{timeText}</span>
            <span className={styles.typeLabel}>{typeLabel}</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.completeBtn}`}
            onClick={() => handleAction('complete')}
            title="Complete Task"
            aria-label="Complete Task"
          >
            ✓
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => handleAction(isPaused ? 'resume' : 'pause')}
            title={isPaused ? 'Resume' : 'Pause'}
            aria-label={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => handleAction('skip')}
            title="Skip"
            aria-label="Skip"
          >
            ⏭
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => handleAction('reset')}
            title="Close / Reset"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className={styles.taskRow}>
        {taskTitle ? (
          <span className={styles.taskTitle} title={taskTitle}>
            {taskTitle}
          </span>
        ) : (
          <span className={styles.taskPlaceholder}>
            No task linked
          </span>
        )}
      </div>
    </div>
  );
}

export default MiniTimerView;
