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

  getByList(listId: string, offset = 0, limit = 50): Promise<Task[]> {
    return invoke<Task[]>(IPC.TASKS.GET_BY_LIST, { listId, offset, limit });
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

  star(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.STAR, id);
  },

  unstar(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.UNSTAR, id);
  },

  restore(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.RESTORE, id);
  },

  duplicate(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.DUPLICATE, id);
  },

  makeSubtask(id: string, parentId: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.MAKE_SUBTASK, { id, parentId });
  },

  promoteSubtask(id: string): Promise<Task> {
    return invoke<Task>(IPC.TASKS.PROMOTE_SUBTASK, id);
  },

  getSubtasks(parentId: string): Promise<Task[]> {
    return invoke<Task[]>(IPC.TASKS.GET_SUBTASKS, parentId);
  },

  delete(id: string): Promise<boolean> {
    return invoke<boolean>(IPC.TASKS.DELETE, id);
  },

  reorder(id: string, sortOrder: number): Promise<Task> {
    return invoke<Task>(IPC.TASKS.REORDER, { id, sortOrder });
  },

  batchUpdate(updates: UpdateTaskPayload[]): Promise<Task[]> {
    return invoke<Task[]>(IPC.TASKS.BATCH_UPDATE, updates);
  },
};

export default taskServiceAdapter;
