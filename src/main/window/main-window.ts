import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_DEFAULTS } from '@shared/constants/index.js';
import { IPC } from '@shared/ipc-channels.js';

let mainWindow: BrowserWindow | null = null;
let isAppQuitting = false;

export function setAppIsQuitting(quitting: boolean): void {
  isAppQuitting = quitting;
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  mainWindow = new BrowserWindow({
    width: APP_DEFAULTS.WINDOW_WIDTH,
    height: APP_DEFAULTS.WINDOW_HEIGHT,
    minWidth: APP_DEFAULTS.MIN_WIDTH,
    minHeight: APP_DEFAULTS.MIN_HEIGHT,
    show: false, // Never show on create (PERFORMANCE.md §1)
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    backgroundColor: '#0f172a',
    title: APP_DEFAULTS.APP_TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Intercept window close: hide to tray, do NOT destroy (PERFORMANCE.md §1)
  mainWindow.on('close', (e) => {
    if (!isAppQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

export function hideMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

export function toggleMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    showMainWindow();
    return;
  }

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    hideMainWindow();
  } else {
    showMainWindow();
  }
}

export function setAlwaysOnTop(pinned: boolean, opacity = 1.0): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  mainWindow.setAlwaysOnTop(pinned);

  // Clamped opacity 50% - 100% per specifications
  if (pinned && opacity < 1.0) {
    const clampedOpacity = Math.max(0.5, Math.min(1.0, opacity));
    mainWindow.setOpacity(clampedOpacity);
  } else {
    mainWindow.setOpacity(1.0);
  }

  return pinned;
}

export function focusQuickAdd(): void {
  showMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.APP.FOCUS_QUICK_ADD);
  }
}
