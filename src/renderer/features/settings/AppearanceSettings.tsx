import React, { useState, useEffect } from 'react';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import {
  ACCENT_PRESETS,
  applyAccentColor,
  applyTheme,
  applyDensity,
  applyFontSize,
  applyFontFamily,
} from '../../utils/theme.js';
import styles from './SettingsView.module.css';

export function AppearanceSettings(): React.ReactElement {
  const [theme, setThemeState] = useState<'auto' | 'light' | 'dark' | 'system'>('auto');
  const [accentColor, setAccentColorState] = useState('#1B88FF');
  const [customHex, setCustomHex] = useState('#1B88FF');
  const [fontFamily, setFontFamilyState] = useState('Inter');
  const [fontSize, setFontSizeState] = useState('md');
  const [density, setDensityState] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [sidebarPosition, setSidebarPositionState] = useState<'left' | 'right' | 'hidden'>('left');
  const [taskCardStyle, setTaskCardStyleState] = useState<'default' | 'minimal' | 'detailed'>('default');

  useEffect(() => {
    async function load() {
      try {
        const res = await invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
        if (res) {
          if (res.theme) setThemeState(res.theme as 'auto');
          if (res.accent_color) {
            setAccentColorState(String(res.accent_color));
            setCustomHex(String(res.accent_color));
          }
          if (res.font_family) setFontFamilyState(String(res.font_family));
          if (res.font_size) setFontSizeState(String(res.font_size));
          if (res.density) setDensityState(res.density as 'comfortable');
          if (res.sidebar_position) setSidebarPositionState(res.sidebar_position as 'left');
          if (res.task_card_style) setTaskCardStyleState(res.task_card_style as 'default');
        }
      } catch {
        // Defaults
      }
    }
    load();
  }, []);

  const handleThemeChange = async (nextTheme: 'auto' | 'light' | 'dark') => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    await invoke(IPC.SETTINGS.SET, { key: 'theme', value: nextTheme });
  };

  const handleAccentChange = async (hex: string) => {
    setAccentColorState(hex);
    setCustomHex(hex);
    applyAccentColor(hex);
    await invoke(IPC.SETTINGS.SET, { key: 'accent_color', value: hex });
  };

  const handleDensityChange = async (nextDensity: 'compact' | 'comfortable' | 'spacious') => {
    setDensityState(nextDensity);
    applyDensity(nextDensity);
    await invoke(IPC.SETTINGS.SET, { key: 'density', value: nextDensity });
  };

  const handleFontSizeChange = async (size: string) => {
    setFontSizeState(size);
    applyFontSize(size);
    await invoke(IPC.SETTINGS.SET, { key: 'font_size', value: size });
  };

  const handleFontFamilyChange = async (family: string) => {
    setFontFamilyState(family);
    applyFontFamily(family);
    await invoke(IPC.SETTINGS.SET, { key: 'font_family', value: family });
  };

  const handleSidebarPositionChange = async (pos: 'left' | 'right' | 'hidden') => {
    setSidebarPositionState(pos);
    await invoke(IPC.SETTINGS.SET, { key: 'sidebar_position', value: pos });
  };

  const handleTaskCardStyleChange = async (style: 'default' | 'minimal' | 'detailed') => {
    setTaskCardStyleState(style);
    await invoke(IPC.SETTINGS.SET, { key: 'task_card_style', value: style });
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Appearance & Theming</h2>
        <p className={styles.sectionDesc}>Customize theme, accent palette, typography, and density</p>
      </div>

      {/* Theme Mode */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Appearance Theme</div>
        <div className={styles.themeGrid}>
          <button
            type="button"
            className={`${styles.themeCard} ${theme === 'light' ? styles.themeCardActive : ''}`}
            onClick={() => handleThemeChange('light')}
          >
            <span style={{ fontSize: '24px' }}>☀️</span>
            <span>Light Mode</span>
          </button>
          <button
            type="button"
            className={`${styles.themeCard} ${theme === 'dark' ? styles.themeCardActive : ''}`}
            onClick={() => handleThemeChange('dark')}
          >
            <span style={{ fontSize: '24px' }}>🌙</span>
            <span>Dark Mode</span>
          </button>
          <button
            type="button"
            className={`${styles.themeCard} ${theme === 'auto' || theme === 'system' ? styles.themeCardActive : ''}`}
            onClick={() => handleThemeChange('auto')}
          >
            <span style={{ fontSize: '24px' }}>💻</span>
            <span>Sync with OS</span>
          </button>
        </div>
      </div>

      {/* Accent Color Palette */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Interactive Accent Color</div>
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Accent Tint</div>
            <div className={styles.settingDescription}>Applied to buttons, selection highlights, and active indicators</div>
          </div>

          <div className={styles.accentGrid}>
            {ACCENT_PRESETS.map((preset) => {
              const isActive = accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.name}
                  type="button"
                  className={`${styles.accentCircle} ${isActive ? styles.accentCircleActive : ''}`}
                  style={{ backgroundColor: preset.hex }}
                  onClick={() => handleAccentChange(preset.hex)}
                  title={preset.name}
                >
                  {isActive ? '✓' : ''}
                </button>
              );
            })}

            <input
              type="color"
              value={customHex}
              onChange={(e) => handleAccentChange(e.target.value)}
              title="Custom Accent Color"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </div>
        </div>
      </div>

      {/* Typography & Density */}
      <div className={styles.settingGroup}>
        <div className={styles.groupTitle}>Typography & UI Density</div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Font Family</div>
            <div className={styles.settingDescription}>Typeface applied across all tasks and navigation panes</div>
          </div>
          <select
            className={styles.selectInput}
            value={fontFamily}
            onChange={(e) => handleFontFamilyChange(e.target.value)}
          >
            <option value="Inter">Inter (Default)</option>
            <option value="system-ui, -apple-system, sans-serif">System UI</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="JetBrains Mono, monospace">JetBrains Mono</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Font Size Scale</div>
            <div className={styles.settingDescription}>Adjust reading text size across views</div>
          </div>
          <select
            className={styles.selectInput}
            value={fontSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
          >
            <option value="sm">Small (13px)</option>
            <option value="md">Default (14px)</option>
            <option value="lg">Large (16px)</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Task Density</div>
            <div className={styles.settingDescription}>Vertical spacing and row height for task cards</div>
          </div>
          <select
            className={styles.selectInput}
            value={density}
            onChange={(e) => handleDensityChange(e.target.value as 'comfortable')}
          >
            <option value="compact">Compact (36px)</option>
            <option value="comfortable">Comfortable (44px)</option>
            <option value="spacious">Spacious (52px)</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Task Card Style</div>
            <div className={styles.settingDescription}>Visual treatment for items in list view</div>
          </div>
          <select
            className={styles.selectInput}
            value={taskCardStyle}
            onChange={(e) => handleTaskCardStyleChange(e.target.value as 'default')}
          >
            <option value="default">Standard (Card Border)</option>
            <option value="minimal">Minimal (Clean Flat)</option>
            <option value="detailed">Detailed (Expanded Meta)</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <div className={styles.settingLabel}>Sidebar Position</div>
            <div className={styles.settingDescription}>Navigation placement on the screen</div>
          </div>
          <select
            className={styles.selectInput}
            value={sidebarPosition}
            onChange={(e) => handleSidebarPositionChange(e.target.value as 'left')}
          >
            <option value="left">Left (Default)</option>
            <option value="right">Right</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default AppearanceSettings;
