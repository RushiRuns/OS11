import { Tray, Menu, nativeImage, app } from 'electron';
import { showMainWindow, toggleMainWindow } from '../window/main-window.js';
import { showOmnibarWindow } from '../window/omnibar-window.js';

let tray: Tray | null = null;
let currentTaskCount = 0;
let currentPomodoroTime: string | null = null;

export function generateTraySvg(count: number, pomodoro?: string | null): string {
  if (pomodoro) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#ef4444"/>
      <text x="16" y="21" font-size="12" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif">${pomodoro}</text>
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

export function createTrayIcon(count: number, pomodoro?: string | null): Electron.NativeImage {
  const svg = generateTraySvg(count, pomodoro);
  const base64 = Buffer.from(svg).toString('base64');
  const img = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${base64}`);
  return img.resize({ width: 16, height: 16 });
}

export function buildTrayContextMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  const taskSummary = currentTaskCount > 0
    ? `Today's Tasks (${currentTaskCount} pending)`
    : "Today's Tasks (All clear ✓)";

  const pomodoroLabel = currentPomodoroTime
    ? `Pomodoro: 🍅 ${currentPomodoroTime}`
    : 'Pomodoro: Idle';

  return [
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
    {
      label: pomodoroLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quit OS11',
      click: () => {
        if (typeof app !== 'undefined' && app.quit) {
          app.quit();
        }
      },
    },
  ];
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

  const icon = createTrayIcon(currentTaskCount, currentPomodoroTime);
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

export function updateTrayBadge(taskCount: number, pomodoroTime?: string | null): void {
  currentTaskCount = taskCount;
  currentPomodoroTime = pomodoroTime ?? null;

  if (tray) {
    const icon = createTrayIcon(currentTaskCount, currentPomodoroTime);
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

export function getTray(): Tray | null {
  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
