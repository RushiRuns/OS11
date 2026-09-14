import { create } from 'zustand';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import { taskServiceAdapter } from '../services/task-service-adapter.js';
import { playTaskCompleteSound, playTaskCreateSound } from '../utils/sound-effects.js';

export interface TaskStoreState {
  tasksById: Record<string, Task>;
  loading: boolean;
  error: string | null;
  selectedTaskId: string | null;

  // Primary Actions
  loadTasks: () => Promise<void>;
  loadTasksByList: (listId: string) => Promise<void>;
  appendTasks: (tasks: Task[]) => void;
  setSelectedTaskId: (id: string | null) => void;

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

  // Rollback
  rollbackUpdate: (id: string, previousState: Task | null) => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasksById: {},
  loading: false,
  error: null,
  selectedTaskId: null,

  loadTasks: async () => {
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

  setSelectedTaskId: (id: string | null) => {
    set({ selectedTaskId: id });
  },

  createTask: async (payload: CreateTaskPayload): Promise<Task> => {
    // 1. Generate optimistic task
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const optimisticTask: Task = {
      id: tempId,
      title: payload.title,
      notes: payload.notes ?? null,
      list_id: payload.list_id ?? 'list_inbox',
      project_id: payload.project_id ?? null,
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
    return tasks
      .filter((t) => t.list_id === listId && t.is_trashed === 0 && t.parent_task_id === null)
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

export function useCompletedTasks(listId?: string): Task[] {
  return useTaskStore((state) => {
    return Object.values(state.tasksById)
      .filter((t) => {
        if (t.is_trashed === 1 || t.is_completed === 0) return false;
        if (listId && listId !== 'smart_all' && listId !== 'smart_completed') {
          return t.list_id === listId;
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
