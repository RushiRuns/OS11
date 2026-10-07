import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';

let capturedOptions: BrowserWindowConstructorOptions | undefined;
let isDestroyedState = false;

vi.mock('electron', () => {
  return {
    BrowserWindow: vi.fn().mockImplementation((options: BrowserWindowConstructorOptions) => {
      capturedOptions = options;
      return {
        isDestroyed: () => isDestroyedState,
        webContents: { send: vi.fn() },
        on: vi.fn(),
        loadFile: vi.fn(),
        loadURL: vi.fn(),
      };
    }),
    app: {
      isPackaged: false,
      getAppPath: () => '',
    },
  };
});

import { createMainWindow } from '../../src/main/window/main-window.js';

describe('MainWindow Background Throttling Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOptions = undefined;
    isDestroyedState = true; // Force createMainWindow to construct a fresh BrowserWindow
  });

  it('disables backgroundThrottling so background timers like Pomodoro do not stop when window is minimized or hidden', () => {
    createMainWindow();

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions?.webPreferences).toBeDefined();
    // When backgroundThrottling is not explicitly false, Electron defaults to true,
    // which causes Chromium to pause/throttle timers (setInterval) when the window is minimized or hidden to tray.
    expect(capturedOptions?.webPreferences?.backgroundThrottling).toBe(false);
  });
});
