import { IPC } from '@shared/ipc-channels.js';
import type { List, CreateListPayload, UpdateListPayload } from '@shared/types/List.js';
import type { ListGroup, CreateListGroupPayload, UpdateListGroupPayload } from '@shared/types/ListGroup.js';
import { invoke } from './ipc.js';

export const listServiceAdapter = {
  // Lists
  getAll(): Promise<List[]> {
    return invoke<List[]>(IPC.LISTS.GET_ALL);
  },

  getById(id: string): Promise<List> {
    return invoke<List>(IPC.LISTS.GET_BY_ID, id);
  },

  create(payload: CreateListPayload): Promise<List> {
    return invoke<List>(IPC.LISTS.CREATE, payload);
  },

  update(id: string, fields: UpdateListPayload): Promise<List> {
    return invoke<List>(IPC.LISTS.UPDATE, { id, fields });
  },

  delete(id: string): Promise<boolean> {
    return invoke<boolean>(IPC.LISTS.DELETE, id);
  },

  reorder(updates: Array<{ id: string; sortOrder: number }>): Promise<boolean> {
    return invoke<boolean>(IPC.LISTS.REORDER, updates);
  },

  // List Groups
  getAllGroups(): Promise<ListGroup[]> {
    return invoke<ListGroup[]>(IPC.LIST_GROUPS.GET_ALL);
  },

  createGroup(payload: CreateListGroupPayload): Promise<ListGroup> {
    return invoke<ListGroup>(IPC.LIST_GROUPS.CREATE, payload);
  },

  updateGroup(id: string, fields: UpdateListGroupPayload): Promise<ListGroup> {
    return invoke<ListGroup>(IPC.LIST_GROUPS.UPDATE, { id, fields });
  },

  deleteGroup(id: string): Promise<boolean> {
    return invoke<boolean>(IPC.LIST_GROUPS.DELETE, id);
  },

  reorderGroups(updates: Array<{ id: string; sortOrder: number }>): Promise<boolean> {
    return invoke<boolean>(IPC.LIST_GROUPS.REORDER, updates);
  },
};

export default listServiceAdapter;
