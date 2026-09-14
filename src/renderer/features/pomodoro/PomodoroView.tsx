import React, { useState, useEffect, useMemo } from 'react';
import { DndContext, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { usePomodoroStore } from '../../stores/pomodoroStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { playPomodoroSound } from '../../utils/audio.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '../../../shared/ipc-channels.js';
import type { PomodoroStats, PomodoroSound } from '../../../shared/types/index.js';
import styles from './PomodoroView.module.css';

interface TimerCardInnerProps {
  linkedTaskId: string | null;
  onLinkTask: (taskId: string | null) => void;
  onDragEndTask: (taskId: string) => void;
}

function TimerCardInner({
  linkedTaskId,
  onLinkTask,
  onDragEndTask,
}: TimerCardInnerProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: 'pomodoro-card-drop',
  });

  const {
    activeSession,
    sessionCount,
    settings,
    startSession,
    pauseSession,
    resumeSession,
    skipSession,
    resetTimer,
  } = usePomodoroStore();

  const tasksById = useTaskStore((state) => state.tasksById);
  const linkedTask = linkedTaskId ? tasksById[linkedTaskId] : null;

  // Compute remaining time & progress
  const duration = activeSession
    ? activeSession.durationSeconds
    : settings.workMinutes * 60;
  const elapsed = activeSession ? activeSession.elapsedSeconds : 0;
  const remaining = Math.max(0, duration - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progress = duration > 0 ? (duration - elapsed) / duration : 0;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const sessionType = activeSession?.type ?? 'work';
  const isPaused = activeSession?.isPaused ?? false;
  const isRunning = activeSession !== null && !isPaused;

  const strokeColor =
    sessionType === 'work'
      ? '#ef4444'
      : sessionType === 'short_break'
        ? '#10b981'
        : '#3b82f6';

  const badgeClass =
    sessionType === 'work'
      ? styles.badgeWork
      : sessionType === 'short_break'
        ? styles.badgeBreak
        : styles.badgeLongBreak;

  const badgeLabel =
    sessionType === 'work'
      ? 'Focus Session'
      : sessionType === 'short_break'
        ? 'Short Break'
        : 'Long Break';

  // Handle native HTML5 drag and drop as well
  const handleNativeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && tasksById[taskId]) {
      onDragEndTask(taskId);
    }
  };

  const handleNativeDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
  };

  const incompleteTasks = useMemo(() => {
    return Object.values(tasksById).filter((t) => !t.completed_at);
  }, [tasksById]);

  return (
    <div
      ref={setNodeRef}
      className={`${styles.timerCard} ${isOver ? styles.timerCardDroppable : ''}`}
      onDrop={handleNativeDrop}
      onDragOver={handleNativeDragOver}
    >
      {/* Session type badge */}
      <div className={`${styles.sessionTypeBadge} ${badgeClass}`}>
        <span>{sessionType === 'work' ? '🍅' : '☕'}</span>
        <span>{badgeLabel}</span>
      </div>

      {/* Circular Progress Ring */}
      <div className={styles.ringContainer}>
        <svg className={styles.svgRing} viewBox="0 0 240 240">
          <circle
            className={styles.circleBackground}
            cx="120"
            cy="120"
            r={radius}
          />
          <circle
            className={styles.circleProgress}
            cx="120"
            cy="120"
            r={radius}
            stroke={strokeColor}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        <div className={styles.timeDisplay}>
          <span className={styles.timeText}>{timeFormatted}</span>
          {/* Cycle dots: filled for completed sessions in current cycle */}
          <div className={styles.cycleDots} title={`Session ${sessionCount} of ${settings.sessionsBeforeLongBreak} in cycle`}>
            {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i < sessionCount ? styles.dotFilled : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Linked Task Box or Picker */}
      {linkedTask ? (
        <div className={styles.linkedTaskBox}>
          <div className={styles.taskInfo}>
            <span>🎯</span>
            <span className={styles.taskTitle}>{linkedTask.title}</span>
            {linkedTask.pomodoro_count > 0 && (
              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                🍅 ×{linkedTask.pomodoro_count}
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.unlinkBtn}
            onClick={() => onLinkTask(null)}
            title="Unlink task"
          >
            ✕ Unlink
          </button>
        </div>
      ) : (
        <div className={styles.linkedTaskBox}>
          <div className={styles.taskInfo} style={{ width: '100%' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>🎯 Link Task:</span>
            <select
              className={styles.settingsInput}
              style={{ flex: 1, textOverflow: 'ellipsis' }}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onLinkTask(e.target.value);
                }
              }}
            >
              <option value="">Select task or drop here...</option>
              {incompleteTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Primary Timer Controls */}
      <div className={styles.controls}>
        {!activeSession ? (
          <button
            type="button"
            className={`${styles.mainBtn} ${styles.btnStart}`}
            onClick={() => startSession(linkedTaskId, 'work')}
          >
            ▶ Start Focus
          </button>
        ) : isRunning ? (
          <>
            <button
              type="button"
              className={`${styles.mainBtn} ${styles.btnPause}`}
              onClick={pauseSession}
            >
              ⏸ Pause
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={skipSession}
              title="Skip interval"
            >
              ⏭ Skip
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={resetTimer}
              title="Stop & Reset"
            >
              ⏹ Reset
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.mainBtn} ${styles.btnResume}`}
              onClick={resumeSession}
            >
              ▶ Resume
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={skipSession}
              title="Skip interval"
            >
              ⏭ Skip
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={resetTimer}
              title="Stop & Reset"
            >
              ⏹ Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PomodoroView(): React.ReactElement {
  const {
    activeSession,
    settings,
    isFocusMode,
    isMiniWindowOpen,
    linkTask,
    updateSettings,
    toggleFocusMode,
    toggleMiniWindow,
  } = usePomodoroStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState<PomodoroStats>({
    totalSessions: 0,
    totalMinutes: 0,
    sessionsByDay: {},
    completed_count: 0,
    total_seconds: 0,
  });

  const loadStats = async () => {
    try {
      const data = await invoke<PomodoroStats>(IPC.POMODORO.GET_TODAY_STATS);
      if (data) {
        setStats(data);
      }
    } catch {
      // Best effort fallback
    }
  };

  useEffect(() => {
    loadStats();
  }, [activeSession?.id]);

  const handleDndDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && over.id === 'pomodoro-card-drop') {
      const taskId = String(active.id);
      linkTask(taskId);
    }
  };

  const handleLinkTask = (taskId: string | null) => {
    linkTask(taskId);
  };

  return (
    <DndContext onDragEnd={handleDndDragEnd}>
      <div className={styles.container}>
        {/* Top Header & Quick Actions */}
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>Pomodoro Focus Timer</h1>
            <p className={styles.subtitle}>
              Interval deep work blocks, cycle tracking, and distraction-free execution
            </p>
          </div>

          <div className={styles.topActions}>
            <button
              type="button"
              className={`${styles.iconBtn} ${isFocusMode ? styles.iconBtnActive : ''}`}
              onClick={() => toggleFocusMode()}
              title="Full-screen Focus Mode (Ctrl+Shift+F)"
            >
              🎯 {isFocusMode ? 'Exit Focus' : 'Focus Mode'}
            </button>

            <button
              type="button"
              className={`${styles.iconBtn} ${isMiniWindowOpen ? styles.iconBtnActive : ''}`}
              onClick={() => toggleMiniWindow()}
              title="Toggle floating mini timer window"
            >
              🗖 Mini Window
            </button>

            <button
              type="button"
              className={`${styles.iconBtn} ${isSettingsOpen ? styles.iconBtnActive : ''}`}
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Configure Pomodoro durations & alert sounds"
            >
              ⚙️ Settings
            </button>
          </div>
        </header>

        {/* Center Timer Card */}
        <TimerCardInner
          linkedTaskId={activeSession?.taskId ?? null}
          onLinkTask={handleLinkTask}
          onDragEndTask={handleLinkTask}
        />

        {/* Settings Drawer */}
        {isSettingsOpen && (
          <div className={styles.settingsDrawer}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Focus Duration</span>
              <select
                className={styles.settingsInput}
                value={settings.workMinutes}
                onChange={(e) => updateSettings({ workMinutes: Number(e.target.value) })}
              >
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={25}>25 minutes (Default)</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={50}>50 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Short Break</span>
              <select
                className={styles.settingsInput}
                value={settings.breakMinutes}
                onChange={(e) => updateSettings({ breakMinutes: Number(e.target.value) })}
              >
                <option value={3}>3 minutes</option>
                <option value={5}>5 minutes (Default)</option>
                <option value={10}>10 minutes</option>
              </select>
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Long Break</span>
              <select
                className={styles.settingsInput}
                value={settings.longBreakMinutes}
                onChange={(e) => updateSettings({ longBreakMinutes: Number(e.target.value) })}
              >
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Default)</option>
                <option value={20}>20 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Cycle Length</span>
              <select
                className={styles.settingsInput}
                value={settings.sessionsBeforeLongBreak}
                onChange={(e) =>
                  updateSettings({ sessionsBeforeLongBreak: Number(e.target.value) })
                }
              >
                <option value={2}>2 sessions</option>
                <option value={3}>3 sessions</option>
                <option value={4}>4 sessions (Default)</option>
                <option value={5}>5 sessions</option>
              </select>
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Sound Alert</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  className={styles.settingsInput}
                  value={settings.soundAlert}
                  onChange={(e) =>
                    updateSettings({ soundAlert: e.target.value as PomodoroSound })
                  }
                >
                  <option value="chime">Chime (Warm synth)</option>
                  <option value="bell">Bell (Tibetan bell)</option>
                  <option value="digital">Digital (Modern beep)</option>
                  <option value="calm">Calm (Zen tone)</option>
                  <option value="none">Mute (No sound)</option>
                </select>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => playPomodoroSound(settings.soundAlert)}
                  title="Test alert tone"
                >
                  ▶ Test
                </button>
              </div>
            </div>

            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Auto-start Breaks & Intervals</span>
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(e) => updateSettings({ autoStart: e.target.checked })}
              />
            </div>
          </div>
        )}

        {/* Today's Stats Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.completed_count ?? stats.totalSessions} 🍅
            </span>
            <span className={styles.statLabel}>Completed Intervals Today</span>
          </div>

          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {stats.totalMinutes ?? Math.round((stats.total_seconds ?? 0) / 60)} min
            </span>
            <span className={styles.statLabel}>Total Focus Time Today</span>
          </div>
        </div>
      </div>
    </DndContext>
  );
}

export default PomodoroView;
