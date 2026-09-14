import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from '../../stores/taskStore.js';
import { usePomodoroStore } from '../../stores/pomodoroStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { Button } from '../../components/Button/Button.js';
import type { Task } from '@shared/types/task.js';
import styles from './FocusModeView.module.css';

interface FocusModeViewProps {
  task: Task | null;
  onClose: () => void;
  onSelectTask?: (task: Task) => void;
}

type AmbientTrack = 'off' | 'rain' | 'whitenoise' | 'lofi';

const TRACK_PATHS: Record<Exclude<AmbientTrack, 'off'>, string> = {
  rain: './audio/rain.wav',
  whitenoise: './audio/whitenoise.wav',
  lofi: './audio/lofi.wav',
};

export function FocusModeView({
  task,
  onClose,
  onSelectTask,
}: FocusModeViewProps): React.ReactElement {
  const { tasksById, updateTask } = useTaskStore();
  const activeSession = usePomodoroStore((s) => s.activeSession);

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [selectedTrack, setSelectedTrack] = useState<AmbientTrack>('rain');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync state if task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? '');
    }
  }, [task]);

  // Audio playback management
  useEffect(() => {
    if (!audioRef.current) return;

    if (selectedTrack === 'off' || !isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.src = TRACK_PATHS[selectedTrack];
      audioRef.current.volume = volume;
      audioRef.current.play().catch(() => {
        // Autoplay may be restricted until user interaction
      });
    }
  }, [selectedTrack, isPlaying, volume]);

  // Handle keyboard shortcuts (Escape or Ctrl+Shift+F to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Save changes on blur
  const handleSaveTitle = () => {
    if (task && title.trim() && title !== task.title) {
      updateTask({ id: task.id, title: title.trim() });
    }
  };

  const handleSaveNotes = () => {
    if (task && notes !== (task.notes ?? '')) {
      updateTask({ id: task.id, notes });
    }
  };

  const handleToggleComplete = () => {
    if (!task) return;
    const nextStatus = task.is_completed === 1 ? 0 : 1;
    updateTask({ id: task.id, is_completed: nextStatus });
  };

  // Fallback candidate tasks if no task is currently focused
  const candidateTasks = useMemo(() => {
    return Object.values(tasksById)
      .filter((t) => t.is_trashed === 0 && t.is_completed === 0)
      .slice(0, 5);
  }, [tasksById]);

  return (
    <div className={styles.focusContainer} role="region" aria-label="Focus Mode">
      {/* Audio element for ambient background noise */}
      <audio ref={audioRef} loop />

      {/* Minimal Top Toolbar */}
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.focusBadge}>
            <span>🎯</span>
            <span>Focus Mode</span>
          </span>

          {activeSession && (
            <span className={styles.focusBadge} style={{ color: 'var(--color-danger)' }}>
              🍅 {Math.floor(Math.max(0, activeSession.durationSeconds - activeSession.elapsedSeconds) / 60)}:
              {String(Math.max(0, activeSession.durationSeconds - activeSession.elapsedSeconds) % 60).padStart(2, '0')}
            </span>
          )}
        </div>

        <div className={styles.toolbarRight}>
          {/* Ambient Sound Player */}
          <div className={styles.soundPlayer} role="group" aria-label="Ambient Sound Player">
            <span aria-hidden="true">🎧</span>
            <select
              className={styles.soundSelect}
              value={selectedTrack}
              onChange={(e) => {
                const track = e.target.value as AmbientTrack;
                setSelectedTrack(track);
                if (track !== 'off') setIsPlaying(true);
              }}
              aria-label="Select ambient sound"
            >
              <option value="off">Sound: Off</option>
              <option value="rain">Rainfall</option>
              <option value="whitenoise">White Noise</option>
              <option value="lofi">Lo-Fi Beats</option>
            </select>

            {selectedTrack !== 'off' && (
              <>
                <button
                  type="button"
                  className={styles.soundBtn}
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label={isPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={styles.volumeSlider}
                  aria-label="Ambient volume"
                />
              </>
            )}
          </div>

          {/* Exit Focus Mode Button */}
          <button
            type="button"
            className={styles.exitBtn}
            onClick={onClose}
            aria-label="Exit focus mode"
          >
            <span>Exit Focus</span>
            <span className={styles.keycap}>Esc</span>
          </button>
        </div>
      </header>

      {/* Main Focus Content */}
      <main className={styles.contentArea}>
        <AnimatePresence mode="wait">
          {task ? (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className={styles.taskCardFocused}
            >
              <div className={styles.taskHeaderRow}>
                <Checkbox
                  checked={task.is_completed === 1}
                  onChange={handleToggleComplete}
                  ariaLabel={`Mark "${task.title}" as complete`}
                />
                <input
                  type="text"
                  className={styles.titleInput}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  placeholder="Task title..."
                  aria-label="Focused task title"
                />
              </div>

              <div className={styles.notesArea}>
                <span className={styles.notesLabel}>Notes & Details</span>
                <textarea
                  className={styles.notesTextarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleSaveNotes}
                  placeholder="Capture thoughts, notes, and checklist items here..."
                  aria-label="Task notes"
                />
              </div>

              <div className={styles.taskMetaRow}>
                <span>
                  {task.due_date ? `📅 Due: ${task.due_date}` : 'No due date set'}
                </span>
                <span>
                  {task.priority > 0
                    ? `Priority: ${['None', 'Low', 'Medium', 'High', 'Critical'][task.priority]}`
                    : 'Priority: Normal'}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className={styles.emptyCard}
            >
              <div className={styles.emptyTitle}>Deep Focus Mode</div>
              <p className={styles.emptyDesc}>
                Select a task to immerse yourself in without distractions, notifications, or sidebars.
              </p>

              {candidateTasks.length > 0 && (
                <div className={styles.taskPickerList} role="list" aria-label="Available tasks to focus">
                  {candidateTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.taskPickerItem}
                      onClick={() => onSelectTask?.(t)}
                      role="listitem"
                      aria-label={`Focus on task: ${t.title}`}
                    >
                      <span>{t.title}</span>
                      <span className={styles.focusBadge}>Focus ➔</span>
                    </button>
                  ))}
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={onClose} style={{ marginTop: 'var(--space-4)' }}>
                Return to All Tasks
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default FocusModeView;
