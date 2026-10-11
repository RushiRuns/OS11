import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';

let capturedOptions: BrowserWindowConstructorOptions | undefined;
let isDestroyedState = false;
let isMinimizedState = false;
let isVisibleState = false;
let isFocusedState = false;
const capturedWindowEvents: Record<string, (...args: unknown[]) => void> = {};

const mockRestore = vi.fn(() => {
  isMinimizedState = false;
});
const mockShow = vi.fn(() => {
  isVisibleState = true;
});
const mockHide = vi.fn(() => {
  isVisibleState = false;
  isFocusedState = false;
});
const mockFocus = vi.fn(() => {
  isFocusedState = true;
});
const mockCenter = vi.fn();
const mockMoveTop = vi.fn();
const mockDestroy = vi.fn(() => {
  isDestroyedState = true;
});
let currentWidth = 620;
let currentHeight = 180;
const mockSetSize = vi.fn((w: number, h: number) => {
  currentWidth = w;
  currentHeight = h;
});
const mockGetBounds = vi.fn(() => ({ x: 100, y: 100, width: currentWidth, height: currentHeight }));

let resizableState = false;
const mockIsResizable = vi.fn(() => resizableState);
const mockSetResizable = vi.fn((r: boolean) => {
  resizableState = r;
});

vi.mock('electron', () => {
  return {
    BrowserWindow: vi.fn().mockImplementation((options: BrowserWindowConstructorOptions) => {
      capturedOptions = options;
      return {
        isDestroyed: () => isDestroyedState,
        isMinimized: () => isMinimizedState,
        isVisible: () => isVisibleState,
        isFocused: () => isFocusedState,
        isResizable: mockIsResizable,
        setResizable: mockSetResizable,
        restore: mockRestore,
        show: mockShow,
        hide: mockHide,
        focus: mockFocus,
        center: mockCenter,
        moveTop: mockMoveTop,
        destroy: mockDestroy,
        setSize: mockSetSize,
        getBounds: mockGetBounds,
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          capturedWindowEvents[event] = handler;
        }),
        loadFile: vi.fn(),
        loadURL: vi.fn(),
      };
    }),
  };
});

import {
  createOmnibarWindow,
  showOmnibarWindow,
  toggleOmnibarWindow,
  resizeOmnibarWindow,
  destroyOmnibarWindow,
} from '../../src/main/window/omnibar-window.js';

describe('Omnibar Window Shortcut & Lifecycle Regression Tests', () => {
  beforeEach(() => {
    destroyOmnibarWindow();
    vi.clearAllMocks();
    capturedOptions = undefined;
    isDestroyedState = false;
    isMinimizedState = false;
    isVisibleState = false;
    isFocusedState = false;
    for (const key of Object.keys(capturedWindowEvents)) {
      delete capturedWindowEvents[key];
    }
  });

  describe('Bug 1: Toggle logic when visible but unfocused', () => {
    it('focuses and shows Omnibar if it is already visible but not focused (does NOT hide)', () => {
      createOmnibarWindow();
      isVisibleState = true;
      isFocusedState = false; // Omnibar is in background / unfocused

      toggleOmnibarWindow();

      // Expect it to focus/show Omnibar, NOT hide it
      expect(mockHide).not.toHaveBeenCalled();
      expect(mockShow).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('hides Omnibar if it is visible and currently focused', () => {
      createOmnibarWindow();
      isVisibleState = true;
      isFocusedState = true;

      toggleOmnibarWindow();

      expect(mockHide).toHaveBeenCalled();
    });
  });

  describe('Bug 2: Window minimization resilience (Win+D)', () => {
    it('disallows minimization and maximization in window options', () => {
      createOmnibarWindow();
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.minimizable).toBe(false);
      expect(capturedOptions?.maximizable).toBe(false);
    });

    it('restores window if minimized when showOmnibarWindow is called', () => {
      createOmnibarWindow();
      isMinimizedState = true;

      showOmnibarWindow();

      expect(mockRestore).toHaveBeenCalledTimes(1);
      expect(mockShow).toHaveBeenCalledTimes(1);
    });
  });

  describe('Bug 3: Blur and globalShortcut toggle race condition', () => {
    it('does not re-open the Omnibar if a blur-induced hide just occurred right before toggle', () => {
      createOmnibarWindow();
      isVisibleState = true;
      isFocusedState = true;

      // Simulate blur event firing right as user presses toggle hotkey
      const blurHandler = capturedWindowEvents['blur'];
      expect(blurHandler).toBeDefined();
      blurHandler();

      expect(mockHide).toHaveBeenCalledTimes(1);
      expect(isVisibleState).toBe(false);

      // Immediately followed by globalShortcut calling toggleOmnibarWindow
      toggleOmnibarWindow();

      // Should remain hidden, not immediately re-opened
      expect(mockShow).not.toHaveBeenCalled();
    });
  });

  describe('Bug 4: Window dimensions matching Omnibar card', () => {
    it('creates window with dimensions matching omnibar width (620px)', () => {
      createOmnibarWindow();
      expect(capturedOptions?.width).toBe(620);
      expect(capturedOptions?.height).toBe(180);
    });

    it('resizes window dynamically to match exact omnibar height', () => {
      createOmnibarWindow();
      resizableState = false;
      resizeOmnibarWindow(620, 260);

      expect(mockSetResizable).toHaveBeenCalledWith(true);
      expect(mockSetSize).toHaveBeenCalledWith(620, 260);
      expect(mockSetResizable).toHaveBeenCalledWith(false);
    });
  });
});
