import { create } from 'zustand';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import { taskServiceAdapter } from '../services/task-service-adapter.js';
import { playTaskCompleteSound, playTaskCreateSound } from '../utils/sound-effects.js';
import { useAppStore } from './app-store.js';
import { useCountsStore } from './countsStore.js';
import { useGoalStore } from './goalStore.js';

function maybeCheckInLinkedGoal(taskId: string) {
  try {
    const goalStore = useGoalStore.getState();
    const linkedGoal = goalStore.getGoalForTask(taskId);
    if (linkedGoal && linkedGoal.goal_type === 'habit' && linkedGoal.status !== 'archived') {
      const streak = goalStore.getStreakStatus(linkedGoal.id);
      if (!streak.checkedInToday) {
        goalStore.checkInHabit(linkedGoal.id).catch(() => {});
      }
    }
  } catch {
    // Non-blocking best-effort check-in
  }
}

export type RightSlotActive = 'scheduler' | 'suggestions' | 'detail' | null;
export type RightSlotPrevious = 'scheduler' | 'suggestions' | null;

export interface TaskStoreState {
  tasksById: Record<string, Task>;
  loading: boolean;
  error: string | null;
  selectedTaskId: string | null;
  rightSlotActive: RightSlotActive;
  rightSlotPrevious: RightSlotPrevious;

  // Primary Actions
  loadTasks: () => Promise<void>;
  loadTasksByList: (listId: string) => Promise<void>;
  appendTasks: (tasks: Task[]) => void;
  setSelectedTaskId: (id: string | null) => void;
  setRightSlot: (slot: RightSlotActive) => void;
  toggleRightSlotPeer: (peer: 'scheduler' | 'suggestions') => void;
  openDetail: (taskId: string) => void;
  closeDetail: () => void;

  // Optimistic Mutations (PERFORMANCE.md §11)
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  updateTask: (payload: UpdateTaskPayload) => Promise<Task>;
  toggleComplete: (id: string) => Promise<Task>;
  completeTask: (id: string, options?: { skipRecurrence?: boolean }) => Promise<Task>;
  toggleStar: (id: string) => Promise<Task>;
  deleteTask: (id: string) => Promise<boolean>;
  restoreTask: (id: string) => Promise<Task>;
  duplicateTask: (id: string) => Promise<Task>;
  makeSubtask: (id: string, parentId: string) => Promise<Task>;
  promoteSubtask: (id: string) => Promise<Task>;
  reorderTask: (id: string, sortOrder: number) => Promise<Task>;
  moveTask: (id: string, target: { parentId?: string | null; sortOrder: number }) => Promise<Task>;
  scheduleTask: (id: string, startMin: number, durationMin: number) => Promise<Task>;
  updateTimeBlock: (id: string, startMin: number, durationMin: number) => Promise<Task>;
  unscheduleTask: (id: string) => Promise<Task>;
  rollOverToToday: (ids: string[], today?: string) => Promise<Task[]>;
  setBucket: (taskId: string, bucket: 'anytime' | 'someday' | null) => Promise<Task>;
  setDate: (payload: { taskId: string; dueDate: string | null; dueTime?: string | null; allDay?: boolean; recurrenceRule?: string | null }) => Promise<Task>;
  setWaiting: (payload: { taskId: string; waitingOn: string; followUpDate?: string | null }) => Promise<Task>;
  clearWaiting: (taskId: string) => Promise<Task>;
  restoreSchedulingState: (taskId: string, state: any) => Promise<Task>;

  // Rollback
  rollbackUpdate: (id: string, previousState: Task | null) => void;
}

