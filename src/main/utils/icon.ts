import path from 'node:path';
import fs from 'node:fs';
import * as electron from 'electron';
import { fileURLToPath } from 'node:url';

/**
 * Returns the absolute path to the desktop application icon,
 * compatible with development, build, and production modes.
 */
export function getAppIconPath(): string | undefined {
  try {
    const isWin = process.platform === 'win32';
    const primaryName = isWin ? 'icon.ico' : 'icon.png';
    const fallbackName = isWin ? 'icon.png' : 'icon.ico';

    let baseDir = '';
    try {
      const __filename = fileURLToPath(import.meta.url);
      baseDir = path.dirname(__filename);
    } catch {
      baseDir = process.cwd();
    }

    let appPath = process.cwd();
    try {
      const electronObj = electron as unknown as Record<string, unknown>;
      if (electronObj && typeof electronObj.app === 'object' && electronObj.app !== null) {
        const appInstance = electronObj.app as { getAppPath?: () => string };
        if (typeof appInstance.getAppPath === 'function') {
          appPath = appInstance.getAppPath();
        }
      }
    } catch {
      // Fallback for mocked test environments
    }

    const candidates = [
      path.join(baseDir, '../../public', primaryName),
      path.join(baseDir, '../../build', primaryName),
      path.join(baseDir, '../dist', primaryName),
      path.join(appPath, 'public', primaryName),
      path.join(appPath, 'build', primaryName),
      path.join(appPath, 'dist', primaryName),
      path.join(process.cwd(), 'public', primaryName),
      path.join(process.cwd(), 'build', primaryName),
      // Fallback format
      path.join(baseDir, '../../public', fallbackName),
      path.join(baseDir, '../../build', fallbackName),
      path.join(appPath, 'public', fallbackName),
      path.join(appPath, 'build', fallbackName),
      path.join(process.cwd(), 'public', fallbackName),
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (err) {
    console.warn('[OS11] Could not resolve app icon path:', err);
  }
  return undefined;
}

/**
 * Returns the path to the raster tray icon (preferring 32x32 PNG or ICO),
 * ensuring the Windows/Linux/macOS tray icon matches the desktop application icon.
 */
export function getTrayIconPath(): string | undefined {
  try {
    let baseDir = '';
    try {
      const __filename = fileURLToPath(import.meta.url);
      baseDir = path.dirname(__filename);
    } catch {
      baseDir = process.cwd();
    }

    let appPath = process.cwd();
    try {
      const electronObj = electron as unknown as Record<string, unknown>;
      if (electronObj && typeof electronObj.app === 'object' && electronObj.app !== null) {
        const appInstance = electronObj.app as { getAppPath?: () => string };
        if (typeof appInstance.getAppPath === 'function') {
          appPath = appInstance.getAppPath();
        }
      }
    } catch {
      // Fallback for mocked test environments
    }

    const candidates = [
      path.join(baseDir, '../../build/icons/32x32.png'),
      path.join(appPath, 'build/icons/32x32.png'),
      path.join(process.cwd(), 'build/icons/32x32.png'),
      path.join(baseDir, '../../public/icon.png'),
      path.join(appPath, 'public/icon.png'),
      path.join(process.cwd(), 'public/icon.png'),
      path.join(baseDir, '../dist/icon.png'),
      path.join(appPath, 'dist/icon.png'),
      path.join(baseDir, '../../build/icon.ico'),
      path.join(appPath, 'build/icon.ico'),
      path.join(process.cwd(), 'build/icon.ico'),
      path.join(baseDir, '../../public/icon.ico'),
      path.join(appPath, 'public/icon.ico'),
    ];

    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (err) {
    console.warn('[OS11] Could not resolve tray icon path:', err);
  }
  return getAppIconPath();
}

