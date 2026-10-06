import { Tray, Menu, nativeImage, app } from 'electron';
import { showMainWindow, toggleMainWindow } from '../window/main-window.js';
import { showOmnibarWindow } from '../window/omnibar-window.js';
import { getTrayIconPath } from '../utils/icon.js';

let tray: Tray | null = null;
let currentTaskCount = 0;
let currentPomodoroTime: string | null = null;
let currentPomodoroPaused = false;
let currentPomodoroProgress = 1;
let pomodoroActionCallback: ((action: 'pause' | 'resume' | 'skip' | 'reset') => void) | null = null;

export function setTrayPomodoroActionCallback(
  callback: (action: 'pause' | 'resume' | 'skip' | 'reset') => void
): void {
  pomodoroActionCallback = callback;
}

export function generateTraySvg(
  count: number,
  pomodoro?: string | null,
  progress?: number
): string {
  if (pomodoro) {
    const pct = Math.max(0, Math.min(1, progress ?? 1));
    const circumference = 81.68;
    const dash = (pct * circumference).toFixed(1);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#1e293b"/>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 16 16)"/>
      <text x="16" y="20" font-size="10" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">${pomodoro}</text>
    </svg>`;
  }

  if (count > 0) {
    const text = count > 99 ? '99+' : String(count);
    const fontSize = count > 99 ? 10 : 13;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#3b82f6"/>
      <text x="16" y="21" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">${text}</text>
    </svg>`;
  }

  // Default clean OS11 icon
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="#1e293b"/>
    <path d="M9 16l5 5 9-10" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function createTrayIcon(
  count: number,
  pomodoro?: string | null,
  progress?: number
): Electron.NativeImage {
  const iconPath = getTrayIconPath();
  if (iconPath && typeof nativeImage?.createFromPath === 'function') {
    try {
      const baseImg = nativeImage.createFromPath(iconPath);
      if (baseImg && !baseImg.isEmpty()) {
        const size = baseImg.getSize();
        const sized =
          size.width === 32 && size.height === 32
            ? baseImg
            : baseImg.resize({ width: 32, height: 32 });

        // If no tasks pending and no pomodoro, return clean desktop app icon
        if (count <= 0 && !pomodoro) {
          return sized;
        }

        // Draw a neat notification dot in the corner so the desktop app icon remains clearly visible
        const bmp = Buffer.from(sized.toBitmap());
        if (bmp.length === 32 * 32 * 4) {
          const width = 32;
          const height = 32;

          const setPixel = (x: number, y: number, b: number, g: number, r: number, a = 255) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return;
            const idx = (y * width + x) * 4;
            const oldB = bmp[idx];
            const oldG = bmp[idx + 1];
            const oldR = bmp[idx + 2];
            const alpha = a / 255;
            bmp[idx] = Math.round(b * alpha + oldB * (1 - alpha));
            bmp[idx + 1] = Math.round(g * alpha + oldG * (1 - alpha));
            bmp[idx + 2] = Math.round(r * alpha + oldR * (1 - alpha));
            bmp[idx + 3] = 255;
          };

          const drawCircle = (cx: number, cy: number, r: number, b: number, g: number, rCol: number) => {
            for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
              for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
                const dist = Math.hypot(x - cx, y - cy);
                if (dist <= r - 0.5) {
                  setPixel(x, y, b, g, rCol, 255);
                } else if (dist <= r + 0.5) {
                  const a = Math.round((1 - (dist - (r - 0.5))) * 255);
                  setPixel(x, y, b, g, rCol, a);
                }
              }
            }
          };

          // Draw small status dot at corner (24, 24)
          const cx = 24;
          const cy = 24;
          drawCircle(cx, cy, 4.5, 15, 23, 42); // dark outline
          if (pomodoro) {
            drawCircle(cx, cy, 3.5, 68, 68, 239); // Red for pomodoro
          } else {
            drawCircle(cx, cy, 3.5, 246, 130, 59); // Bright Blue for tasks
          }

          const badged = nativeImage.createFromBuffer(bmp, { width: 32, height: 32 });
          if (badged && !badged.isEmpty()) {
            return badged;
          }
        }

        return sized;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback to SVG data URL for test/headless environments where raster icon isn't available
  const svg = generateTraySvg(count, pomodoro, progress);
  const base64 = Buffer.from(svg).toString('base64');
  if (typeof nativeImage?.createFromDataURL === 'function') {
    const img = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
    return typeof img?.resize === 'function' ? img.resize({ width: 16, height: 16 }) : img;
  }
  return nativeImage?.createEmpty ? nativeImage.createEmpty() : ({} as Electron.NativeImage);
}

export function buildTrayContextMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  const taskSummary = currentTaskCount > 0
    ? `Today's Tasks (${currentTaskCount} pending)`
    : "Today's Tasks (All clear ✓)";

  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open OS11',
      click: () => showMainWindow(),
    },
    {
      label: 'Quick Add (Ctrl+Space)',
      click: () => showOmnibarWindow(),
    },
    { type: 'separator' },
    {
      label: taskSummary,
      click: () => showMainWindow(),
    },
  ];

  if (currentPomodoroTime) {
    items.push(
      { type: 'separator' },
      {
        label: `Pomodoro: 🍅 ${currentPomodoroTime}`,
        enabled: false,
      },
      {
        label: currentPomodoroPaused ? '▶ Resume Pomodoro' : '⏸ Pause Pomodoro',
        click: () => pomodoroActionCallback?.(currentPomodoroPaused ? 'resume' : 'pause'),
      },
      {
        label: '⏭ Skip Session',
        click: () => pomodoroActionCallback?.('skip'),
      },
      {
        label: '⏹ Reset Timer',
        click: () => pomodoroActionCallback?.('reset'),
      }
    );
  } else {
    items.push({
      label: 'Pomodoro: Idle',
      enabled: false,
    });
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Quit OS11',
      click: () => {
        if (typeof app !== 'undefined' && app.quit) {
          app.quit();
        }
      },
    }
  );

  return items;
}

