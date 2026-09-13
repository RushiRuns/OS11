import { globalShortcut } from 'electron';
import {
  showMainWindow,
  toggleMainWindow,
  focusQuickAdd,
  getMainWindow,
  setAlwaysOnTop,
} from './window/main-window.js';
import { toggleOmnibarWindow } from './window/omnibar-window.js';

export function registerGlobalShortcuts(): void {
  try {
    // 1. Show & Focus Main Window: Ctrl+Shift+Space / Cmd+Shift+Space
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      showMainWindow();
    });

    // 2. Omnibar Quick Capture: Ctrl+Space / Cmd+Space
    globalShortcut.register('CommandOrControl+Space', () => {
      toggleOmnibarWindow();
    });

    // 3. Quick-Add in Main Window: Ctrl+N / Cmd+N
    globalShortcut.register('CommandOrControl+N', () => {
      focusQuickAdd();
    });

    // 4. Toggle App Visibility: Ctrl+Shift+H / Cmd+Shift+H
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      toggleMainWindow();
    });

    // 5. Toggle Always on Top: Ctrl+Shift+T / Cmd+Shift+T
    globalShortcut.register('CommandOrControl+Shift+T', () => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        const nextState = !win.isAlwaysOnTop();
        setAlwaysOnTop(nextState);
      }
    });

    console.log('[OS11 Shortcuts] Global shortcuts registered successfully.');
  } catch (err) {
    console.warn('[OS11 Shortcuts] Failed to register some global shortcuts:', err);
  }
}

export function unregisterGlobalShortcuts(): void {
  try {
    globalShortcut.unregisterAll();
    console.log('[OS11 Shortcuts] All global shortcuts unregistered.');
  } catch (err) {
    console.warn('[OS11 Shortcuts] Error unregistering global shortcuts:', err);
  }
}
