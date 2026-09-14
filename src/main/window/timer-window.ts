import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let timerWindow: BrowserWindow | null = null;
let savedBounds: { x?: number; y?: number } = {};

export function createTimerWindow(): BrowserWindow {
  if (timerWindow && !timerWindow.isDestroyed()) {
    return timerWindow;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  let initialX = savedBounds.x;
  let initialY = savedBounds.y;

  if (initialX === undefined || initialY === undefined) {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      initialX = width - 240;
      initialY = height - 100;
    } catch {
      // Headless or testing fallback
    }
  }

  timerWindow = new BrowserWindow({
    width: 220,
    height: 76,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  timerWindow.on('moved', () => {
    if (timerWindow && !timerWindow.isDestroyed()) {
      const bounds = timerWindow.getBounds();
      savedBounds = { x: bounds.x, y: bounds.y };
    }
  });

  timerWindow.on('closed', () => {
    timerWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    timerWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#mini-timer`);
  } else {
    timerWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: 'mini-timer',
    });
  }

  return timerWindow;
}

export function showTimerWindow(): void {
  if (!timerWindow || timerWindow.isDestroyed()) {
    createTimerWindow();
  }
  if (timerWindow) {
    timerWindow.show();
  }
}

export function hideTimerWindow(): void {
  if (timerWindow && !timerWindow.isDestroyed() && timerWindow.isVisible()) {
    timerWindow.hide();
  }
}

export function getTimerWindow(): BrowserWindow | null {
  return timerWindow;
}

export function destroyTimerWindow(): void {
  if (timerWindow) {
    timerWindow.destroy();
    timerWindow = null;
  }
}

export default createTimerWindow;
