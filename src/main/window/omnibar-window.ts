import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let omnibarWindow: BrowserWindow | null = null;
let lastBlurHideTime = 0;

export function createOmnibarWindow(): BrowserWindow {
  if (omnibarWindow && !omnibarWindow.isDestroyed()) {
    return omnibarWindow;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  omnibarWindow = new BrowserWindow({
    width: 620,
    height: 180,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  // Closes on click-outside / loss of focus
  omnibarWindow.on('blur', () => {
    if (omnibarWindow && !omnibarWindow.isDestroyed() && omnibarWindow.isVisible()) {
      lastBlurHideTime = Date.now();
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
    if (omnibarWindow.isMinimized()) {
      omnibarWindow.restore();
    }
    omnibarWindow.center();
    omnibarWindow.show();
    omnibarWindow.focus();
    if (typeof omnibarWindow.moveTop === 'function') {
      omnibarWindow.moveTop();
    }
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

  // If window was just hidden via blur by the hotkey press itself, avoid immediate re-opening
  if (Date.now() - lastBlurHideTime < 200) {
    return;
  }

  if (omnibarWindow.isVisible() && omnibarWindow.isFocused()) {
    hideOmnibarWindow();
  } else {
    showOmnibarWindow();
  }
}

export function resizeOmnibarWindow(width?: number, height?: number): void {
  if (omnibarWindow && !omnibarWindow.isDestroyed()) {
    const currentBounds = omnibarWindow.getBounds();
    const targetWidth = width ?? currentBounds.width;
    const targetHeight = Math.max(120, Math.ceil(height ?? currentBounds.height));
    if (currentBounds.width !== targetWidth || currentBounds.height !== targetHeight) {
      const wasResizable = omnibarWindow.isResizable();
      if (!wasResizable) {
        omnibarWindow.setResizable(true);
      }
      omnibarWindow.setSize(targetWidth, targetHeight);
      if (!wasResizable) {
        omnibarWindow.setResizable(false);
      }
    }
  }
}

export function destroyOmnibarWindow(): void {
  if (omnibarWindow) {
    omnibarWindow.destroy();
    omnibarWindow = null;
  }
  lastBlurHideTime = 0;
}
