import type { IpcResult } from '@shared/types/index.js';
import type { IpcRendererEvent } from 'electron';

export async function invokeRaw<T>(channel: string, payload?: unknown): Promise<IpcResult<T>> {
  if (typeof window === 'undefined' || !window.electron?.invoke) {
    throw new Error(`IPC invoke unavailable for channel "${channel}" outside Electron environment.`);
  }
  return window.electron.invoke(channel, payload);
}

export async function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const result = await invokeRaw<T>(channel, payload);
  if (!result.ok) {
    throw new Error(result.error || `IPC request failed for channel "${channel}".`);
  }
  return result.data;
}

export function on(
  channel: string,
  handler: (event: IpcRendererEvent, ...args: unknown[]) => void
): () => void {
  if (typeof window === 'undefined' || !window.electron?.on) {
    return () => {};
  }
  return window.electron.on(channel, handler);
}

export const ipc = {
  invoke,
  invokeRaw,
  on,
};

export default ipc;
