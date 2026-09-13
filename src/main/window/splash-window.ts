import { BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

let splashWindow: BrowserWindow | null = null;

export function resolveSplashHtmlPath(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const candidates = [
      path.join(__dirname, '../splash/splash.html'),
      path.join(__dirname, '../../src/splash/splash.html'),
      path.join(process.cwd(), 'src/splash/splash.html'),
      path.join(process.cwd(), 'dist/splash/splash.html'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Fallback to process.cwd()
  }
  return path.join(process.cwd(), 'src/splash/splash.html');
}

export function createSplashWindow(): BrowserWindow {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const splashFile = resolveSplashHtmlPath();
  splashWindow.loadFile(splashFile);

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });

  return splashWindow;
}

export function destroySplashWindow(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    try {
      splashWindow.destroy();
    } catch {
      // Ignored if already destroyed
    }
    splashWindow = null;
  }
}

export function getSplashWindow(): BrowserWindow | null {
  return splashWindow;
}
