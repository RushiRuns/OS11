import { create } from 'zustand';
import { IPC } from '../../shared/ipc-channels.js';
import type {
  ActivePomodoroSession,
  PomodoroSettings,
  PomodoroType,
  PomodoroSession,
} from '../../shared/types/index.js';
import { invoke, ipc } from '../services/ipc.js';
import { playPomodoroSound } from '../utils/audio.js';
import { useTaskStore } from './taskStore.js';

export interface PomodoroState {
  activeSession: ActivePomodoroSession | null;
  sessionCount: number;
  settings: PomodoroSettings;
  isFocusMode: boolean;
  isMiniWindowOpen: boolean;

  // Actions
  startSession: (taskId?: string | null, type?: PomodoroType) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  skipSession: () => Promise<void>;
  resetTimer: () => void;
  tickElapsed: () => void;
  linkTask: (taskId: string | null) => void;
  updateSettings: (newSettings: Partial<PomodoroSettings>) => void;
  toggleFocusMode: (enabled?: boolean) => void;
  toggleMiniWindow: () => Promise<void>;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStart: false,
  soundAlert: 'chime',
  dndEnabled: true,
};

let timerInterval: ReturnType<typeof setInterval> | null = null;

export const usePomodoroStore = create<PomodoroState>((set, get) => {
  const syncToMain = (session: ActivePomodoroSession | null) => {
    if (!session) {
      invoke(IPC.POMODORO.SYNC_STATE, {
        activeSession: null,
        timeText: null,
        progress: 0,
      }).catch(() => {});
      return;
    }

    const remaining = Math.max(0, session.durationSeconds - session.elapsedSeconds);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timeText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const progress = session.durationSeconds > 0 ? (session.durationSeconds - session.elapsedSeconds) / session.durationSeconds : 0;

    invoke(IPC.POMODORO.SYNC_STATE, {
      activeSession: session,
      timeText,
      progress,
    }).catch(() => {});
  };

  const startInterval = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      get().tickElapsed();
    }, 1000);
  };

  const stopInterval = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };

  // Wire listener for remote actions from Tray context menu or Mini Timer window
  if (typeof window !== 'undefined') {
    ipc.on('pomodoro:remote-action', (_event, rawAction: unknown) => {
      const action = rawAction as 'pause' | 'resume' | 'skip' | 'reset';
      if (action === 'pause') {
        get().pauseSession();
      } else if (action === 'resume') {
        get().resumeSession();
      } else if (action === 'skip') {
        get().skipSession();
      } else if (action === 'reset') {
        get().resetTimer();
      }
    });
  }

  return {
    activeSession: null,
    sessionCount: 0,
    settings: { ...DEFAULT_SETTINGS },
    isFocusMode: false,
    isMiniWindowOpen: false,

    startSession: async (taskId = null, type = 'work') => {
      stopInterval();
      const settings = get().settings;
      const duration =
        type === 'work'
          ? settings.workMinutes * 60
          : type === 'short_break'
            ? settings.breakMinutes * 60
            : settings.longBreakMinutes * 60;

      let sessionId = `session-${Date.now()}`;
      try {
        const record = await invoke<PomodoroSession>(IPC.POMODORO.START, {
          task_id: taskId,
          type,
          duration_seconds: duration,
        });
        if (record?.id) sessionId = record.id;
      } catch {
        // Fallback to local session ID
      }

      const session: ActivePomodoroSession = {
        id: sessionId,
        taskId: taskId ?? null,
        type,
        durationSeconds: duration,
        elapsedSeconds: 0,
        isPaused: false,
      };

      set({ activeSession: session });
      startInterval();
      syncToMain(session);
    },

    pauseSession: () => {
      stopInterval();
      const session = get().activeSession;
      if (session) {
        const updated = { ...session, isPaused: true };
        set({ activeSession: updated });
        syncToMain(updated);
      }
    },

    resumeSession: () => {
      const session = get().activeSession;
      if (session) {
        const updated = { ...session, isPaused: false };
        set({ activeSession: updated });
        startInterval();
        syncToMain(updated);
      }
    },

    skipSession: async () => {
      stopInterval();
      const session = get().activeSession;
      if (!session) return;

      try {
        await invoke(IPC.POMODORO.STOP, { id: session.id, endedAt: new Date().toISOString() });
      } catch {
        // Ignore
      }

      const { settings, sessionCount } = get();
      let nextType: PomodoroType = 'work';
      let nextCount = sessionCount;

      if (session.type === 'work') {
        nextCount = sessionCount + 1;
        if (nextCount >= settings.sessionsBeforeLongBreak) {
          nextType = 'long_break';
          nextCount = 0;
        } else {
          nextType = 'short_break';
        }
      } else {
        nextType = 'work';
      }

      set({ sessionCount: nextCount });
      await get().startSession(session.taskId, nextType);
    },

    resetTimer: () => {
      stopInterval();
      const session = get().activeSession;
      if (session) {
        invoke(IPC.POMODORO.STOP, { id: session.id, endedAt: new Date().toISOString() }).catch(() => {});
      }
      set({ activeSession: null });
      syncToMain(null);
    },

    tickElapsed: () => {
      const session = get().activeSession;
      if (!session || session.isPaused) return;

      const nextElapsed = session.elapsedSeconds + 1;
      if (nextElapsed >= session.durationSeconds) {
        // Session complete!
        stopInterval();
        playPomodoroSound(get().settings.soundAlert);

        // Record completion in DB
        invoke(IPC.POMODORO.STOP, { id: session.id, endedAt: new Date().toISOString() }).catch(() => {});

        // If work session and task linked, increment task pomodoro count and refresh store
        if (session.type === 'work' && session.taskId) {
          invoke(IPC.TASKS.INCREMENT_POMODORO, session.taskId)
            .then(() => useTaskStore.getState().loadTasks())
            .catch(() => {});
        }

        const { settings, sessionCount } = get();
        let nextType: PomodoroType = 'work';
        let nextCount = sessionCount;

        if (session.type === 'work') {
          nextCount = sessionCount + 1;
          if (nextCount >= settings.sessionsBeforeLongBreak) {
            nextType = 'long_break';
            nextCount = 0;
          } else {
            nextType = 'short_break';
          }
        } else {
          nextType = 'work';
        }

        set({ sessionCount: nextCount });

        if (settings.autoStart) {
          get().startSession(session.taskId, nextType);
        } else {
          // Prepare next session in paused state
          const duration =
            nextType === 'work'
              ? settings.workMinutes * 60
              : nextType === 'short_break'
                ? settings.breakMinutes * 60
                : settings.longBreakMinutes * 60;

          const readySession: ActivePomodoroSession = {
            id: `session-${Date.now()}`,
            taskId: session.taskId,
            type: nextType,
            durationSeconds: duration,
            elapsedSeconds: 0,
            isPaused: true,
          };
          set({ activeSession: readySession });
          syncToMain(readySession);
        }
      } else {
        const updated = { ...session, elapsedSeconds: nextElapsed };
        set({ activeSession: updated });
        syncToMain(updated);
      }
    },

    linkTask: (taskId: string | null) => {
      const session = get().activeSession;
      if (session) {
        const updated = { ...session, taskId };
        set({ activeSession: updated });
        syncToMain(updated);
      }
    },

    updateSettings: (newSettings: Partial<PomodoroSettings>) => {
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
    },

    toggleFocusMode: (enabled?: boolean) => {
      set((state) => ({
        isFocusMode: enabled !== undefined ? enabled : !state.isFocusMode,
      }));
    },

    toggleMiniWindow: async () => {
      const isOpen = get().isMiniWindowOpen;
      if (isOpen) {
        await invoke(IPC.POMODORO.HIDE_MINI_WINDOW);
        set({ isMiniWindowOpen: false });
      } else {
        await invoke(IPC.POMODORO.SHOW_MINI_WINDOW);
        set({ isMiniWindowOpen: true });
      }
    },
  };
});

export default usePomodoroStore;
