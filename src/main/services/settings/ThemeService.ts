import { BrowserWindow, nativeTheme } from 'electron';
import { SettingsRepository } from '../../repositories/SettingsRepository.js';
import { IPC } from '@shared/ipc-channels.js';
import type { SettingsMap } from '@shared/types/index.js';

function broadcastToWindows(channel: string, ...args: unknown[]): void {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    }
  } catch {
    // Tests or headless environments
  }
}

export class ThemeService {
  private repository: SettingsRepository;
  private isAutoListenerRegistered = false;

  constructor(repository?: SettingsRepository) {
    this.repository = repository ?? new SettingsRepository();
    this.initNativeThemeListener();
  }

  private initNativeThemeListener(): void {
    if (this.isAutoListenerRegistered) return;
    try {
      if (typeof nativeTheme !== 'undefined' && typeof nativeTheme.on === 'function') {
        nativeTheme.on('updated', () => {
          const currentTheme = this.repository.get<SettingsMap['theme']>('theme', 'auto');
          if (currentTheme === 'auto' || currentTheme === 'system') {
            const effectiveTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
            broadcastToWindows(IPC.APP.SET_THEME, {
              theme: currentTheme,
              effectiveTheme,
            });
            broadcastToWindows(IPC.SETTINGS.THEME_CHANGED, effectiveTheme);
          }
        });
        this.isAutoListenerRegistered = true;
      }
    } catch {
      // In test/mock environments
    }
  }

  public getEffectiveTheme(theme: SettingsMap['theme']): 'dark' | 'light' {
    if (theme === 'auto' || theme === 'system') {
      try {
        if (typeof nativeTheme !== 'undefined' && typeof nativeTheme.shouldUseDarkColors === 'boolean') {
          return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
        }
      } catch {
        // Fallback
      }
      return 'dark';
    }
    return theme === 'light' ? 'light' : 'dark';
  }

  public applyTheme(theme: SettingsMap['theme']): { theme: SettingsMap['theme']; effectiveTheme: 'dark' | 'light' } {
    this.repository.set('theme', theme);
    const effectiveTheme = this.getEffectiveTheme(theme);

    try {
      if (typeof nativeTheme !== 'undefined') {
        if (theme === 'auto' || theme === 'system') {
          nativeTheme.themeSource = 'system';
        } else {
          nativeTheme.themeSource = theme;
        }
      }
    } catch {
      // Test/mock environments
    }

    broadcastToWindows(IPC.APP.SET_THEME, { theme, effectiveTheme });
    broadcastToWindows(IPC.SETTINGS.THEME_CHANGED, effectiveTheme);

    return { theme, effectiveTheme };
  }

  public applyAccentColor(hex: string): string {
    this.repository.set('accent_color', hex);
    broadcastToWindows(IPC.APP.SET_ACCENT_COLOR, { hex });
    broadcastToWindows(IPC.SETTINGS.ACCENT_COLOR_CHANGED, hex);
    return hex;
  }
}

export default ThemeService;