export function buildTrayContextMenu(): Menu | null {
  const template = buildTrayContextMenuTemplate();
  if (typeof Menu !== 'undefined' && Menu.buildFromTemplate) {
    return Menu.buildFromTemplate(template);
  }
  return null;
}

export function initTray(): Tray | null {
  if (tray) {
    return tray;
  }

  if (typeof Tray === 'undefined') {
    return null;
  }

  const icon = createTrayIcon(currentTaskCount, currentPomodoroTime, currentPomodoroProgress);
  tray = new Tray(icon);
  tray.setToolTip('OS11 — Productivity OS');
  const menu = buildTrayContextMenu();
  if (menu) {
    tray.setContextMenu(menu);
  }

  tray.on('click', () => {
    toggleMainWindow();
  });

  tray.on('double-click', () => {
    showMainWindow();
  });

  return tray;
}

export function updateTrayBadge(
  taskCount: number,
  pomodoroTime?: string | null,
  progress?: number
): void {
  currentTaskCount = taskCount;
  currentPomodoroTime = pomodoroTime ?? null;
  if (progress !== undefined) currentPomodoroProgress = progress;

  if (tray) {
    const icon = createTrayIcon(currentTaskCount, currentPomodoroTime, currentPomodoroProgress);
    tray.setImage(icon);

    const tooltip = currentPomodoroTime
      ? `OS11 — 🍅 ${currentPomodoroTime} (${currentTaskCount} tasks)`
      : `OS11 — ${currentTaskCount} tasks due today`;
    tray.setToolTip(tooltip);
    const menu = buildTrayContextMenu();
    if (menu) {
      tray.setContextMenu(menu);
    }
  }
}

export function updateTrayPomodoroState(
  timeText: string | null,
  isPaused: boolean,
  progress?: number
): void {
  currentPomodoroTime = timeText;
  currentPomodoroPaused = isPaused;
  if (progress !== undefined) currentPomodoroProgress = progress;
  updateTrayBadge(currentTaskCount, timeText, progress);
}

export function getTray(): Tray | null {
  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

export default initTray;
