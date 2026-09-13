import { IPC } from '@shared/ipc-channels.js';
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '@shared/types/task.js';
import type { IpcResult } from '@shared/types/ipc.js';

export const taskServiceAdapter = {
  async getAll(): Promise<Task[]> {
    const result: IpcResult<Task[]> = await window.electron.invoke(IPC.TASKS.GET_ALL);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async getById(id: string): Promise<Task> {
    const result: IpcResult<Task> = await window.electron.invoke(IPC.TASKS.GET_BY_ID, id);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async create(payload: CreateTaskPayload): Promise<Task> {
    const result: IpcResult<Task> = await window.electron.invoke(IPC.TASKS.CREATE, payload);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async update(payload: UpdateTaskPayload): Promise<Task> {
    const result: IpcResult<Task> = await window.electron.invoke(IPC.TASKS.UPDATE, payload);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async toggleComplete(id: string): Promise<Task> {
    const result: IpcResult<Task> = await window.electron.invoke(IPC.TASKS.TOGGLE_COMPLETE, id);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },

  async delete(id: string): Promise<boolean> {
    const result: IpcResult<boolean> = await window.electron.invoke(IPC.TASKS.DELETE, id);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  },
};
