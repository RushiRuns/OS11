import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';

export interface ShortcutInput {
  type: string;
  key: string;
  control?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Checks whether an input event corresponds to a developer tools shortcut:
 * - F12 (universal standard)
 * - Ctrl+Shift+I / Cmd+Option+I (toggle developer tools)
 * - Ctrl+Shift+C / Cmd+Option+C (inspect element)
 */
export function isDevToolsShortcut(input: ShortcutInput, isMac = process.platform === 'darwin'): boolean {
  if (input.type !== 'keyDown') return false;

  const key = input.key?.toLowerCase();

  // F12 key (universal devtools toggle across browsers and desktop apps)
  if (input.key === 'F12') {
    return true;
  }

  // Ctrl+Shift+I or Ctrl+Shift+C on Windows/Linux
  if (!isMac && input.control && input.shift && (key === 'i' || key === 'c')) {
    return true;
  }

  // Cmd+Alt+I or Cmd+Alt+C on macOS
  if (isMac && input.meta && input.alt && (key === 'i' || key === 'c')) {
    return true;
  }

  return false;
}

/**
 * Toggles developer tools on the specified window.
 * Uses detached mode so transparent, small, or frameless windows keep their exact layout.
 */
export function toggleDevTools(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;

  const { webContents } = window;
  if (!webContents) return;

  if (webContents.isDevToolsOpened()) {
    webContents.closeDevTools();
  } else {
    webContents.openDevTools({ mode: 'detach' });
  }
}

/**
 * Opens developer tools in detached mode.
 */
export function openDevTools(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;

  const { webContents } = window;
  if (!webContents) return;

  webContents.openDevTools({ mode: 'detach' });
}

/**
 * Builds the context menu template for right-click on any window.
 */
export function buildDevToolsContextMenuTemplate(
  window: BrowserWindow,
  params: { x: number; y: number }
): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  return [
    {
      label: 'Inspect Element',
      click: () => {
        if (!window || window.isDestroyed()) return;
        const { webContents } = window;
        if (webContents.isDevToolsOpened()) {
          webContents.inspectElement(params.x, params.y);
        } else {
          webContents.openDevTools({ mode: 'detach' });
          webContents.once('devtools-opened', () => {
            webContents.inspectElement(params.x, params.y);
          });
        }
      },
    },
    {
      label: 'Toggle Developer Tools',
      accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
      click: () => {
        toggleDevTools(window);
      },
    },
    { type: 'separator' },
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        if (!window || window.isDestroyed()) return;
        window.webContents?.reload();
      },
    },
  ];
}

/**
 * Attaches DevTools listeners (before-input-event and context-menu) to a BrowserWindow.
 */
export function setupDevToolsForWindow(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;

  const { webContents } = window;
  if (!webContents || typeof webContents.on !== 'function') return;

  // Intercept before-input-event so hotkeys work everywhere (including inputs, modals, menus)
  webContents.on('before-input-event', (event, input) => {
    if (isDevToolsShortcut(input)) {
      event.preventDefault();
      toggleDevTools(window);
    }
  });

  // Native context-menu listener for right-click anywhere on the window
  webContents.on('context-menu', (_event, params) => {
    if (!window || window.isDestroyed()) return;

    if (typeof Menu !== 'undefined' && Menu.buildFromTemplate) {
      const template = buildDevToolsContextMenuTemplate(window, params);
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window });
    }
  });
}

/**
 * Installs DevTools access across the entire app for any existing and newly created window.
 */
export function setupGlobalDevTools(): void {
  if (typeof app !== 'undefined' && app.on) {
    app.on('browser-window-created', (_event, window) => {
      setupDevToolsForWindow(window);
    });
  }

  if (typeof BrowserWindow !== 'undefined' && BrowserWindow.getAllWindows) {
    try {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        setupDevToolsForWindow(win);
      }
    } catch {
      // Non-fatal if called before window system is ready
    }
  }
}
