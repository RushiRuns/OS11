import { create } from 'zustand';
import {
  DEFAULT_SHORTCUTS,
  DEFAULT_SHORTCUTS_MAP,
  normalizeKeyCombo,
  matchesShortcut,
} from '@shared/constants/shortcuts.js';
import { settingsServiceAdapter } from '../services/settings-service-adapter.js';

export { matchesShortcut, normalizeKeyCombo, DEFAULT_SHORTCUTS, DEFAULT_SHORTCUTS_MAP };

export interface ShortcutConflict {
  actionId: string;
  label: string;
}

export interface ShortcutState {
  shortcuts: Record<string, string[]>;
  customOverrides: Record<string, string[]>;
  recordingActionId: string | null;
  isSuspended: boolean;

  // Actions
  loadShortcuts: () => Promise<void>;
  updateShortcut: (actionId: string, keys: string[]) => Promise<boolean>;
  resetShortcut: (actionId: string) => Promise<void>;
  resetAllToDefault: () => Promise<void>;
  isCustomized: (actionId: string) => boolean;
  findConflict: (actionId: string, keys: string[]) => ShortcutConflict | null;
  startRecording: (actionId: string) => void;
  stopRecording: () => void;
}

function areCombosEqual(a: string[], b: string[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const normA = normalizeKeyCombo(a).map((k) => k.toLowerCase());
  const normB = normalizeKeyCombo(b).map((k) => k.toLowerCase());
  return normA.every((val, index) => val === normB[index]);
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: { ...DEFAULT_SHORTCUTS_MAP },
  customOverrides: {},
  recordingActionId: null,
  isSuspended: false,

  loadShortcuts: async () => {
    try {
      const saved = await settingsServiceAdapter.get<Record<string, string[]>>(
        'custom_keyboard_shortcuts',
        {}
      );
      if (saved && typeof saved === 'object') {
        const merged: Record<string, string[]> = { ...DEFAULT_SHORTCUTS_MAP };
        const validOverrides: Record<string, string[]> = {};

        for (const [actionId, keys] of Object.entries(saved)) {
          if (Array.isArray(keys) && keys.length > 0) {
            merged[actionId] = normalizeKeyCombo(keys);
            validOverrides[actionId] = normalizeKeyCombo(keys);
          }
        }

        set({
          shortcuts: merged,
          customOverrides: validOverrides,
        });
      }
    } catch {
      // Fallback to defaults in offline/test environments
    }
  },

  updateShortcut: async (actionId: string, rawKeys: string[]) => {
    const normalized = normalizeKeyCombo(rawKeys);
    if (normalized.length === 0) return false;

    // Check conflict
    const conflict = get().findConflict(actionId, normalized);
    if (conflict) {
      return false; // Disallow saving on conflict
    }

    const defaultKeys = DEFAULT_SHORTCUTS_MAP[actionId] || [];
    const isBackToDefault = areCombosEqual(normalized, defaultKeys);

    const updatedOverrides = { ...get().customOverrides };
    if (isBackToDefault) {
      delete updatedOverrides[actionId];
    } else {
      updatedOverrides[actionId] = normalized;
    }

    const updatedShortcuts = {
      ...get().shortcuts,
      [actionId]: normalized,
    };

    set({
      shortcuts: updatedShortcuts,
      customOverrides: updatedOverrides,
      recordingActionId: null,
      isSuspended: false,
    });

    try {
      await settingsServiceAdapter.set('custom_keyboard_shortcuts', updatedOverrides);
    } catch {
      // Best-effort persistence
    }

    return true;
  },

  resetShortcut: async (actionId: string) => {
    const defaultKeys = DEFAULT_SHORTCUTS_MAP[actionId];
    if (!defaultKeys) return;

    const updatedOverrides = { ...get().customOverrides };
    delete updatedOverrides[actionId];

    const updatedShortcuts = {
      ...get().shortcuts,
      [actionId]: [...defaultKeys],
    };

    set({
      shortcuts: updatedShortcuts,
      customOverrides: updatedOverrides,
    });

    try {
      await settingsServiceAdapter.set('custom_keyboard_shortcuts', updatedOverrides);
    } catch {
      // Best-effort persistence
    }
  },

  resetAllToDefault: async () => {
    set({
      shortcuts: { ...DEFAULT_SHORTCUTS_MAP },
      customOverrides: {},
      recordingActionId: null,
      isSuspended: false,
    });

    try {
      await settingsServiceAdapter.set('custom_keyboard_shortcuts', {});
    } catch {
      // Best-effort persistence
    }
  },

  isCustomized: (actionId: string) => {
    const custom = get().customOverrides[actionId];
    if (!custom) return false;
    const defaultKeys = DEFAULT_SHORTCUTS_MAP[actionId] || [];
    return !areCombosEqual(custom, defaultKeys);
  },

  findConflict: (actionId: string, rawKeys: string[]) => {
    const targetNorm = normalizeKeyCombo(rawKeys);
    if (targetNorm.length === 0) return null;

    const { shortcuts } = get();
    for (const [otherId, keys] of Object.entries(shortcuts)) {
      if (otherId === actionId) continue;
      if (areCombosEqual(targetNorm, keys)) {
        const def = DEFAULT_SHORTCUTS.find((s) => s.id === otherId);
        return {
          actionId: otherId,
          label: def?.label || otherId,
        };
      }
    }

    return null;
  },

  startRecording: (actionId: string) => {
    set({
      recordingActionId: actionId,
      isSuspended: true,
    });
  },

  stopRecording: () => {
    set({
      recordingActionId: null,
      isSuspended: false,
    });
  },
}));

export default useShortcutStore;
