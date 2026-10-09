import { globalShortcut } from 'electron';
import {
  showMainWindow,
  toggleMainWindow,
  focusQuickAdd,
  getMainWindow,
  setAlwaysOnTop,
} from './window/main-window.js';
import { toggleOmnibarWindow } from './window/omnibar-window.js';
import { showQuickAddModalWindow } from './window/quickadd-modal-window.js';
import { SettingsRepository } from './repositories/SettingsRepository.js';
import { toElectronAccelerator } from '@shared/constants/shortcuts.js';

export function registerGlobalShortcuts(): void {
  try {
    globalShortcut.unregisterAll();

    let customShortcuts: Record<string, string[]> = {};
    try {
      const repo = new SettingsRepository();
      customShortcuts = repo.get<Record<string, string[]>>('custom_keyboard_shortcuts', {}) || {};
    } catch {
      // Fallback
    }

    const getAccelerator = (actionId: string, defaultCombo: string[]) => {
      const combo = customShortcuts[actionId] || defaultCombo;
      return toElectronAccelerator(combo);
    };

    // 1. Show & Focus Main Window: default Ctrl+Shift+Space
    const showAppAcc = getAccelerator('global_show_app', ['Ctrl', 'Shift', 'Space']);
    if (showAppAcc) {
      globalShortcut.register(showAppAcc, () => {
        showMainWindow();
      });
    }

    // 2. Omnibar Quick Capture: default Ctrl+Space
    const omnibarAcc = getAccelerator('quick_capture_omnibar', ['Ctrl', 'Space']);
    if (omnibarAcc) {
      globalShortcut.register(omnibarAcc, () => {
        toggleOmnibarWindow();
      });
    }

    // 3. Quick-Add: default Ctrl+N
    const quickAddAcc = getAccelerator('quick_add_modal', ['Ctrl', 'N']);
    if (quickAddAcc) {
      globalShortcut.register(quickAddAcc, () => {
        const mainWin = getMainWindow();
        if (!mainWin || mainWin.isDestroyed() || !mainWin.isVisible()) {
          showQuickAddModalWindow();
        } else {
          focusQuickAdd();
        }
      });
    }

    // 4. Toggle App Visibility: default Ctrl+Shift+H
    const toggleAppAcc = getAccelerator('global_toggle_app', ['Ctrl', 'Shift', 'H']);
    if (toggleAppAcc) {
      globalShortcut.register(toggleAppAcc, () => {
        toggleMainWindow();
      });
    }

    // 5. Toggle Always on Top: default Ctrl+Shift+T
    const alwaysOnTopAcc = getAccelerator('global_always_on_top', ['Ctrl', 'Shift', 'T']);
    if (alwaysOnTopAcc) {
      globalShortcut.register(alwaysOnTopAcc, () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          const nextState = !win.isAlwaysOnTop();
          setAlwaysOnTop(nextState);
        }
      });
    }

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