// A drag-drop move persists in up to two IPC calls. While one is in flight a reload must not
// run: the change event fired by the first write would replace the optimistic sort_order with
// stale rows and the dropped task would flicker back for a frame.
let pendingMoves = 0;
let reloadAfterMoves = false;

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasksById: {},
  loading: false,
  error: null,
  selectedTaskId: null,
  rightSlotActive: null,
  rightSlotPrevious: null,

  loadTasks: async () => {
    if (pendingMoves > 0) {
      reloadAfterMoves = true;
      return;
    }
    set({ loading: true, error: null });
    try {
      const taskList = await taskServiceAdapter.getAll();
      const map: Record<string, Task> = {};
      for (const t of taskList) {
        map[t.id] = t;
      }
      set({ tasksById: map, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, loading: false });
    }
  },

  loadTasksByList: async (listId: string) => {
    set({ loading: true, error: null });
    try {
      const taskList = await taskServiceAdapter.getByList(listId);
      set((state) => {
        const next = { ...state.tasksById };
        for (const t of taskList) {
          next[t.id] = t;
        }
        return { tasksById: next, loading: false };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, loading: false });
    }
  },

  appendTasks: (tasks: Task[]) => {
    set((state) => {
      const next = { ...state.tasksById };
      for (const t of tasks) {
        next[t.id] = t;
      }
      return { tasksById: next };
    });
  },

  setRightSlot: (slot: RightSlotActive) => {
    set({ rightSlotActive: slot });
  },

  toggleRightSlotPeer: (peer: 'scheduler' | 'suggestions') => {
    set((state) => {
      if (state.rightSlotActive === peer) {
        return {
          rightSlotActive: null,
          rightSlotPrevious: null,
        };
      }
      return {
        selectedTaskId: null,
        rightSlotActive: peer,
        rightSlotPrevious: null,
      };
    });
  },

  openDetail: (taskId: string) => {
    set((state) => {
      const prevPeer: RightSlotPrevious =
        state.rightSlotActive === 'scheduler' || state.rightSlotActive === 'suggestions'
          ? state.rightSlotActive
          : state.rightSlotPrevious;
      return {
        selectedTaskId: taskId,
        rightSlotActive: 'detail',
        rightSlotPrevious: prevPeer,
      };
    });
  },

  closeDetail: () => {
    let isMyDay = false;
    try {
      isMyDay = useAppStore.getState().activeListId === 'smart_my_day';
    } catch {
      // ignore
    }
    set((state) => {
      const nextSlot = isMyDay && state.rightSlotPrevious ? state.rightSlotPrevious : null;
      return {
        selectedTaskId: null,
        rightSlotActive: nextSlot,
        rightSlotPrevious: null,
      };
    });
  },

  setSelectedTaskId: (id: string | null) => {
    if (id) {
      get().openDetail(id);
    } else {
      get().closeDetail();
    }
  },

  createTask: async (payload: CreateTaskPayload): Promise<Task> => {
    // 1. Generate optimistic task
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticTask: Task = {
      id: tempId,
      title: payload.title,
      notes: payload.notes ?? null,
      list_id: payload.list_id ?? null,
      project_id: payload.project_id ?? null,
      area_id: payload.area_id ?? null,
      section_id: payload.section_id ?? null,
      parent_task_id: null,
      due_date: payload.due_date ?? null,
      due_time: payload.due_time ?? null,
      all_day: payload.all_day ? 1 : 0,
      recurrence_rule: payload.recurrence_rule ?? null,
      recurrence_basis: null,
      priority: payload.priority ?? 0,
      is_starred: payload.is_starred ? 1 : 0,
      is_completed: 0,
      completed_at: null,
      estimated_minutes: payload.estimated_minutes ?? null,
      assignee_device_id: null,
      created_by_device: 'local',
      sort_order: Date.now(),
      my_day_date: null,
      pomodoro_count: 0,
      is_trashed: 0,
      trashed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      tasksById: { ...state.tasksById, [tempId]: optimisticTask },
    }));
    playTaskCreateSound();

    try {
      const realTask = await taskServiceAdapter.create(payload);
      set((state) => {
        const next = { ...state.tasksById };
        delete next[tempId];
        next[realTask.id] = realTask;
        return { tasksById: next };
      });
      return realTask;
    } catch (err) {
      get().rollbackUpdate(tempId, null);
      throw err;
    }
  },

  updateTask: async (payload: UpdateTaskPayload): Promise<Task> => {
    const existing = get().tasksById[payload.id];
    if (!existing) {
      throw new Error(`Task ${payload.id} not found in store`);
    }

    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      tasksById: { ...state.tasksById, [payload.id]: optimistic },
    }));

    try {
      const realTask = await taskServiceAdapter.update(payload);
      set((state) => ({
        tasksById: { ...state.tasksById, [realTask.id]: realTask },
      }));
      return realTask;
    } catch (err) {
      get().rollbackUpdate(payload.id, previousSnapshot);
      throw err;
    }
  },

  toggleComplete: async (id: string): Promise<Task> => {
    const existing = get().tasksById[id];
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const previousSnapshot: Task = { ...existing };
    const nextCompleted = existing.is_completed === 1 ? 0 : 1;
    if (nextCompleted === 1) {
      playTaskCompleteSound();
    }
    const optimistic: Task = {
      ...existing,
      is_completed: nextCompleted,
      completed_at: nextCompleted === 1 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      tasksById: { ...state.tasksById, [id]: optimistic },
    }));

    try {
      const updated = await taskServiceAdapter.toggleComplete(id);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      if (existing.recurrence_rule && nextCompleted === 1) {
        get().loadTasks().catch(() => {});
      }
      if (nextCompleted === 1) {
        maybeCheckInLinkedGoal(id);
      }
      return updated;
    } catch (err) {
      get().rollbackUpdate(id, previousSnapshot);
      throw err;
    }
  },

  completeTask: async (id: string, options?: { skipRecurrence?: boolean }): Promise<Task> => {
    const existing = get().tasksById[id];
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    playTaskCompleteSound();
    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      is_completed: 1,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      tasksById: { ...state.tasksById, [id]: optimistic },
    }));

    try {
      const updated = await taskServiceAdapter.complete(id, options);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      if (existing.recurrence_rule && !options?.skipRecurrence) {
        get().loadTasks().catch(() => {});
      }
      maybeCheckInLinkedGoal(id);
      return updated;
    } catch (err) {
      get().rollbackUpdate(id, previousSnapshot);
      throw err;
    }
  },

  toggleStar: async (id: string): Promise<Task> => {
    const existing = get().tasksById[id];
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const previousSnapshot: Task = { ...existing };
    const nextStarred = existing.is_starred === 1 ? 0 : 1;
    const optimistic: Task = {
      ...existing,
      is_starred: nextStarred,
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      tasksById: { ...state.tasksById, [id]: optimistic },
    }));

    try {
      const updated = nextStarred === 1
        ? await taskServiceAdapter.star(id)
        : await taskServiceAdapter.unstar(id);

      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      get().rollbackUpdate(id, previousSnapshot);
      throw err;
    }
  },

  deleteTask: async (id: string): Promise<boolean> => {
    const existing = get().tasksById[id];
    if (!existing) return false;

    const previousSnapshot: Task = { ...existing };

    // Optimistic soft delete: mark as trashed and remove from active map
    set((state) => {
      const next = { ...state.tasksById };
      delete next[id];
      return {
        tasksById: next,
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      };
    });

    try {
      const ok = await taskServiceAdapter.delete(id);
      return ok;
    } catch (err) {
      get().rollbackUpdate(id, previousSnapshot);
      throw err;
    }
  },

  restoreTask: async (id: string): Promise<Task> => {
    const restored = await taskServiceAdapter.restore(id);
    set((state) => ({
      tasksById: { ...state.tasksById, [restored.id]: restored },
    }));
    return restored;
  },

  duplicateTask: async (id: string): Promise<Task> => {
    const duplicated = await taskServiceAdapter.duplicate(id);
    set((state) => ({
      tasksById: { ...state.tasksById, [duplicated.id]: duplicated },
    }));
    return duplicated;
  },

  makeSubtask: async (id: string, parentId: string): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: { ...state.tasksById[id], parent_task_id: parentId },
        },
      };
    });

    try {
      const updated = await taskServiceAdapter.makeSubtask(id, parentId);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  promoteSubtask: async (id: string): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: { ...state.tasksById[id], parent_task_id: null },
        },
      };
    });

    try {
      const updated = await taskServiceAdapter.promoteSubtask(id);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  reorderTask: async (id: string, sortOrder: number): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: { ...state.tasksById[id], sort_order: sortOrder },
        },
      };
    });

    try {
      const updated = await taskServiceAdapter.reorder(id, sortOrder);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: updated },
      }));
      return updated;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  moveTask: async (id, { parentId, sortOrder }) => {
    const existing = get().tasksById[id];
    if (!existing) throw new Error(`moveTask: unknown task ${id}`);
    const previousSnapshot = { ...existing };

    // undefined means "leave the parent alone".
    const currentParentId = existing.parent_task_id ?? null;
    const newParent: string | null | undefined =
      parentId !== currentParentId ? parentId : undefined;

    // One synchronous optimistic write: parent and position change in the same render, so the
    // row jumps once, straight to its final slot.
    set((state) => ({
      tasksById: {
        ...state.tasksById,
        [id]: {
          ...state.tasksById[id],
          ...(newParent !== undefined ? { parent_task_id: newParent } : {}),
          sort_order: sortOrder,
        },
      },
    }));

    pendingMoves += 1;
    try {
      // The intermediate response is intentionally NOT written to the store: it still carries
      // the old sort_order and would flash the row back for a frame.
      if (newParent === null) {
        await taskServiceAdapter.promoteSubtask(id);
      } else if (newParent !== undefined) {
        await taskServiceAdapter.makeSubtask(id, newParent);
      }
      const persisted = await taskServiceAdapter.reorder(id, sortOrder);
      set((state) => ({ tasksById: { ...state.tasksById, [id]: persisted } }));
      return persisted;
    } catch (err) {
      get().rollbackUpdate(id, previousSnapshot);
      throw err;
    } finally {
      pendingMoves -= 1;
      if (pendingMoves === 0 && reloadAfterMoves) {
        reloadAfterMoves = false;
        void get().loadTasks();
      }
    }
  },

  scheduleTask: async (id: string, startMin: number, durationMin: number): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: {
            ...state.tasksById[id],
            scheduled_start_min: startMin,
            scheduled_duration_min: durationMin,
            updated_at: new Date().toISOString(),
          },
        },
      };
    });

    try {
      const persisted = await taskServiceAdapter.setTimeBlock(id, startMin, durationMin);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  updateTimeBlock: async (id: string, startMin: number, durationMin: number): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: {
            ...state.tasksById[id],
            scheduled_start_min: startMin,
            scheduled_duration_min: durationMin,
            updated_at: new Date().toISOString(),
          },
        },
      };
    });

    try {
      const persisted = await taskServiceAdapter.setTimeBlock(id, startMin, durationMin);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  unscheduleTask: async (id: string): Promise<Task> => {
    const existing = get().tasksById[id];
    const previousSnapshot = existing ? { ...existing } : null;

    set((state) => {
      if (!state.tasksById[id]) return state;
      return {
        tasksById: {
          ...state.tasksById,
          [id]: {
            ...state.tasksById[id],
            scheduled_start_min: null,
            scheduled_duration_min: null,
            updated_at: new Date().toISOString(),
          },
        },
      };
    });

    try {
      const persisted = await taskServiceAdapter.clearTimeBlock(id);
      set((state) => ({
        tasksById: { ...state.tasksById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      if (previousSnapshot) {
        get().rollbackUpdate(id, previousSnapshot);
      }
      throw err;
    }
  },

  rollOverToToday: async (ids: string[], today?: string): Promise<Task[]> => {
    const targetDate = today ?? new Date().toISOString().split('T')[0];
    const previousSnapshots: Record<string, Task> = {};
    for (const id of ids) {
      if (get().tasksById[id]) {
        previousSnapshots[id] = { ...get().tasksById[id] };
      }
    }

    set((state) => {
      const next = { ...state.tasksById };
      for (const id of ids) {
        if (next[id]) {
          next[id] = {
            ...next[id],
            my_day_date: targetDate,
            scheduled_start_min: null,
            scheduled_duration_min: null,
            updated_at: new Date().toISOString(),
          };
        }
      }
      return { tasksById: next };
    });

    try {
      const persistedTasks = await taskServiceAdapter.rolloverToToday(ids, targetDate);
      set((state) => {
        const next = { ...state.tasksById };
        for (const t of persistedTasks) {
          next[t.id] = t;
        }
        return { tasksById: next };
      });
      return persistedTasks;
    } catch (err) {
      set((state) => ({
        tasksById: {
          ...state.tasksById,
          ...previousSnapshots,
        },
      }));
      throw err;
    }
  },

  setBucket: async (taskId: string, bucket: 'anytime' | 'someday' | null): Promise<Task> => {
    const existing = get().tasksById[taskId];
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      bucket,
      due_date: bucket ? null : existing.due_date,
      due_time: bucket ? null : existing.due_time,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      tasksById: { ...state.tasksById, [taskId]: optimistic },
    }));
    try {
      const res = await taskServiceAdapter.setBucket({ taskId, bucket });
      set((state) => ({
        tasksById: { ...state.tasksById, [taskId]: res.task },
      }));
      useCountsStore.getState().loadCounts();
      return res.task;
    } catch (err) {
      get().rollbackUpdate(taskId, previousSnapshot);
      throw err;
    }
  },

  setDate: async (payload: { taskId: string; dueDate: string | null; dueTime?: string | null; allDay?: boolean; recurrenceRule?: string | null }): Promise<Task> => {
    const existing = get().tasksById[payload.taskId];
    if (!existing) throw new Error(`Task ${payload.taskId} not found`);
    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      due_date: payload.dueDate ?? null,
      due_time: payload.dueTime ?? null,
      bucket: payload.dueDate ? null : existing.bucket,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      tasksById: { ...state.tasksById, [payload.taskId]: optimistic },
    }));
    try {
      const res = await taskServiceAdapter.setDate(payload);
      set((state) => ({
        tasksById: { ...state.tasksById, [payload.taskId]: res.task },
      }));
      useCountsStore.getState().loadCounts();
      return res.task;
    } catch (err) {
      get().rollbackUpdate(payload.taskId, previousSnapshot);
      throw err;
    }
  },

  setWaiting: async (payload: { taskId: string; waitingOn: string; followUpDate?: string | null }): Promise<Task> => {
    const existing = get().tasksById[payload.taskId];
    if (!existing) throw new Error(`Task ${payload.taskId} not found`);
    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      waiting_on: payload.waitingOn,
      waiting_since: existing.waiting_since ?? new Date().toISOString(),
      follow_up_date: payload.followUpDate ?? null,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      tasksById: { ...state.tasksById, [payload.taskId]: optimistic },
    }));
    try {
      const res = await taskServiceAdapter.setWaiting(payload);
      set((state) => ({
        tasksById: { ...state.tasksById, [payload.taskId]: res.task },
      }));
      useCountsStore.getState().loadCounts();
      return res.task;
    } catch (err) {
      get().rollbackUpdate(payload.taskId, previousSnapshot);
      throw err;
    }
  },

  clearWaiting: async (taskId: string): Promise<Task> => {
    const existing = get().tasksById[taskId];
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const previousSnapshot: Task = { ...existing };
    const optimistic: Task = {
      ...existing,
      waiting_on: null,
      waiting_since: null,
      follow_up_date: null,
      follow_up_notified_on: null,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      tasksById: { ...state.tasksById, [taskId]: optimistic },
    }));
    try {
      const res = await taskServiceAdapter.clearWaiting(taskId);
      set((state) => ({
        tasksById: { ...state.tasksById, [taskId]: res.task },
      }));
      useCountsStore.getState().loadCounts();
      return res.task;
    } catch (err) {
      get().rollbackUpdate(taskId, previousSnapshot);
      throw err;
    }
  },

  restoreSchedulingState: async (taskId: string, state: any): Promise<Task> => {
    const existing = get().tasksById[taskId];
    if (!existing) throw new Error(`Task ${taskId} not found`);
    const previousSnapshot: Task = { ...existing };
    try {
      const res = await taskServiceAdapter.restoreSchedulingState(taskId, state);
      set((s) => ({
        tasksById: { ...s.tasksById, [taskId]: res.task },
      }));
      useCountsStore.getState().loadCounts();
      return res.task;
    } catch (err) {
      get().rollbackUpdate(taskId, previousSnapshot);
      throw err;
    }
  },

  rollbackUpdate: (id: string, previousState: Task | null) => {
    set((state) => {
      const next = { ...state.tasksById };
      if (previousState) {
        next[id] = previousState;
      } else {
        delete next[id];
      }
      return { tasksById: next };
    });
  },
}));

