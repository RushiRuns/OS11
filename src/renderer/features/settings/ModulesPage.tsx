import React from 'react';
import { Button } from '../../components/Button/Button.js';
import { useModuleStore, type ProfilePreset } from '../../stores/moduleStore.js';
import styles from './SettingsView.module.css';

interface ModuleDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  phase2?: boolean;
}

const MODULES: ModuleDef[] = [
  { id: 'my_day', name: 'My Day', desc: 'Daily intentional task focus list with automatic midnight rollover', icon: '☀️' },
  { id: 'project_management', name: 'Projects & Work breakdown', desc: 'Multi-list grouping, sections, milestones, and task dependencies', icon: '📁' },
  { id: 'pomodoro', name: 'Pomodoro Focus Timer', desc: 'Time-boxed focus sessions, intervals, floating mini-window, and audio alerts', icon: '⏱️' },
  { id: 'agenda', name: 'Chronological Agenda', desc: 'Daily and weekly schedule view with external calendar integration and load balancing', icon: '📆' },
  { id: 'goals_habits', name: 'Goals & Habit Chains', desc: 'Milestones, outcomes, recurring habits, and streak counters', icon: '🎯' },
  { id: 'dashboard', name: 'Productivity Dashboard', desc: 'Personal productivity stats, burndown velocity, on-time rate, and PDF/CSV export', icon: '📊' },
  { id: 'file_attachments', name: 'File Attachments', desc: 'Local file picker, drag & drop, clipboard paste, cloud links, and image lightbox', icon: '📎' },
  { id: 'nlp_parsing', name: 'Natural Language Parsing', desc: 'Extract dates, priorities, lists, and tags from freeform typed text', icon: '✨' },
  { id: 'sound_effects', name: 'Synthesized Sound Effects', desc: 'Harmonic audio cues on task completion, task creation, and timer intervals', icon: '🔔' },
  { id: 'calendar_integration', name: 'Calendar Integration', desc: 'Sync external Google, Apple, and Outlook calendars via local loopback OAuth2', icon: '🌐' },
  { id: 'habit_tracker', name: 'Habit Heatmap Grid', desc: '52-week × 7-day contribution style habit consistency heatmap', icon: '🔥' },
  { id: 'vim_keybindings', name: 'Vim Navigation Keys', desc: 'j/k line traversal, x complete, / quick search, and visual modal controls', icon: '⌨️' },
  // Phase 2 Modules
  { id: 'collaboration', name: 'Real-Time Collaboration', desc: 'Peer-to-peer shared project lists and live task updates', icon: '👥', phase2: true },
  { id: 'companion_sync', name: 'Mobile Companion Sync', desc: 'Encrypted peer pairing with iOS & Android companion applications', icon: '📱', phase2: true },
];

export function ModulesPage(): React.ReactElement {
  const { isEnabled, toggleModule, activePreset, applyPreset } = useModuleStore();

  const handlePresetSelect = async (preset: ProfilePreset) => {
    await applyPreset(preset);
  };

  const handleToggle = async (id: string, current: boolean) => {
    await toggleModule(id, !current);
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Modular Feature System</h2>
        <p className={styles.sectionDesc}>
          Enable only what you need. Disabled modules disappear immediately from the sidebar and memory.
        </p>
      </div>

      {/* Profile Presets */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Profile Presets (1-Click Workflow Setup)</div>

        <div className={styles.presetGrid}>
          <button
            type="button"
            className={`${styles.presetCard} ${activePreset === 'minimalist' ? styles.presetCardActive : ''}`}
            onClick={() => handlePresetSelect('minimalist')}
          >
            <div className={styles.presetTitle}>Minimalist</div>
            <div className={styles.presetDesc}>Only My Day active. Zero distractions or clutter.</div>
          </button>

          <button
            type="button"
            className={`${styles.presetCard} ${activePreset === 'gtd' ? styles.presetCardActive : ''}`}
            onClick={() => handlePresetSelect('gtd')}
          >
            <div className={styles.presetTitle}>GTD Mode</div>
            <div className={styles.presetDesc}>Projects, Agenda, Goals, and My Day for structured planning.</div>
          </button>

          <button
            type="button"
            className={`${styles.presetCard} ${activePreset === 'focus' ? styles.presetCardActive : ''}`}
            onClick={() => handlePresetSelect('focus')}
          >
            <div className={styles.presetTitle}>Focus Mode</div>
            <div className={styles.presetDesc}>Pomodoro timer, Agenda, and My Day for deep work.</div>
          </button>

          <button
            type="button"
            className={`${styles.presetCard} ${activePreset === 'custom' ? styles.presetCardActive : ''}`}
            onClick={() => handlePresetSelect('custom')}
          >
            <div className={styles.presetTitle}>Custom</div>
            <div className={styles.presetDesc}>Manual control over each feature module.</div>
          </button>
        </div>
      </div>

      {/* Module Toggles */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Core Productivity Modules</div>

        <div className={styles.moduleList}>
          {MODULES.filter((m) => !m.phase2).map((m) => {
            const enabled = isEnabled(m.id);
            return (
              <div key={m.id} className={styles.moduleCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: '20px' }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {m.desc}
                    </div>
                  </div>
                </div>

                <Button
                  variant={enabled ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handleToggle(m.id, enabled)}
                >
                  {enabled ? 'Active ✓' : 'Disabled'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 2 Modules */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Phase 2 Modules</div>

        <div className={styles.moduleList}>
          {MODULES.filter((m) => m.phase2).map((m) => (
            <div key={m.id} className={styles.moduleCard} style={{ opacity: 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: '20px' }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {m.desc}
                  </div>
                </div>
              </div>

              <span className={styles.badgeComingSoon}>
                Coming in Phase 2 — Companion & Collaboration
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ModulesPage;
