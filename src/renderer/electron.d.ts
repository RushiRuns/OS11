import type { IpcRendererEvent } from 'electron';

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      on: (
        channel: string,
        listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
      ) => () => void;
    };
  }
}

export {};
