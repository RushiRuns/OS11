import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Preload Script: Strict Architecture Boundary
 * Exposes ONLY window.electron.invoke() and window.electron.on()
 * per ARCHITECTURE.md line 181. No other Node APIs leak into the renderer.
 */
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
