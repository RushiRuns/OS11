import React, { useState, useEffect } from 'react';
import { IPC } from '../../../shared/ipc-channels.js';
import type { ActivePomodoroSession } from '../../../shared/types/index.js';
import { invoke, ipc } from '../../services/ipc.js';
import styles from './MiniTimerView.module.css';

export function MiniTimerView(): React.ReactElement {
  const [session, setSession] = useState<ActivePomodoroSession | null>(null);
  const [timeText, setTimeText] = useState<string>('25:00');

  useEffect(() => {
    const unsub = ipc.on(
      'pomodoro:state-update',
      (_event, payload: unknown) => {
        const data = payload as { activeSession: ActivePomodoroSession | null; timeText: string | null };
        if (data) {
          setSession(data.activeSession);
          if (data.timeText) {
            setTimeText(data.timeText);
          }
        }
      }
    );

    return () => {
      unsub?.();
    };
  }, []);

  const handleAction = async (action: 'pause' | 'resume' | 'skip' | 'reset') => {
    try {
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
  );
}

export default MiniTimerView;
