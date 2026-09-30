import { describe, it, expect, vi } from 'vitest';
import {
  isDevToolsShortcut,
  toggleDevTools,
  openDevTools,
  buildDevToolsContextMenuTemplate,
  setupDevToolsForWindow,
} from '../../src/main/devtools.js';
import { IPC } from '../../src/shared/ipc-channels.js';

describe('Developer Tools Universal Access', () => {
  describe('isDevToolsShortcut Keyboard Detection', () => {
    it('detects F12 key on Windows/Linux and Mac', () => {
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'F12' }, false)).toBe(true);
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'F12' }, true)).toBe(true);
    });

    it('detects Ctrl+Shift+I on Windows and Linux', () => {
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'I', control: true, shift: true },
          false
        )
      ).toBe(true);
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'i', control: true, shift: true },
          false
        )
      ).toBe(true);
    });

    it('detects Ctrl+Shift+C (Inspect Element shortcut) on Windows and Linux', () => {
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'C', control: true, shift: true },
          false
        )
      ).toBe(true);
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'c', control: true, shift: true },
          false
        )
      ).toBe(true);
    });

    it('detects Cmd+Alt+I on macOS', () => {
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'i', meta: true, alt: true },
          true
        )
      ).toBe(true);
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'I', meta: true, alt: true },
          true
        )
      ).toBe(true);
    });

    it('detects Cmd+Alt+C on macOS', () => {
      expect(
        isDevToolsShortcut(
          { type: 'keyDown', key: 'c', meta: true, alt: true },
          true
        )
      ).toBe(true);
    });

    it('rejects unrelated key events', () => {
      expect(isDevToolsShortcut({ type: 'keyUp', key: 'F12' })).toBe(false);
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'F11' })).toBe(false);
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'i', control: true })).toBe(false);
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'c', control: true })).toBe(false);
      expect(isDevToolsShortcut({ type: 'keyDown', key: 'k', control: true })).toBe(false);
    });
  });

  describe('toggleDevTools and openDevTools', () => {
    it('opens DevTools in detached mode if currently closed', () => {
      let openedWithMode: unknown = null;
      let closed = false;

      const mockWin = {
        isDestroyed: () => false,
        webContents: {
          isDevToolsOpened: () => false,
          openDevTools: (options?: { mode: string }) => {
            openedWithMode = options?.mode;
          },
          closeDevTools: () => {
            closed = true;
          },
        },
      } as any;

      toggleDevTools(mockWin);
      expect(openedWithMode).toBe('detach');
      expect(closed).toBe(false);
    });

    it('closes DevTools if currently open', () => {
      let opened = false;
      let closed = false;

      const mockWin = {
        isDestroyed: () => false,
        webContents: {
          isDevToolsOpened: () => true,
          openDevTools: () => {
            opened = true;
          },
          closeDevTools: () => {
            closed = true;
          },
        },
      } as any;

      toggleDevTools(mockWin);
      expect(closed).toBe(true);
      expect(opened).toBe(false);
    });

    it('openDevTools opens in detached mode unconditionally', () => {
      let openedMode: unknown = null;

      const mockWin = {
        isDestroyed: () => false,
        webContents: {
          openDevTools: (options?: { mode: string }) => {
            openedMode = options?.mode;
          },
        },
      } as any;

      openDevTools(mockWin);
      expect(openedMode).toBe('detach');
    });

    it('gracefully handles null or destroyed windows', () => {
      expect(() => toggleDevTools(null as any)).not.toThrow();
      expect(() => openDevTools(null as any)).not.toThrow();

      const destroyedWin = {
        isDestroyed: () => true,
        webContents: null,
      } as any;
      expect(() => toggleDevTools(destroyedWin)).not.toThrow();
      expect(() => openDevTools(destroyedWin)).not.toThrow();
    });
  });

  describe('Context Menu Template', () => {
    it('builds context menu items with Inspect Element, Toggle DevTools, and Reload', () => {
      const mockWin = {
        isDestroyed: () => false,
        webContents: {
          isDevToolsOpened: () => false,
          openDevTools: vi.fn(),
          closeDevTools: vi.fn(),
          inspectElement: vi.fn(),
          reload: vi.fn(),
          once: vi.fn(),
        },
      } as any;

      const template = buildDevToolsContextMenuTemplate(mockWin, { x: 100, y: 200 });
      expect(template.length).toBeGreaterThanOrEqual(3);

      const labels = template.map((i) => i.label || '');
      expect(labels.includes('Inspect Element')).toBe(true);
      expect(labels.includes('Toggle Developer Tools')).toBe(true);
      expect(labels.includes('Reload')).toBe(true);

      // Verify Inspect Element click behavior
      const inspectItem = template.find((i) => i.label === 'Inspect Element');
      inspectItem?.click?.(null as any, null as any, null as any);
      expect(mockWin.webContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });

      // Verify Reload click behavior
      const reloadItem = template.find((i) => i.label === 'Reload');
      reloadItem?.click?.(null as any, null as any, null as any);
      expect(mockWin.webContents.reload).toHaveBeenCalled();
    });
  });

  describe('Window Event Listener Attachment', () => {
    it('intercepts before-input-event and toggles dev tools on shortcut press', () => {
      const listeners: Record<string, Function> = {};
      let devToolsOpened = false;

      const mockWin = {
        isDestroyed: () => false,
        webContents: {
          on: (event: string, callback: Function) => {
            listeners[event] = callback;
          },
          isDevToolsOpened: () => devToolsOpened,
          openDevTools: () => {
            devToolsOpened = true;
          },
          closeDevTools: () => {
            devToolsOpened = false;
          },
        },
      } as any;

      setupDevToolsForWindow(mockWin);

      expect(typeof listeners['before-input-event']).toBe('function');
      expect(typeof listeners['context-menu']).toBe('function');

      // Simulate F12 press
      let defaultPrevented = false;
      listeners['before-input-event'](
        {
          preventDefault: () => {
            defaultPrevented = true;
          },
        },
        { type: 'keyDown', key: 'F12' }
      );

      expect(defaultPrevented).toBe(true);
      expect(devToolsOpened).toBe(true);
    });
  });

  describe('IPC Channels Definition', () => {
    it('defines TOGGLE_DEV_TOOLS and OPEN_DEV_TOOLS channels', () => {
      expect(IPC.APP.TOGGLE_DEV_TOOLS).toBe('app:toggle-dev-tools');
      expect(IPC.APP.OPEN_DEV_TOOLS).toBe('app:open-dev-tools');
    });
  });
});
