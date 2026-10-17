import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type {
  Objective,
  CreateObjectivePayload,
  UpdateObjectivePayload,
  ObjectiveDeleteResult,
  ObjectiveRestoreResult,
  ObjectiveUndoSnapshot,
} from '@shared/types/Objective.js';
import type {
  KeyResult,
  KRCheckIn,
  KRHabitLog,
  CreateKeyResultPayload,
  UpdateKeyResultPayload,
  CheckInEntryPayload,
  CheckInUndoState,
  KeyResultDeleteResult,
} from '@shared/types/KeyResult.js';
import { useTaskStore } from './taskStore.js';
import { useProjectStore } from './projectStore.js';
import { useUndoRedoStore } from '../hooks/useUndoRedo.js';

export interface OkrState {
  objectivesById: Record<string, Objective>;
  keyResultsById: Record<string, KeyResult>;
  checkInsByKeyResultId: Record<string, KRCheckIn[]>;
  habitLogsByKeyResultId: Record<string, KRHabitLog[]>;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  createObjective: (payload: CreateObjectivePayload) => Promise<Objective>;
  updateObjective: (id: string, payload: UpdateObjectivePayload) => Promise<Objective>;
  deleteObjective: (id: string) => Promise<void>;
  restoreObjective: (snapshot: ObjectiveUndoSnapshot) => Promise<void>;

  createKeyResult: (payload: CreateKeyResultPayload) => Promise<KeyResult>;
  updateKeyResult: (id: string, payload: UpdateKeyResultPayload) => Promise<KeyResult>;
  deleteKeyResult: (id: string) => Promise<void>;

  recordCheckIns: (entries: CheckInEntryPayload[], effectiveToday?: string) => Promise<void>;
  undoCheckIns: (snapshot: CheckInUndoState) => Promise<void>;
  toggleHabitLog: (keyResultId: string, logDate: string) => Promise<void>;
}

