import { describe, it, expect, beforeEach, vi } from 'vitest';
import { focusQuickAdd, createMainWindow, hideMainWindow, showMainWindow } from '../../src/main/window/main-window.js';
import { IPC } from '../../src/shared/ipc-channels.js';

// Mock electron
const mockSend = vi.fn();
let isVisibleState = false;
let isDestroyedState = false;
let isMinimizedState = false;

const mockMainWindowInstance = {
  isDestroyed: () => isDestroyedState,
  isVisible: () => isVisibleState,
  isMinimized: () => isMinimizedState,
  restore: vi.fn(),
  show: vi.fn(() => {
    isVisibleState = true;
  }),
  focus: vi.fn(),
  hide: vi.fn(() => {
    isVisibleState = false;
  }),
  moveTop: vi.fn(),
  webContents: {
    send: mockSend,
  },
  on: vi.fn(),
  loadFile: vi.fn(),
  loadURL: vi.fn(),
};

vi.mock('electron', () => {
  return {
    BrowserWindow: vi.fn().mockImplementation(() => mockMainWindowInstance),
  };
});

describe('Main Window & Quick Add Inbox Wakeup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isVisibleState = false;
    isDestroyedState = false;
    isMinimizedState = false;
  });

  it('navigates to inbox when triggered while window was hidden/background', () => {
    createMainWindow();
    // Simulate window hidden in background
    hideMainWindow();

    expect(isVisibleState).toBe(false);

    // Trigger focusQuickAdd (Ctrl+N)
    focusQuickAdd();

    // Must show window and send navigateToInbox: true
    expect(mockMainWindowInstance.show).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith(IPC.APP.FOCUS_QUICK_ADD, {
      navigateToInbox: true,
    });
  });

  it('does NOT navigate to inbox when triggered while window is already open and visible', () => {
    createMainWindow();
    showMainWindow();
    expect(isVisibleState).toBe(true);

    mockSend.mockClear();

    // Trigger focusQuickAdd while already visible
    focusQuickAdd();

    expect(mockSend).toHaveBeenCalledWith(IPC.APP.FOCUS_QUICK_ADD, {
      navigateToInbox: false,
    });
  });
});
