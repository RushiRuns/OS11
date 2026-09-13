import { create } from 'zustand';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import { taskServiceAdapter } from '../services/task-service-adapter.js';

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<void>;
  updateTask: (payload: UpdateTaskPayload) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await taskServiceAdapter.getAll();
      set({ tasks, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createTask: async (payload: CreateTaskPayload) => {
    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
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
      recurrence_rule: null,
      recurrence_basis: null,
      priority: payload.priority ?? 0,
      is_starred: payload.is_starred ? 1 : 0,
      is_completed: 0,
      completed_at: null,
      estimated_minutes: null,
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

    set((state) => ({ tasks: [optimisticTask, ...state.tasks] }));

    try {
      const created = await taskServiceAdapter.create(payload);
      // Replace optimistic record with real SQLite record
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempId ? created : t)),
      }));
    } catch (err: any) {
      // Revert optimistic update on failure
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== tempId),
        error: err.message,
      }));
    }
  },

  updateTask: async (payload: UpdateTaskPayload) => {
    const previous = get().tasks;
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === payload.id ? { ...t, ...payload } : t)),
    }));

    try {
      const updated = await taskServiceAdapter.update(payload);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === payload.id ? updated : t)),
      }));
    } catch (err: any) {
      set({ tasks: previous, error: err.message });
    }
  },

  toggleComplete: async (id: string) => {
    const current = get().tasks.find((t) => t.id === id);
    if (!current) return;

    const previousStatus = current.is_completed;
    const newStatus = previousStatus === 1 ? 0 : 1;

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, is_completed: newStatus } : t,
      ),
    }));

    try {
      const updated = await taskServiceAdapter.toggleComplete(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (err: any) {
      // Revert on error
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, is_completed: previousStatus } : t,
        ),
        error: err.message,
      }));
    }
  },

  deleteTask: async (id: string) => {
    const previous = get().tasks;
    // Optimistic removal
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));

    try {
      await taskServiceAdapter.delete(id);
    } catch (err: any) {
      set({ tasks: previous, error: err.message });
    }
  },
}));
