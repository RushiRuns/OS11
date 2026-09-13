import { app, BrowserWindow } from 'electron';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { IPC } from '@shared/ipc-channels.js';
import type { SystemInfo, SettingsMap, SettingKey } from '@shared/types/index.js';

function broadcastToWindows(channel: string, ...args: unknown[]): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  } catch {
    // Window manager or webContents not ready / tests
  }
}

export class SettingsService {
  private repository: SettingsRepository;

  constructor(repository?: SettingsRepository) {
    this.repository = repository ?? new SettingsRepository();
  }

  public get<T>(key: string, defaultValue: T): T;
  public get<T = unknown>(key: string): T | null;
  public get<T>(key: string, defaultValue?: T): T | null {
    return this.repository.get(key, defaultValue as T);
  }

  public set<T>(key: string, value: T): void {
    this.repository.set(key, value);
  }

  public getAll(): Record<string, unknown> {
    return this.repository.getAll();
  }

  public applyTheme(theme: SettingsMap['theme']): void {
    this.set('theme', theme);
    broadcastToWindows(IPC.SETTINGS.THEME_CHANGED, theme);
  }

  public applyAccentColor(hex: string): void {
    this.set('accent_color', hex);
    broadcastToWindows(IPC.SETTINGS.ACCENT_COLOR_CHANGED, hex);
  }

  public applyLoginItem(enabled: boolean): void {
    this.set('launch_at_login', enabled);
    try {
      if (typeof app !== 'undefined' && app.setLoginItemSettings) {
        app.setLoginItemSettings({ openAtLogin: enabled });
      }
    } catch {
      // In tests or headless environments
    }
  }

  public reset(): Record<string, unknown> {
    // Reset to factory defaults
    const defaults: Partial<SettingsMap> = {
      theme: 'auto',
      accent_color: '#1B88FF',
      font_size: 'md',
      density: 'comfortable',
      sidebar_position: 'left',
      launch_at_login: true,
      pomodoro_work_minutes: 25,
      pomodoro_break_minutes: 5,
      pomodoro_long_break_minutes: 15,
      pomodoro_sessions_before_long_break: 4,
      reduce_motion: false,
    };

    for (const [key, value] of Object.entries(defaults)) {
      this.set(key as SettingKey, value);
    }
    return this.getAll();
  }

  public getSystemInfo(): SystemInfo {
    try {
      return {
        version: typeof app !== 'undefined' && app.getVersion ? app.getVersion() : '0.1.0',
        electron: process.versions.electron ?? 'unknown',
        chrome: process.versions.chrome ?? 'unknown',
        node: process.versions.node ?? 'unknown',
        platform: process.platform,
      };
    } catch {
      return {
        version: '0.1.0',
        electron: '34.3.0',
        chrome: '132.0.0',
        node: '20.18.0',
        platform: process.platform,
      };
    }
  }
}

export default SettingsService;
