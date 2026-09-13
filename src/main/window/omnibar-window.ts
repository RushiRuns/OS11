import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let omnibarWindow: BrowserWindow | null = null;

export function createOmnibarWindow(): BrowserWindow {
  if (omnibarWindow && !omnibarWindow.isDestroyed()) {
    return omnibarWindow;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  omnibarWindow = new BrowserWindow({
    width: 640,
    height: 380,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
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

  // Closes on click-outside / loss of focus
  omnibarWindow.on('blur', () => {
    if (omnibarWindow && !omnibarWindow.isDestroyed() && omnibarWindow.isVisible()) {
      omnibarWindow.hide();
    }
  });

  omnibarWindow.on('closed', () => {
    omnibarWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    omnibarWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#omnibar`);
  } else {
    omnibarWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: 'omnibar',
    });
  }

  return omnibarWindow;
}

export function getOmnibarWindow(): BrowserWindow | null {
  return omnibarWindow;
}

export function showOmnibarWindow(): void {
  if (!omnibarWindow || omnibarWindow.isDestroyed()) {
    createOmnibarWindow();
  }

  if (omnibarWindow) {
    omnibarWindow.center();
    omnibarWindow.show();
    omnibarWindow.focus();
  }
}

export function hideOmnibarWindow(): void {
  if (omnibarWindow && !omnibarWindow.isDestroyed() && omnibarWindow.isVisible()) {
    omnibarWindow.hide();
  }
}

export function toggleOmnibarWindow(): void {
  if (!omnibarWindow || omnibarWindow.isDestroyed()) {
    showOmnibarWindow();
    return;
  }

  if (omnibarWindow.isVisible()) {
    hideOmnibarWindow();
  } else {
    showOmnibarWindow();
  }
}
