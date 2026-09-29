import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerGlobalShortcuts } from '../../src/main/shortcuts.js';
import { getMainWindow } from '../../src/main/window/main-window.js';
import { showQuickAddModalWindow } from '../../src/main/window/quickadd-modal-window.js';
import { globalShortcut } from 'electron';

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn(),
    unregisterAll: vi.fn(),
  },
}));

vi.mock('../../src/main/window/main-window.js', () => ({
  showMainWindow: vi.fn(),
  toggleMainWindow: vi.fn(),
  focusQuickAdd: vi.fn(),
  getMainWindow: vi.fn(),
  setAlwaysOnTop: vi.fn(),
}));

vi.mock('../../src/main/window/omnibar-window.js', () => ({
  toggleOmnibarWindow: vi.fn(),
}));

vi.mock('../../src/main/window/quickadd-modal-window.js', () => ({
  showQuickAddModalWindow: vi.fn(),
}));

describe('Global Shortcuts: Ctrl+N Background vs Open Routing', () => {
  let registeredCallbacks: Record<string, () => void> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    registeredCallbacks = {};

    vi.mocked(globalShortcut.register).mockImplementation((accelerator, callback) => {
      registeredCallbacks[accelerator] = callback;
      return true;
    });

    registerGlobalShortcuts();
  });

  it('registers CommandOrControl+N shortcut handler', () => {
    expect(registeredCallbacks['CommandOrControl+N']).toBeDefined();
  });

  it('opens floating Quick Add modal when main window is hidden or closed to background', async () => {
    // Window is hidden in background
    vi.mocked(getMainWindow).mockReturnValue({
      isDestroyed: () => false,
      isVisible: () => false,
    } as any);

    const handler = registeredCallbacks['CommandOrControl+N'];
    handler();

    expect(showQuickAddModalWindow).toHaveBeenCalled();
  });

  it('focuses quick-add in main window when main window is already visible', async () => {
    const { focusQuickAdd } = await import('../../src/main/window/main-window.js');

    vi.mocked(getMainWindow).mockReturnValue({
      isDestroyed: () => false,
      isVisible: () => true,
    } as any);

    const handler = registeredCallbacks['CommandOrControl+N'];
    handler();

    expect(focusQuickAdd).toHaveBeenCalled();
    expect(showQuickAddModalWindow).not.toHaveBeenCalled();
  });
});
