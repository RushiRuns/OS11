import { create } from 'zustand';
import { IPC } from '@shared/ipc-channels.js';
import type { Module, ModuleName } from '@shared/types/Module.js';
import { invoke } from '../services/ipc.js';

import { PRESET_MODULE_MAP, type ProfilePreset } from '@shared/constants/presets.js';
export type { ProfilePreset };

interface ModuleState {
  modulesByName: Record<string, boolean>;
  activePreset: ProfilePreset;
  isLoading: boolean;
  loadModules: () => Promise<void>;
  isEnabled: (moduleName: ModuleName | string) => boolean;
  toggleModule: (moduleName: ModuleName | string, enabled: boolean) => Promise<void>;
  applyPreset: (preset: ProfilePreset) => Promise<void>;
}

// Default states matching 0001_initial_schema.sql
const DEFAULT_MODULES: Record<string, boolean> = {
  my_day: true,
  project_management: true,
  pomodoro: true,
  agenda: true,
  goals_habits: true,
  dashboard: true,
  file_attachments: true,
  nlp_parsing: true,
  sound_effects: true,
  anytime: true,
  someday: true,
  waiting_for: true,
  vim_keybindings: false,
  habit_tracker: false,
  collaboration: false,
  companion_sync: false,
  calendar_integration: false,
};

export const useModuleStore = create<ModuleState>((set, get) => ({
  modulesByName: { ...DEFAULT_MODULES },
  activePreset: 'custom',
  isLoading: false,

  loadModules: async () => {
    set({ isLoading: true });
    try {
      const list = await invoke<Module[]>(IPC.MODULES.GET_ALL);
      if (Array.isArray(list)) {
        const map: Record<string, boolean> = { ...DEFAULT_MODULES };
        for (const m of list) {
          map[m.module_name] = m.is_enabled === 1;
        }
        set({ modulesByName: map, isLoading: false });
        return;
      }
    } catch {
      // Fall back to defaults on failure
    }
    set({ isLoading: false });
  },

  isEnabled: (moduleName: string): boolean => {
    const modules = get().modulesByName;
    return modules[moduleName] ?? false;
  },

  toggleModule: async (moduleName: string, enabled: boolean) => {
    set((state) => ({
      activePreset: 'custom',
      modulesByName: {
        ...state.modulesByName,
        [moduleName]: enabled,
      },
    }));

    try {
      await invoke<boolean>(IPC.MODULES.TOGGLE, { moduleName, enabled });
    } catch (err) {
      // Rollback on failure
      set((state) => ({
        modulesByName: {
          ...state.modulesByName,
          [moduleName]: !enabled,
        },
      }));
      throw err;
    }
  },

  applyPreset: async (preset: ProfilePreset) => {
    if (preset === 'custom') {
      set({ activePreset: 'custom' });
      return;
    }

    const current = { ...get().modulesByName };
    const next: Record<string, boolean> = {};
    for (const key of Object.keys(current)) {
      next[key] = false;
    }

    const enabledList = PRESET_MODULE_MAP[preset] ?? [];
    for (const mod of enabledList) {
      next[mod] = true;
    }

    // Always keep sound effects on unless disabled manually
    next.sound_effects = current.sound_effects ?? true;

    set({ modulesByName: next, activePreset: preset });

    try {
      await invoke<Module[]>(IPC.MODULES.APPLY_PRESET, { preset });
    } catch {
      // Fallback
    }
  },
}));

export default useModuleStore;
