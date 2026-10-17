import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels.js';
import { ObjectiveRepository } from '../repositories/ObjectiveRepository.js';
import type {
  CreateObjectivePayload,
  UpdateObjectivePayload,
  ObjectiveUndoSnapshot,
} from '../../shared/types/Objective.js';
import type {
  CreateKeyResultPayload,
  UpdateKeyResultPayload,
  CheckInEntryPayload,
  CheckInUndoState,
} from '../../shared/types/KeyResult.js';

export function registerOkrHandlers(repo = new ObjectiveRepository()): void {
  ipcMain.handle(IPC.OKR.LOAD_ALL, async () => {
    try {
      const data = repo.loadAll();
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.OKR.CREATE_OBJECTIVE, async (_event, payload: CreateObjectivePayload) => {
    try {
      const data = repo.createObjective(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.OKR.UPDATE_OBJECTIVE,
    async (_event, { id, fields }: { id: string; fields: UpdateObjectivePayload }) => {
      try {
        const data = repo.updateObjective(id, fields);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.OKR.DELETE_OBJECTIVE, async (_event, id: string) => {
    try {
      const data = repo.deleteObjective(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.OKR.RESTORE_OBJECTIVE, async (_event, snapshot: ObjectiveUndoSnapshot) => {
    try {
      const data = repo.restoreObjective(snapshot);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(IPC.OKR.CREATE_KEY_RESULT, async (_event, payload: CreateKeyResultPayload) => {
    try {
      const data = repo.createKeyResult(payload);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.OKR.UPDATE_KEY_RESULT,
    async (_event, { id, fields }: { id: string; fields: UpdateKeyResultPayload }) => {
      try {
        const data = repo.updateKeyResult(id, fields);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.OKR.DELETE_KEY_RESULT, async (_event, id: string) => {
    try {
      const data = repo.deleteKeyResult(id);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.OKR.RECORD_CHECK_INS,
    async (
      _event,
      { entries, effectiveToday }: { entries: CheckInEntryPayload[]; effectiveToday?: string }
    ) => {
      try {
        const data = repo.recordCheckIns(entries, effectiveToday);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(IPC.OKR.UNDO_CHECK_INS, async (_event, snapshot: CheckInUndoState) => {
    try {
      const data = repo.undoCheckIns(snapshot);
      return { ok: true, data };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    IPC.OKR.TOGGLE_HABIT_LOG,
    async (_event, { keyResultId, logDate }: { keyResultId: string; logDate: string }) => {
      try {
        const data = repo.toggleHabitLog(keyResultId, logDate);
        return { ok: true, data };
      } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}