// Derived Selectors (PERFORMANCE.md §12)
export function useTask(id: string): Task | undefined {
  return useTaskStore((state) => state.tasksById[id]);
}

export function useTasksByList(listId: string): Task[] {
  return useTaskStore((state) => {
    const tasks = Object.values(state.tasksById);
    if (listId === 'list_inbox') {
      return tasks
        .filter(
          (t) =>
            !t.area_id &&
            !t.project_id &&
            !t.parent_task_id &&
            !t.due_date &&
            !t.bucket &&
            !t.waiting_since &&
            t.is_completed === 0 &&
            t.is_trashed === 0
        )
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    if (listId === 'smart_anytime') {
      return tasks
        .filter((t) => t.bucket === 'anytime' && t.is_completed === 0 && t.is_trashed === 0)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    if (listId === 'smart_someday') {
      return tasks
        .filter((t) => t.bucket === 'someday' && t.is_completed === 0 && t.is_trashed === 0)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    if (listId === 'smart_waiting_for') {
      return tasks
        .filter((t) => t.waiting_since !== null && t.is_completed === 0 && t.is_trashed === 0)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    return tasks
      .filter((t) => (t.list_id === listId || t.project_id === listId) && t.is_trashed === 0 && t.parent_task_id === null)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useTasksByArea(areaId: string): Task[] {
  return useTaskStore((state) => {
    const tasks = Object.values(state.tasksById);
    return tasks
      .filter((t) => t.area_id === areaId && !t.project_id && t.is_trashed === 0 && t.parent_task_id === null)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useInboxTasks(): Task[] {
  return useTaskStore((state) => {
    const tasks = Object.values(state.tasksById);
    return tasks
      .filter(
        (t) =>
          !t.area_id &&
          !t.project_id &&
          !t.parent_task_id &&
          !t.due_date &&
          !t.bucket &&
          !t.waiting_since &&
          t.is_completed === 0 &&
          t.is_trashed === 0
      )
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useAnytimeTasks(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.bucket === 'anytime' && t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useSomedayTasks(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.bucket === 'someday' && t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useWaitingForTasks(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.waiting_since !== null && t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useMyDay(): Task[] {
  return useTaskStore((state) => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(state.tasksById)
      .filter((t) => t.my_day_date === today && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useImportant(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.is_starred === 1 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function usePlanned(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.due_date !== null && t.is_trashed === 0)
      .sort((a, b) => {
        if (a.due_date && b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        return a.sort_order - b.sort_order;
      });
  });
}

export function useSubtasks(parentId: string): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.parent_task_id === parentId && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useCompletedTasks(containerId?: string): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => {
        if (t.is_trashed === 1 || t.is_completed === 0) return false;
        if (containerId && containerId !== 'smart_all' && containerId !== 'smart_completed') {
          if (containerId.startsWith('project:')) {
            return t.project_id === containerId.slice(8);
          }
          if (containerId.startsWith('area:')) {
            return t.area_id === containerId.slice(5) && !t.project_id;
          }
          if (containerId === 'list_inbox') {
            return (t.area_id === null && t.project_id === null) || t.list_id === 'list_inbox';
          }
          return t.list_id === containerId || t.project_id === containerId;
        }
        return true;
      })
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  });
}

export function useAllActiveTasks(): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => t.is_trashed === 0 && t.parent_task_id === null)
      .sort((a, b) => a.sort_order - b.sort_order);
  });
}

export function useScheduledTasks(): Task[] {
  return useTaskStore((state) => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(state.tasksById)
      .filter(
        (t) =>
          t.my_day_date === today &&
          t.is_trashed === 0 &&
          t.scheduled_start_min !== null &&
          t.scheduled_duration_min !== null
      )
      .sort((a, b) => (a.scheduled_start_min ?? 0) - (b.scheduled_start_min ?? 0));
  });
}

export function usePlannedMinutes(): number {
  return useTaskStore((state) => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(state.tasksById)
      .filter(
        (t) =>
          t.my_day_date === today &&
          t.is_trashed === 0 &&
          t.scheduled_start_min !== null &&
          t.scheduled_duration_min !== null
      )
      .reduce((acc, t) => acc + (t.scheduled_duration_min ?? 0), 0);
  });
}

export function useUnplacedCount(): number {
  return useTaskStore((state) => {
    const today = new Date().toISOString().split('T')[0];
    return Object.values(state.tasksById).filter(
      (t) =>
        t.my_day_date === today &&
        t.is_trashed === 0 &&
        t.is_completed === 0 &&
        t.scheduled_start_min === null
    ).length;
  });
}

