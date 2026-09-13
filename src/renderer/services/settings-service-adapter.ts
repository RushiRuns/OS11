import { IPC } from '@shared/ipc-channels.js';
import type { IpcResult } from '@shared/types/ipc.js';
import type { SystemInfo } from '@shared/types/settings.js';

export const settingsServiceAdapter = {
  async getAll(): Promise<Record<string, unknown>> {
    const result: IpcResult<Record<string, unknown>> = await window.electron.invoke(IPC.SETTINGS.GET_ALL);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const result: IpcResult<T> = await window.electron.invoke(IPC.SETTINGS.GET, { key, defaultValue });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async set<T>(key: string, value: T): Promise<boolean> {
    const result: IpcResult<boolean> = await window.electron.invoke(IPC.SETTINGS.SET, { key, value });
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const result: IpcResult<SystemInfo> = await window.electron.invoke(IPC.SYSTEM.GET_INFO);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async minimize(): Promise<void> {
    await window.electron.invoke(IPC.SYSTEM.MINIMIZE);
  },

  async maximize(): Promise<void> {
    await window.electron.invoke(IPC.SYSTEM.MAXIMIZE);
  },

  async close(): Promise<void> {
    await window.electron.invoke(IPC.SYSTEM.CLOSE);
  },
};
