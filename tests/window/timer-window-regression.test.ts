import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindowConstructorOptions } from 'electron';

let capturedOptions: BrowserWindowConstructorOptions | undefined;
let isDestroyedState = false;
let isMinimizedState = false;
const capturedWindowEvents: Record<string, (...args: unknown[]) => void> = {};
const capturedWebContentsEvents: Record<string, (...args: unknown[]) => void> = {};

const mockRestore = vi.fn(() => {
  isMinimizedState = false;
});
const mockSetAlwaysOnTop = vi.fn();
const mockSetVisibleOnAllWorkspaces = vi.fn();
const mockSetVisualZoomLevelLimits = vi.fn().mockResolvedValue(undefined);
const mockSetZoomLevel = vi.fn();
const mockSetZoomFactor = vi.fn();
const mockShow = vi.fn();
const mockHide = vi.fn();
const mockDestroy = vi.fn(() => {
  isDestroyedState = true;
});

vi.mock('electron', () => {
  return {
    screen: {
      getPrimaryDisplay: () => ({
        workAreaSize: { width: 1920, height: 1080 },
      }),
    },
    BrowserWindow: vi.fn().mockImplementation((options: BrowserWindowConstructorOptions) => {
      capturedOptions = options;
      return {
        isDestroyed: () => isDestroyedState,
        isMinimized: () => isMinimizedState,
        restore: mockRestore,
        show: mockShow,
        hide: mockHide,
        destroy: mockDestroy,
        setAlwaysOnTop: mockSetAlwaysOnTop,
        setVisibleOnAllWorkspaces: mockSetVisibleOnAllWorkspaces,
        getBounds: () => ({ x: 100, y: 100 }),
        on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
          capturedWindowEvents[event] = handler;
        }),
        webContents: {
          send: vi.fn(),
          setVisualZoomLevelLimits: mockSetVisualZoomLevelLimits,
          setZoomLevel: mockSetZoomLevel,
          setZoomFactor: mockSetZoomFactor,
          on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
            capturedWebContentsEvents[event] = handler;
          }),
        },
        loadFile: vi.fn(),
        loadURL: vi.fn(),
      };
    }),
  };
});

import {
  createTimerWindow,
  destroyTimerWindow,
  showTimerWindow,
} from '../../src/main/window/timer-window.js';

describe('Timer Window Regression Tests', () => {
  beforeEach(() => {
    destroyTimerWindow();
    vi.clearAllMocks();
    capturedOptions = undefined;
    isDestroyedState = false;
    isMinimizedState = false;
    for (const key of Object.keys(capturedWindowEvents)) {
      delete capturedWindowEvents[key];
    }
    for (const key of Object.keys(capturedWebContentsEvents)) {
      delete capturedWebContentsEvents[key];
    }
  });

  describe('Bug 1: Window Disappearing & Resurfacing', () => {
    it('sets minimizable: false and maximizable: false in window options', () => {
      createTimerWindow();
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.minimizable).toBe(false);
      expect(capturedOptions?.maximizable).toBe(false);
    });

    it('immediately restores the window if minimized by Windows Show Desktop (Win+D)', () => {
      createTimerWindow();
      expect(capturedWindowEvents['minimize']).toBeDefined();

      isMinimizedState = true;
      capturedWindowEvents['minimize']();
      expect(mockRestore).toHaveBeenCalledTimes(1);
    });

    it('elevates alwaysOnTop to screen-saver level and persists across all virtual desktops', () => {
      createTimerWindow();
      expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1);
      expect(mockSetVisibleOnAllWorkspaces).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ visibleOnFullScreen: true })
      );
    });

    it('showTimerWindow restores minimized state and re-asserts elevated alwaysOnTop', () => {
      createTimerWindow();
      isMinimizedState = true;
      vi.clearAllMocks();

      showTimerWindow();
      expect(mockRestore).toHaveBeenCalledTimes(1);
      expect(mockShow).toHaveBeenCalledTimes(1);
      expect(mockSetAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver', 1);
    });
  });

  describe('Bug 2: Content Shrinking / Zooming (Ctrl+=, Ctrl+-, Ctrl+0, etc.)', () => {
    it('locks visual zoom level limits, zoom factor, and zoom level upon creation', () => {
      createTimerWindow();
      expect(mockSetVisualZoomLevelLimits).toHaveBeenCalledWith(1, 1);
      expect(mockSetZoomFactor).toHaveBeenCalledWith(1);
      expect(mockSetZoomLevel).toHaveBeenCalledWith(0);
    });

    it('blocks keyboard zoom accelerators (Ctrl+=, Ctrl++, Ctrl+-, Ctrl+0) via before-input-event', () => {
      createTimerWindow();
      const beforeInputHandler = capturedWebContentsEvents['before-input-event'];
      expect(beforeInputHandler).toBeDefined();

      const zoomKeys = ['=', '+', '-', '_', '0', 'numpadadd', 'numpadsubtract'];
      for (const key of zoomKeys) {
        const preventDefault = vi.fn();
        beforeInputHandler({ preventDefault }, { type: 'keyDown', control: true, key });
        expect(preventDefault).toHaveBeenCalled();
      }

      // Normal keys must not be blocked
      const normalPreventDefault = vi.fn();
      beforeInputHandler({ preventDefault: normalPreventDefault }, { type: 'keyDown', control: false, key: 'a' });
      expect(normalPreventDefault).not.toHaveBeenCalled();
    });

    it('blocks zoom-changed event from altering zoom', () => {
      createTimerWindow();
      const zoomChangedHandler = capturedWebContentsEvents['zoom-changed'];
      expect(zoomChangedHandler).toBeDefined();

      const preventDefault = vi.fn();
      zoomChangedHandler({ preventDefault });
      expect(preventDefault).toHaveBeenCalled();
    });

    it('re-locks zoom limits and factors when did-finish-load fires', () => {
      createTimerWindow();
      const didFinishLoadHandler = capturedWebContentsEvents['did-finish-load'];
      expect(didFinishLoadHandler).toBeDefined();

      vi.clearAllMocks();
      didFinishLoadHandler();
      expect(mockSetVisualZoomLevelLimits).toHaveBeenCalledWith(1, 1);
      expect(mockSetZoomFactor).toHaveBeenCalledWith(1);
      expect(mockSetZoomLevel).toHaveBeenCalledWith(0);
    });
  });
});
