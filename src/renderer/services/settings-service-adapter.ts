import { IPC } from '@shared/ipc-channels.js';
import type { SystemInfo } from '@shared/types/settings.js';
import { invoke } from './ipc.js';

export const settingsServiceAdapter = {
  getAll(): Promise<Record<string, unknown>> {
    return invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
  },

  get<T>(key: string, defaultValue: T): Promise<T> {
    return invoke<T>(IPC.SETTINGS.GET, { key, defaultValue });
  },

  set<T>(key: string, value: T): Promise<boolean> {
    return invoke<boolean>(IPC.SETTINGS.SET, { key, value });
  },

  getSystemInfo(): Promise<SystemInfo> {
    return invoke<SystemInfo>(IPC.SYSTEM.GET_INFO);
  },

  minimize(): Promise<void> {
    return invoke<void>(IPC.SYSTEM.MINIMIZE);
  },

  maximize(): Promise<void> {
    return invoke<void>(IPC.SYSTEM.MAXIMIZE);
  },

  close(): Promise<void> {
    return invoke<void>(IPC.SYSTEM.CLOSE);
  },
};
