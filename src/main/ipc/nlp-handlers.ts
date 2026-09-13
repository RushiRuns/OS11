import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc-channels.js';
import { parseQuickAdd } from '../domain/nlp.js';

export function registerNlpHandlers(): void {
  ipcMain.handle(IPC.NLP.PARSE, async (_event, text: string) => {
    try {
      const parsed = parseQuickAdd(text || '');
      return { ok: true, data: parsed };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export default registerNlpHandlers;
