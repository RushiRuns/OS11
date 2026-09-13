import { app, powerMonitor } from 'electron';
import { runStartupSequence, getReminderService } from './startup.js';
import { registerIpcHandlers } from './ipc/index.js';
import {
  createMainWindow,
  getMainWindow,
  showMainWindow,
  setAppIsQuitting,
  setAlwaysOnTop,
} from './window/main-window.js';
import { createSplashWindow, destroySplashWindow } from './window/splash-window.js';
import { createOmnibarWindow } from './window/omnibar-window.js';
import { initTray, updateTrayBadge } from './tray/tray.js';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts.js';
import { initAutoUpdater } from './services/updater.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { TaskRepository } from './repositories/TaskRepository.js';
import { IPC } from '@shared/ipc-channels.js';

export async function bootstrapMainProcess(): Promise<void> {
  try {
    // 1. Check if launched in hidden mode (OS login item or CLI flag)
    const isHiddenLaunch =
      process.argv.includes('--hidden') ||
      process.argv.includes('--minimized') ||
      (app.getLoginItemSettings && app.getLoginItemSettings().wasOpenedAtLogin);

    // 2. Show splash screen on cold start if not starting hidden
    if (!isHiddenLaunch) {
      console.log('[OS11 Main] Displaying splash screen during cold start...');
      createSplashWindow();
    }

    // 3. Run database migrations and parallel startup preload
    console.log('[OS11 Main] Running startup sequence and migrations...');
    await runStartupSequence();

    // 4. Register IPC handlers across all 16 domains
    console.log('[OS11 Main] Registering IPC handlers...');
    registerIpcHandlers();

    // 5. Create main window (hidden on create per PERFORMANCE.md §1)
    console.log('[OS11 Main] Creating MainWindow (hidden)...');
    const mainWindow = createMainWindow();

    // 6. Create omnibar window (hidden on create)
    console.log('[OS11 Main] Creating OmnibarWindow (hidden)...');
    createOmnibarWindow();

    // 7. Initialize system tray
    console.log('[OS11 Main] Initializing System Tray...');
    initTray();

    // Calculate initial today tasks count for tray badge
    try {
      const taskRepo = new TaskRepository();
      const today = new Date().toISOString().split('T')[0];
      const myDayTasks = taskRepo.getMyDay(today);
      const pendingCount = myDayTasks.filter((t) => t.is_completed === 0).length;
      updateTrayBadge(pendingCount);
    } catch {
      // Tray default badge handles fallback
    }

    // 8. Register OS-level global shortcuts
    console.log('[OS11 Main] Registering Global Shortcuts...');
    registerGlobalShortcuts();

    // 9. Apply saved Always-on-Top and launch settings
    try {
      const settingsRepo = new SettingsRepository();
      const alwaysOnTopSaved = settingsRepo.get<boolean>('always_on_top', false);
      const opacitySaved = settingsRepo.get<number>('always_on_top_opacity', 1.0);
      if (alwaysOnTopSaved) {
        setAlwaysOnTop(true, opacitySaved);
      }
    } catch {
      // Settings fallback
    }

    // 10. Handshake between Splash and Main Window
    mainWindow.once('ready-to-show', () => {
      console.log('[OS11 Main] MainWindow is ready-to-show.');
      destroySplashWindow();

      if (!isHiddenLaunch) {
        showMainWindow();
      }
    });

    // 11. Initialize background non-blocking updater
    initAutoUpdater();

    // 12. Handle app activation (e.g. clicking dock icon on macOS)
    app.on('activate', () => {
      if (!getMainWindow()) {
        createMainWindow();
      } else {
        showMainWindow();
      }
    });
  } catch (err) {
    console.error('[OS11 Main] Startup error:', err);
    destroySplashWindow();
  }
}

// Hook into app lifecycle
app.whenReady().then(bootstrapMainProcess);

// Handle clean shutdown
app.on('before-quit', () => {
  setAppIsQuitting(true);
});

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});

// Window all closed: keep alive in system tray for warm start (PERFORMANCE.md §1)
app.on('window-all-closed', () => {
  // Do NOT quit on Windows or Linux; stay alive in tray for warm start
  if (process.platform === 'darwin') {
    // Standard macOS behavior
  }
});

// Power Monitor: adjust and trigger overdue timers after system sleep
if (typeof powerMonitor !== 'undefined' && powerMonitor.on) {
  powerMonitor.on('resume', () => {
    console.log('[OS11 Main] System resumed from sleep; recalculating reminder schedules...');
    getReminderService()?.rescheduleAfterSleep();
  });
}

// Memory pressure handling (PERFORMANCE.md §15)
app.on('render-process-gone', (_event, _webContents, details) => {
  console.warn('[OS11 Main] Render process gone:', details.reason);
});

process.on('warning', (warning) => {
  if (warning.name === 'MemoryWarning') {
    console.warn('[OS11 Main] Memory warning received, requesting renderer cache trim...');
    const win = getMainWindow();
    win?.webContents.send(IPC.APP.TRIM_MEMORY);
  }
});

export default bootstrapMainProcess;
