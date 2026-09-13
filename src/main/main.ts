import { app, powerMonitor } from 'electron';
import { runStartupSequence, getReminderService } from './startup.js';
import { registerIpcHandlers } from './ipc/index.js';
import { createMainWindow, getMainWindow } from './window/main-window.js';
import { IPC } from '@shared/ipc-channels.js';

export async function bootstrapMainProcess(): Promise<void> {
  try {
    console.log('[OS11 Main] Running startup sequence and migrations...');
    await runStartupSequence();

    console.log('[OS11 Main] Registering IPC handlers...');
    registerIpcHandlers();

    console.log('[OS11 Main] Creating MainWindow (hidden)...');
    createMainWindow();

    app.on('activate', () => {
      if (!getMainWindow()) {
        createMainWindow();
      } else {
        getMainWindow()?.show();
      }
    });
  } catch (err) {
    console.error('[OS11 Main] Startup error:', err);
  }
}

// Hook into app lifecycle
app.whenReady().then(bootstrapMainProcess);

// Window all closed: keep alive in system tray / background (PERFORMANCE.md §1)
app.on('window-all-closed', () => {
  // Do NOT quit on Windows or Linux; stay alive in tray for warm start
  if (process.platform === 'darwin') {
    // macOS default behavior
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

// Emit trim memory event on memory warning
process.on('warning', (warning) => {
  if (warning.name === 'MemoryWarning') {
    console.warn('[OS11 Main] Memory warning received, requesting renderer cache trim...');
    const win = getMainWindow();
    win?.webContents.send(IPC.APP.TRIM_MEMORY);
  }
});

export default bootstrapMainProcess;
