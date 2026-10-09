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
    height: 84,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
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

  try {
    timerWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  } catch {
    timerWindow.setAlwaysOnTop(true);
  }

  if (typeof timerWindow.setVisibleOnAllWorkspaces === 'function') {
    timerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Prevent Windows Show Desktop (Win+D) from leaving mini window minimized
  timerWindow.on('minimize', () => {
    if (timerWindow && !timerWindow.isDestroyed()) {
      timerWindow.restore();
    }
  });

  // Lock zoom limits and prevent zoom accelerators (Ctrl+=, Ctrl+-, Ctrl+0, etc.)
  const applyZoomLock = () => {
    if (timerWindow && !timerWindow.isDestroyed()) {
      try {
        if (typeof timerWindow.webContents.setVisualZoomLevelLimits === 'function') {
          const res = timerWindow.webContents.setVisualZoomLevelLimits(1, 1);
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        }
        if (typeof timerWindow.webContents.setZoomLevel === 'function') {
          timerWindow.webContents.setZoomLevel(0);
        }
        if (typeof timerWindow.webContents.setZoomFactor === 'function') {
          timerWindow.webContents.setZoomFactor(1);
        }
      } catch {
        // Fallback for mock/headless
      }
    }
  };

  applyZoomLock();

  timerWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.control || input.meta)) {
      const key = (input.key || '').toLowerCase();
      if (
        key === '+' ||
        key === '=' ||
        key === '-' ||
        key === '_' ||
        key === '0' ||
        key === 'add' ||
        key === 'subtract' ||
        key === 'numpadadd' ||
        key === 'numpadsubtract'
      ) {
        event.preventDefault();
      }
    }
  });

  timerWindow.webContents.on('zoom-changed', (event) => {
    event.preventDefault();
  });

  timerWindow.webContents.on('did-finish-load', () => {
    applyZoomLock();
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
    if (timerWindow.isMinimized()) {
      timerWindow.restore();
    }
    timerWindow.show();
    try {
      timerWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    } catch {
      timerWindow.setAlwaysOnTop(true);
    }
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
