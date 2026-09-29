import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let quickAddModalWindow: BrowserWindow | null = null;

export function createQuickAddModalWindow(): BrowserWindow {
  if (quickAddModalWindow && !quickAddModalWindow.isDestroyed()) {
    return quickAddModalWindow;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  quickAddModalWindow = new BrowserWindow({
    width: 620,
    height: 480,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Auto-hides on click outside / blur
  quickAddModalWindow.on('blur', () => {
    if (quickAddModalWindow && !quickAddModalWindow.isDestroyed() && quickAddModalWindow.isVisible()) {
      quickAddModalWindow.hide();
    }
  });

  quickAddModalWindow.on('close', (e) => {
    e.preventDefault();
    quickAddModalWindow?.hide();
  });

  quickAddModalWindow.on('closed', () => {
    quickAddModalWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    quickAddModalWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#quickadd-modal`);
  } else {
    quickAddModalWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: 'quickadd-modal',
    });
  }

  return quickAddModalWindow;
}

export function getQuickAddModalWindow(): BrowserWindow | null {
  return quickAddModalWindow;
}

export function showQuickAddModalWindow(): void {
  if (!quickAddModalWindow || quickAddModalWindow.isDestroyed()) {
    createQuickAddModalWindow();
  }

  if (quickAddModalWindow) {
    quickAddModalWindow.center();
    quickAddModalWindow.show();
    quickAddModalWindow.focus();
  }
}

export function hideQuickAddModalWindow(): void {
  if (quickAddModalWindow && !quickAddModalWindow.isDestroyed() && quickAddModalWindow.isVisible()) {
    quickAddModalWindow.hide();
  }
}

export function toggleQuickAddModalWindow(): void {
  if (!quickAddModalWindow || quickAddModalWindow.isDestroyed()) {
    showQuickAddModalWindow();
    return;
  }

  if (quickAddModalWindow.isVisible()) {
    hideQuickAddModalWindow();
  } else {
    showQuickAddModalWindow();
  }
}
