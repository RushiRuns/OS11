import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_DEFAULTS } from '@shared/constants/index.js';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  mainWindow = new BrowserWindow({
    width: APP_DEFAULTS.WINDOW_WIDTH,
    height: APP_DEFAULTS.WINDOW_HEIGHT,
    minWidth: APP_DEFAULTS.MIN_WIDTH,
    minHeight: APP_DEFAULTS.MIN_HEIGHT,
    show: false,
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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
