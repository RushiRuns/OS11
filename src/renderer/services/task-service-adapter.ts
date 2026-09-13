import { IPC } from '@shared/ipc-channels.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import { invoke } from './ipc.js';

export const taskServiceAdapter = {
  getAll(): Promise<Task[]> {
    return invoke<Task[]>(IPC.TASKS.GET_ALL);
  },

  getById(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.GET_BY_ID, id);
  },

  create(payload: CreateTaskPayload): Promise<Task> {
    return invoke<Task>(IPC.TASKS.CREATE, payload);
  },

  update(payload: UpdateTaskPayload): Promise<Task> {
    return invoke<Task>(IPC.TASKS.UPDATE, payload);
  },

  toggleComplete(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.TOGGLE_COMPLETE, id);
  },

  delete(id: string): Promise<boolean> {
    return invoke<boolean>(IPC.TASKS.DELETE, id);
  },
};
