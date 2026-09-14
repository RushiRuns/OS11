import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useModuleStore, type ProfilePreset } from '../../stores/moduleStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { Button } from '../../components/Button/Button.js';
import styles from './OnboardingFlow.module.css';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const PRESET_OPTIONS: {
  id: ProfilePreset;
  name: string;
  icon: string;
  description: string;
}[] = [
  {
    id: 'minimalist',
    name: 'Minimalist',
    icon: '⚪',
    description: 'Clean, distraction-free task management. Only core lists and essential features enabled.',
  },
  {
    id: 'gtd',
    name: 'GTD (Getting Things Done)',
    icon: '⚡',
    description: 'Comprehensive workflow with Projects, Context Tags, Subtasks, and Structured Deadlines.',
  },
  {
    id: 'focus',
    name: 'Deep Focus',
    icon: '🎯',
    description: 'Productivity powerhouse with Pomodoro timer, Daily Agenda, Habit tracker, and Goals.',
  },
  {
    id: 'custom',
    name: 'Custom / All Modules',
    icon: '🧩',
    description: 'Unlock every capability including Data Portability, Advanced NLP, and Backgrounds.',
  },
];

const EMOJI_OPTIONS = ['🧑‍💻', '⚡', '🚀', '🎯', '🦉', '🌿', '☕', '🎨', '🌟', '💡'];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<number>(1);

  // Step 1 State
  const activePreset = useModuleStore((s) => s.activePreset);
  const applyPreset = useModuleStore((s) => s.applyPreset);
  const [selectedPreset, setSelectedPreset] = useState<ProfilePreset>(activePreset || 'gtd');

  // Step 2 State
  const [displayName, setDisplayName] = useState('Productive User');
  const [selectedEmoji, setSelectedEmoji] = useState('⚡');

  // Step 3 State
  const [demoInput, setDemoInput] = useState('');
  const [demoTaskCreated, setDemoTaskCreated] = useState(false);

  const handleFinish = async () => {
    try {
      await invoke(IPC.SETTINGS.SET, { key: 'onboarding_completed', value: true });
    } catch {
      // Best-effort persistence
    }
    onComplete();
  };

  const handleNext = async () => {
    if (step === 1) {
      await applyPreset(selectedPreset);
      setStep(2);
    } else if (step === 2) {
      try {
        await invoke(IPC.IDENTITY.UPDATE, {
          displayName: displayName.trim() || 'Local User',
          avatarEmoji: selectedEmoji,
        });
      } catch {
        // Continue smoothly
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      await handleFinish();
    }
  };

  const handleCreateDemoTask = async () => {
    const text = demoInput.trim() || 'Call Mom tomorrow at 2pm !high #family';
    try {
      await useTaskStore.getState().createTask({
        title: text,
      });
      setDemoTaskCreated(true);
    } catch {
      setDemoTaskCreated(true);
    }
  };

  const slideVariants = {
    initial: shouldReduceMotion ? { opacity: 0 } : { x: 40, opacity: 0 },
    animate: shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 },
    exit: shouldReduceMotion ? { opacity: 0 } : { x: -40, opacity: 0 },
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Welcome to OS11">
      <div className={styles.wizardCard}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <span>🌌</span>
            <span>OS11 Setup</span>
          </div>

          <div className={styles.stepIndicators} aria-label={`Step ${step} of 4`}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`${styles.stepDot} ${
                  i === step ? styles.stepDotActive : i < step ? styles.stepDotDone : ''
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            className={styles.skipBtn}
            onClick={handleFinish}
            aria-label="Skip onboarding"
          >
            Skip Setup ✕
          </button>
        </header>

        {/* Dynamic Slide Content */}
        <div className={styles.slideContainer}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <h1 className={styles.stepTitle}>Choose your workflow style</h1>
                <p className={styles.stepDescription}>
                  OS11 adapts to your mindset. Select a preset now — you can customize modules in
                  Settings at any time.
                </p>

                <div className={styles.presetGrid} role="radiogroup" aria-label="Profile presets">
                  {PRESET_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      role="radio"
                      aria-checked={selectedPreset === opt.id}
                      tabIndex={0}
                      className={`${styles.presetCard} ${
                        selectedPreset === opt.id ? styles.presetCardSelected : ''
                      }`}
                      onClick={() => setSelectedPreset(opt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedPreset(opt.id);
                        }
                      }}
                    >
                      <div className={styles.presetHeader}>
                        <span className={styles.presetIcon}>{opt.icon}</span>
                        <span className={styles.presetName}>{opt.name}</span>
                      </div>
                      <p className={styles.presetText}>{opt.description}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <h1 className={styles.stepTitle}>Your Local Identity</h1>
                <p className={styles.stepDescription}>
                  All identity information stays entirely offline on your local machine.
                </p>

                <div className={styles.identityForm}>
                  <div className={styles.previewBadge}>
                    <div className={styles.avatarPreview}>{selectedEmoji}</div>
                    <div className={styles.previewText}>
                      <span className={styles.previewGreeting}>
                        {displayName ? `Hello, ${displayName}!` : 'Hello!'}
                      </span>
                      <span className={styles.previewSub}>Local Profile</span>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="displayNameInput" className={styles.fieldLabel}>Display Name</label>
                    <input
                      id="displayNameInput"
                      type="text"
                      className={styles.input}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Avatar Emoji</span>
                    <div className={styles.emojiPickerRow} role="group" aria-label="Avatar Emoji Options">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`${styles.emojiBtn} ${
                            selectedEmoji === emoji ? styles.emojiBtnActive : ''
                          }`}
                          onClick={() => setSelectedEmoji(emoji)}
                          aria-label={`Select ${emoji} avatar`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <h1 className={styles.stepTitle}>Interactive Quick-Add</h1>
                <p className={styles.stepDescription}>
                  OS11 includes lightning-fast natural language parsing. Try typing dates, priorities,
                  and tags directly into the box!
                </p>

                <div className={styles.quickAddDemo}>
                  <div className={styles.promptCard}>
                    💡 Guided Prompt: Try clicking to auto-fill:
                    <br />
                    <span
                      className={styles.samplePrompt}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDemoInput('Ship quarterly report Friday at 5pm !critical #work')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setDemoInput('Ship quarterly report Friday at 5pm !critical #work');
                        }
                      }}
                    >
                      "Ship quarterly report Friday at 5pm !critical #work"
                    </span>
                  </div>

                  <div className={styles.demoInputWrap}>
                    <input
                      type="text"
                      className={styles.input}
                      value={demoInput}
                      onChange={(e) => setDemoInput(e.target.value)}
                      placeholder="Type a task with natural language details..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && demoInput.trim()) {
                          handleCreateDemoTask();
                        }
                      }}
                      aria-label="Demo task input"
                    />
                    <Button
                      variant="primary"
                      onClick={handleCreateDemoTask}
                      disabled={demoTaskCreated || !demoInput.trim()}
                    >
                      {demoTaskCreated ? 'Added! ✓' : 'Add Task'}
                    </Button>
                  </div>

                  {demoTaskCreated && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={styles.successAlert}
                    >
                      <span>🎉</span>
                      <span>Task created with instant parsing! You're ready to roll.</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18 }}
              >
                <h1 className={styles.stepTitle}>Here's your keyboard</h1>
                <p className={styles.stepDescription}>
                  OS11 is engineered to be 100% keyboard native. Everything you need is under your
                  fingertips.
                </p>

                <div className={styles.shortcutGrid} role="list" aria-label="Core keyboard shortcuts">
                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Quick Add Task</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>Ctrl</kbd>
                      <kbd className={styles.keycap}>N</kbd>
                    </div>
                  </div>

                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Command Palette</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>Ctrl</kbd>
                      <kbd className={styles.keycap}>K</kbd>
                    </div>
                  </div>

                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Deep Focus Mode</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>Ctrl</kbd>
                      <kbd className={styles.keycap}>Shift</kbd>
                      <kbd className={styles.keycap}>F</kbd>
                    </div>
                  </div>

                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Toggle Complete</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>Space</kbd>
                    </div>
                  </div>

                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Edit Selected Task</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>E</kbd>
                    </div>
                  </div>

                  <div className={styles.shortcutItem} role="listitem">
                    <span className={styles.shortcutLabel}>Set Priority (Low/Med/High)</span>
                    <div className={styles.keycaps}>
                      <kbd className={styles.keycap}>1</kbd>
                      <kbd className={styles.keycap}>2</kbd>
                      <kbd className={styles.keycap}>3</kbd>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Controls */}
        <footer className={styles.footer}>
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
          ) : (
            <div />
          )}

          <Button variant="primary" size="md" onClick={handleNext}>
            {step === 4 ? 'Get Started 🚀' : 'Continue →'}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export default OnboardingFlow;