export const useOkrStore = create<OkrState>((set, get) => ({
  objectivesById: {},
  keyResultsById: {},
  checkInsByKeyResultId: {},
  habitLogsByKeyResultId: {},
  loaded: false,
  loading: false,
  error: null,

  loadAll: async () => {
    const { loaded, loading } = get();
    if (loaded || loading) return;
    set({ loading: true, error: null });
    try {
      const data = await ipc.invoke<{
        objectives: Objective[];
        keyResults: KeyResult[];
        checkIns: KRCheckIn[];
        habitLogs: KRHabitLog[];
      }>(IPC.OKR.LOAD_ALL);

      const objectivesById: Record<string, Objective> = {};
      for (const obj of data.objectives) {
        objectivesById[obj.id] = obj;
      }

      const keyResultsById: Record<string, KeyResult> = {};
      for (const kr of data.keyResults) {
        keyResultsById[kr.id] = kr;
      }

      const checkInsByKeyResultId: Record<string, KRCheckIn[]> = {};
      for (const ci of data.checkIns) {
        const arr = checkInsByKeyResultId[ci.key_result_id] || [];
        arr.push(ci);
        checkInsByKeyResultId[ci.key_result_id] = arr;
      }

      const habitLogsByKeyResultId: Record<string, KRHabitLog[]> = {};
      for (const hl of data.habitLogs) {
        const arr = habitLogsByKeyResultId[hl.key_result_id] || [];
        arr.push(hl);
        habitLogsByKeyResultId[hl.key_result_id] = arr;
      }

      set({
        objectivesById,
        keyResultsById,
        checkInsByKeyResultId,
        habitLogsByKeyResultId,
        loaded: true,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  createObjective: async (payload) => {
    const created = await ipc.invoke<Objective>(IPC.OKR.CREATE_OBJECTIVE, payload);
    set((state) => ({
      objectivesById: { ...state.objectivesById, [created.id]: created },
    }));
    return created;
  },

  updateObjective: async (id, fields) => {
    const updated = await ipc.invoke<Objective>(IPC.OKR.UPDATE_OBJECTIVE, { id, fields });
    set((state) => ({
      objectivesById: { ...state.objectivesById, [id]: updated },
    }));
    return updated;
  },

  deleteObjective: async (id) => {
    const obj = get().objectivesById[id];
    const res = await ipc.invoke<ObjectiveDeleteResult>(IPC.OKR.DELETE_OBJECTIVE, id);

    set((state) => {
      const nextObjectives = { ...state.objectivesById };
      delete nextObjectives[id];

      const nextKeyResults = { ...state.keyResultsById };
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      const nextHabitLogs = { ...state.habitLogsByKeyResultId };

      for (const kr of res.snapshot.keyResults) {
        delete nextKeyResults[kr.id];
        delete nextCheckIns[kr.id];
        delete nextHabitLogs[kr.id];
      }

      return {
        objectivesById: nextObjectives,
        keyResultsById: nextKeyResults,
        checkInsByKeyResultId: nextCheckIns,
        habitLogsByKeyResultId: nextHabitLogs,
      };
    });

    if (res.clearedTaskIds.length > 0) {
      useTaskStore.setState((state) => {
        const nextTasks = { ...state.tasksById };
        for (const tid of res.clearedTaskIds) {
          if (nextTasks[tid]) {
            nextTasks[tid] = { ...nextTasks[tid], key_result_id: null };
          }
        }
        return { tasksById: nextTasks };
      });
    }

    if (res.clearedProjectIds.length > 0) {
      useProjectStore.setState((state) => {
        const nextProjects = { ...state.projectsById };
        for (const pid of res.clearedProjectIds) {
          if (nextProjects[pid]) {
            nextProjects[pid] = { ...nextProjects[pid], key_result_id: null };
          }
        }
        return { projectsById: nextProjects };
      });
    }

    useUndoRedoStore.getState().pushAction({
      description: `Deleted goal "${obj?.title || 'Goal'}"`,
      undoFn: async () => {
        await get().restoreObjective(res.snapshot);
      },
      redoFn: async () => {
        await get().deleteObjective(id);
      },
      showToast: true,
    });
  },

  restoreObjective: async (snapshot) => {
    const res = await ipc.invoke<ObjectiveRestoreResult>(IPC.OKR.RESTORE_OBJECTIVE, snapshot);

    set((state) => {
      const nextObjectives = { ...state.objectivesById, [snapshot.objective.id]: snapshot.objective };
      const nextKeyResults = { ...state.keyResultsById };
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      const nextHabitLogs = { ...state.habitLogsByKeyResultId };

      for (const kr of snapshot.keyResults) {
        nextKeyResults[kr.id] = kr;
      }
      for (const ci of snapshot.checkIns) {
        const list = nextCheckIns[ci.key_result_id] || [];
        nextCheckIns[ci.key_result_id] = [...list, ci];
      }
      for (const hl of snapshot.habitLogs) {
        const list = nextHabitLogs[hl.key_result_id] || [];
        nextHabitLogs[hl.key_result_id] = [...list, hl];
      }

      return {
        objectivesById: nextObjectives,
        keyResultsById: nextKeyResults,
        checkInsByKeyResultId: nextCheckIns,
        habitLogsByKeyResultId: nextHabitLogs,
      };
    });

    if (res.taskLinks.length > 0) {
      useTaskStore.setState((state) => {
        const nextTasks = { ...state.tasksById };
        for (const link of res.taskLinks) {
          if (nextTasks[link.resourceId]) {
            nextTasks[link.resourceId] = {
              ...nextTasks[link.resourceId],
              key_result_id: link.keyResultId,
            };
          }
        }
        return { tasksById: nextTasks };
      });
    }

    if (res.projectLinks.length > 0) {
      useProjectStore.setState((state) => {
        const nextProjects = { ...state.projectsById };
        for (const link of res.projectLinks) {
          if (nextProjects[link.resourceId]) {
            nextProjects[link.resourceId] = {
              ...nextProjects[link.resourceId],
              key_result_id: link.keyResultId,
            };
          }
        }
        return { projectsById: nextProjects };
      });
    }
  },

  createKeyResult: async (payload) => {
    const created = await ipc.invoke<KeyResult>(IPC.OKR.CREATE_KEY_RESULT, payload);
    set((state) => ({
      keyResultsById: { ...state.keyResultsById, [created.id]: created },
    }));
    return created;
  },

  updateKeyResult: async (id, fields) => {
    const updated = await ipc.invoke<KeyResult>(IPC.OKR.UPDATE_KEY_RESULT, { id, fields });
    set((state) => {
      const nextKRs = { ...state.keyResultsById, [id]: updated };
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      const nextHabitLogs = { ...state.habitLogsByKeyResultId };
      if (fields.resetHistory) {
        delete nextCheckIns[id];
        delete nextHabitLogs[id];
      }
      return {
        keyResultsById: nextKRs,
        checkInsByKeyResultId: nextCheckIns,
        habitLogsByKeyResultId: nextHabitLogs,
      };
    });
    return updated;
  },

  deleteKeyResult: async (id) => {
    const res = await ipc.invoke<KeyResultDeleteResult>(IPC.OKR.DELETE_KEY_RESULT, id);
    set((state) => {
      const nextKeyResults = { ...state.keyResultsById };
      delete nextKeyResults[id];
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      delete nextCheckIns[id];
      const nextHabitLogs = { ...state.habitLogsByKeyResultId };
      delete nextHabitLogs[id];
      return {
        keyResultsById: nextKeyResults,
        checkInsByKeyResultId: nextCheckIns,
        habitLogsByKeyResultId: nextHabitLogs,
      };
    });

    if (res.clearedTaskIds.length > 0) {
      useTaskStore.setState((state) => {
        const nextTasks = { ...state.tasksById };
        for (const tid of res.clearedTaskIds) {
          if (nextTasks[tid]) {
            nextTasks[tid] = { ...nextTasks[tid], key_result_id: null };
          }
        }
        return { tasksById: nextTasks };
      });
    }

    if (res.clearedProjectIds.length > 0) {
      useProjectStore.setState((state) => {
        const nextProjects = { ...state.projectsById };
        for (const pid of res.clearedProjectIds) {
          if (nextProjects[pid]) {
            nextProjects[pid] = { ...nextProjects[pid], key_result_id: null };
          }
        }
        return { projectsById: nextProjects };
      });
    }
  },

  recordCheckIns: async (entries, effectiveToday) => {
    const res = await ipc.invoke<{
      checkIns: KRCheckIn[];
      undoState: CheckInUndoState;
      updatedKeyResults: KeyResult[];
    }>(IPC.OKR.RECORD_CHECK_INS, { entries, effectiveToday });

    set((state) => {
      const nextKRs = { ...state.keyResultsById };
      for (const kr of res.updatedKeyResults) {
        nextKRs[kr.id] = kr;
      }
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      for (const ci of res.checkIns) {
        const list = nextCheckIns[ci.key_result_id] || [];
        nextCheckIns[ci.key_result_id] = [ci, ...list];
      }
      return {
        keyResultsById: nextKRs,
        checkInsByKeyResultId: nextCheckIns,
      };
    });

    useUndoRedoStore.getState().pushAction({
      description: 'Check-in recorded',
      undoFn: async () => {
        await get().undoCheckIns(res.undoState);
      },
      showToast: true,
    });
  },

  undoCheckIns: async (snapshot) => {
    const restoredKRs = await ipc.invoke<KeyResult[]>(IPC.OKR.UNDO_CHECK_INS, snapshot);

    set((state) => {
      const nextKRs = { ...state.keyResultsById };
      for (const kr of restoredKRs) {
        nextKRs[kr.id] = kr;
      }
      const entryIdSet = new Set(snapshot.entryIds);
      const nextCheckIns = { ...state.checkInsByKeyResultId };
      for (const krId of Object.keys(snapshot.previousStates)) {
        const list = nextCheckIns[krId] || [];
        nextCheckIns[krId] = list.filter((ci) => !entryIdSet.has(ci.id));
      }
      return {
        keyResultsById: nextKRs,
        checkInsByKeyResultId: nextCheckIns,
      };
    });
  },

  toggleHabitLog: async (keyResultId, logDate) => {
    const res = await ipc.invoke<{ key_result_id: string; log_date: string; state: boolean }>(
      IPC.OKR.TOGGLE_HABIT_LOG,
      { keyResultId, logDate }
    );

    set((state) => {
      const list = state.habitLogsByKeyResultId[keyResultId] || [];
      let nextList: KRHabitLog[];
      if (res.state) {
        nextList = [...list, { key_result_id: keyResultId, log_date: logDate, created_at: new Date().toISOString() }];
      } else {
        nextList = list.filter((l) => l.log_date !== logDate);
      }
      return {
        habitLogsByKeyResultId: {
          ...state.habitLogsByKeyResultId,
          [keyResultId]: nextList,
        },
      };
    });
  },
}));
