import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import {
  useShortcutStore,
  matchesShortcut,
  normalizeKeyCombo,
} from '../../src/renderer/stores/shortcutStore.js';

vi.mock('../../src/renderer/services/ipc.js', () => ({
  invoke: vi.fn().mockResolvedValue({ ok: true, data: true }),
  ipc: {
    invoke: vi.fn().mockResolvedValue({ ok: true, data: true }),
    on: vi.fn().mockReturnValue(() => {}),
  },
}));

if (typeof KeyboardEvent === 'undefined') {
  // Polyfill for Node.js test environment
  (globalThis as unknown as { KeyboardEvent: unknown }).KeyboardEvent = class KeyboardEvent {
    key: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    constructor(_type: string, init: KeyboardEventInit = {}) {
      this.key = init.key || '';
      this.ctrlKey = init.ctrlKey || false;
      this.shiftKey = init.shiftKey || false;
      this.altKey = init.altKey || false;
      this.metaKey = init.metaKey || false;
    }
  };
}

describe('Custom Keyboard Shortcuts Feature', () => {
  beforeEach(() => {
    act(() => {
      useShortcutStore.getState().resetAllToDefault();
    });
  });

  describe('Store & Customization', () => {
    it('initializes with standard default shortcuts', () => {
      const shortcuts = useShortcutStore.getState().shortcuts;
      expect(shortcuts['command_palette']).toEqual(['Ctrl', 'K']);
      expect(shortcuts['toggle_focus_mode']).toEqual(['Ctrl', 'Shift', 'F']);
    });

    it('updates a shortcut mapping and flags it as customized', () => {
      act(() => {
        useShortcutStore.getState().updateShortcut('command_palette', ['Ctrl', 'P']);
      });

      const updated = useShortcutStore.getState().shortcuts['command_palette'];
      expect(updated).toEqual(['Ctrl', 'P']);
      expect(useShortcutStore.getState().isCustomized('command_palette')).toBe(true);
    });

    it('resets a single shortcut back to default', () => {
      act(() => {
        useShortcutStore.getState().updateShortcut('command_palette', ['Ctrl', 'P']);
        useShortcutStore.getState().resetShortcut('command_palette');
      });

      expect(useShortcutStore.getState().shortcuts['command_palette']).toEqual(['Ctrl', 'K']);
      expect(useShortcutStore.getState().isCustomized('command_palette')).toBe(false);
    });

    it('resets all shortcuts back to default in batch', () => {
      act(() => {
        useShortcutStore.getState().updateShortcut('command_palette', ['Ctrl', 'P']);
        useShortcutStore.getState().updateShortcut('toggle_theme', ['Ctrl', 'Alt', 'T']);
        useShortcutStore.getState().resetAllToDefault();
      });

      expect(useShortcutStore.getState().shortcuts['command_palette']).toEqual(['Ctrl', 'K']);
      expect(useShortcutStore.getState().shortcuts['toggle_theme']).toEqual(['Ctrl', 'Shift', 'T']);
    });
  });

  describe('Conflict Detection', () => {
    it('detects when a combination is already assigned to another action', () => {
      const conflict = useShortcutStore.getState().findConflict('toggle_theme', ['Ctrl', 'K']);
      expect(conflict).toBeDefined();
      expect(conflict?.actionId).toBe('command_palette');
    });

    it('returns null when combination is unique and free', () => {
      const conflict = useShortcutStore.getState().findConflict('toggle_theme', ['Ctrl', 'Alt', 'F10']);
      expect(conflict).toBeNull();
    });
  });

  describe('Runtime Matching Engine', () => {
    it('correctly matches incoming KeyboardEvent to customized combination', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true });
      const combo = ['Ctrl', 'P'];
      expect(matchesShortcut(event, combo)).toBe(true);
    });

    it('ignores event when modifiers do not match', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: false });
      const combo = ['Ctrl', 'P'];
      expect(matchesShortcut(event, combo)).toBe(false);
    });

    it('normalizes key combinations into standard modifier order', () => {
      const normalized = normalizeKeyCombo(['K', 'Shift', 'Ctrl']);
      expect(normalized).toEqual(['Ctrl', 'Shift', 'K']);
    });
  });
});
