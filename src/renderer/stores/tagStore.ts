import { create } from 'zustand';
import { ipc } from '../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Tag, CreateTagPayload, UpdateTagPayload } from '@shared/types/Tag.js';

export interface TagTreeNode {
  id: string;
  name: string;
  fullPath: string;
  tag?: Tag;
  children: TagTreeNode[];
}

export interface TagColorOption {
  name: string;
  token: string;
  hex: string;
}

export const TAG_COLOR_PALETTE: TagColorOption[] = [
  { name: 'Blue', token: 'var(--tag-blue)', hex: '#1B88FF' },
  { name: 'Cyan', token: 'var(--tag-cyan)', hex: '#00B4D8' },
  { name: 'Teal', token: 'var(--tag-teal)', hex: '#1ABC9C' },
  { name: 'Green', token: 'var(--tag-green)', hex: '#27AE60' },
  { name: 'Lime', token: 'var(--tag-lime)', hex: '#8BC34A' },
  { name: 'Yellow', token: 'var(--tag-yellow)', hex: '#D4AC0D' },
  { name: 'Orange', token: 'var(--tag-orange)', hex: '#E67E22' },
  { name: 'Red', token: 'var(--tag-red)', hex: '#E74C3C' },
  { name: 'Pink', token: 'var(--tag-pink)', hex: '#E91E8C' },
  { name: 'Purple', token: 'var(--tag-purple)', hex: '#9B59B6' },
  { name: 'Lavender', token: 'var(--tag-lavender)', hex: '#7986CB' },
  { name: 'Gray', token: 'var(--tag-gray)', hex: '#95A5A6' },
];

/**
 * Builds a hierarchical tree from tags supporting both slash-delimited names ('work/client/Acme')
 * and explicit parent_tag_id relationships.
 */
export function buildTagTree(tags: Tag[]): TagTreeNode[] {
  const rootNodes: TagTreeNode[] = [];
  const nodeMap = new Map<string, TagTreeNode>();

  // Process slash-delimited paths first
  for (const tag of tags) {
    const parts = tag.name.split('/').filter(Boolean);
    let currentLevel = rootNodes;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLeaf = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name.toLowerCase() === part.toLowerCase());
      if (!existing) {
        existing = {
          id: isLeaf ? tag.id : `node_${accumulatedPath}`,
          name: part,
          fullPath: accumulatedPath,
          tag: isLeaf ? tag : undefined,
          children: [],
        };
        currentLevel.push(existing);
        nodeMap.set(existing.id, existing);
      } else if (isLeaf && !existing.tag) {
        existing.tag = tag;
        existing.id = tag.id;
      }
      currentLevel = existing.children;
    }
  }

  // Handle parent_tag_id if explicit parent is set and not already organized by slash
  for (const tag of tags) {
    if (tag.parent_tag_id && !tag.name.includes('/')) {
      const parentNode = nodeMap.get(tag.parent_tag_id);
      const childNode = nodeMap.get(tag.id);
      if (parentNode && childNode && parentNode !== childNode) {
        // Move childNode under parentNode if not already there
        const rootIdx = rootNodes.findIndex((n) => n.id === childNode.id);
        if (rootIdx !== -1) {
          rootNodes.splice(rootIdx, 1);
          if (!parentNode.children.some((c) => c.id === childNode.id)) {
            parentNode.children.push(childNode);
          }
        }
      }
    }
  }

  return rootNodes;
}

interface TagState {
  tagsById: Record<string, Tag>;
  taskTagsByTaskId: Record<string, string[]>;
  isLoading: boolean;
  isLoaded: boolean;

  // Actions
  loadTags: () => Promise<void>;
  createTag: (payload: CreateTagPayload) => Promise<Tag>;
  updateTag: (id: string, fields: UpdateTagPayload) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  mergeTags: (sourceTagId: string, targetTagId: string) => Promise<void>;
  loadTagsForTask: (taskId: string) => Promise<string[]>;
  addTagToTask: (taskId: string, tagId: string) => Promise<void>;
  removeTagFromTask: (taskId: string, tagId: string) => Promise<void>;
  getTagsForTask: (taskId: string) => Tag[];
}

export const useTagStore = create<TagState>((set, get) => ({
  tagsById: {},
  taskTagsByTaskId: {},
  isLoading: false,
  isLoaded: false,

  loadTags: async () => {
    if (get().isLoaded || get().isLoading) return;
    set({ isLoading: true });
    try {
      const tags = await ipc.invoke<Tag[]>(IPC.TAGS.GET_ALL);
      const tagsById: Record<string, Tag> = {};
      for (const tag of tags) {
        tagsById[tag.id] = tag;
      }
      set({ tagsById, isLoaded: true, isLoading: false });
    } catch (err) {
      console.error('Failed to load tags:', err);
      set({ isLoading: false });
    }
  },

  createTag: async (payload: CreateTagPayload) => {
    const tempId = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticTag: Tag = {
      id: tempId,
      name: payload.name.trim(),
      color: payload.color ?? 'var(--tag-blue)',
      parent_tag_id: payload.parent_tag_id ?? null,
      sort_order: payload.sort_order ?? Date.now(),
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      tagsById: { ...state.tagsById, [tempId]: optimisticTag },
    }));

    try {
      const created = await ipc.invoke<Tag>(IPC.TAGS.CREATE, payload);
      set((state) => {
        const next = { ...state.tagsById };
        delete next[tempId];
        next[created.id] = created;
        return { tagsById: next };
      });
      return created;
    } catch (err) {
      set((state) => {
        const next = { ...state.tagsById };
        delete next[tempId];
        return { tagsById: next };
      });
      throw err;
    }
  },

  updateTag: async (id: string, fields: UpdateTagPayload) => {
    const existing = get().tagsById[id];
    if (!existing) throw new Error(`Tag ${id} not found`);

    const updated: Tag = {
      ...existing,
      ...fields,
      name: fields.name !== undefined ? fields.name.trim() : existing.name,
    };

    set((state) => ({
      tagsById: { ...state.tagsById, [id]: updated },
    }));

    try {
      const persisted = await ipc.invoke<Tag>(IPC.TAGS.UPDATE, { id, fields });
      set((state) => ({
        tagsById: { ...state.tagsById, [id]: persisted },
      }));
      return persisted;
    } catch (err) {
      set((state) => ({
        tagsById: { ...state.tagsById, [id]: existing },
      }));
      throw err;
    }
  },

  deleteTag: async (id: string) => {
    const existing = get().tagsById[id];
    if (!existing) return;

    set((state) => {
      const nextTags = { ...state.tagsById };
      delete nextTags[id];

      // Remove from task tag associations
      const nextTaskTags: Record<string, string[]> = {};
      for (const [taskId, tagIds] of Object.entries(state.taskTagsByTaskId)) {
        nextTaskTags[taskId] = tagIds.filter((tId) => tId !== id);
      }

      return { tagsById: nextTags, taskTagsByTaskId: nextTaskTags };
    });

    try {
      await ipc.invoke(IPC.TAGS.DELETE, id);
    } catch (err) {
      set((state) => ({
        tagsById: { ...state.tagsById, [id]: existing },
      }));
      throw err;
    }
  },

  mergeTags: async (sourceTagId: string, targetTagId: string) => {
    if (sourceTagId === targetTagId) return;
    const sourceTag = get().tagsById[sourceTagId];
    const targetTag = get().tagsById[targetTagId];
    if (!sourceTag || !targetTag) return;

    // Optimistic merge: remove sourceTag, replace in task associations
    set((state) => {
      const nextTags = { ...state.tagsById };
      delete nextTags[sourceTagId];

      const nextTaskTags: Record<string, string[]> = {};
      for (const [taskId, tagIds] of Object.entries(state.taskTagsByTaskId)) {
        if (tagIds.includes(sourceTagId)) {
          const updated = tagIds.filter((tId) => tId !== sourceTagId);
          if (!updated.includes(targetTagId)) {
            updated.push(targetTagId);
          }
          nextTaskTags[taskId] = updated;
        } else {
          nextTaskTags[taskId] = tagIds;
        }
      }

      return { tagsById: nextTags, taskTagsByTaskId: nextTaskTags };
    });

    try {
      await ipc.invoke(IPC.TAGS.MERGE, { sourceTagId, targetTagId });
    } catch (err) {
      // Revert if error
      set((state) => ({
        tagsById: { ...state.tagsById, [sourceTagId]: sourceTag },
      }));
      throw err;
    }
  },

  loadTagsForTask: async (taskId: string) => {
    try {
      const tags = await ipc.invoke<Tag[]>(IPC.TAGS.GET_FOR_TASK, taskId);
      const tagIds = tags.map((t) => t.id);

      set((state) => {
        const nextTags = { ...state.tagsById };
        for (const tag of tags) {
          nextTags[tag.id] = tag;
        }
        return {
          tagsById: nextTags,
          taskTagsByTaskId: {
            ...state.taskTagsByTaskId,
            [taskId]: tagIds,
          },
        };
      });

      return tagIds;
    } catch (err) {
      console.error(`Failed to load tags for task ${taskId}:`, err);
      return [];
    }
  },

  addTagToTask: async (taskId: string, tagId: string) => {
    const current = get().taskTagsByTaskId[taskId] || [];
    if (current.includes(tagId)) return;

    set((state) => ({
      taskTagsByTaskId: {
        ...state.taskTagsByTaskId,
        [taskId]: [...(state.taskTagsByTaskId[taskId] || []), tagId],
      },
    }));

    try {
      await ipc.invoke(IPC.TAGS.ADD_TO_TASK, { taskId, tagId });
    } catch (err) {
      set((state) => ({
        taskTagsByTaskId: {
          ...state.taskTagsByTaskId,
          [taskId]: (state.taskTagsByTaskId[taskId] || []).filter((id) => id !== tagId),
        },
      }));
      throw err;
    }
  },

  removeTagFromTask: async (taskId: string, tagId: string) => {
    const current = get().taskTagsByTaskId[taskId] || [];
    if (!current.includes(tagId)) return;

    set((state) => ({
      taskTagsByTaskId: {
        ...state.taskTagsByTaskId,
        [taskId]: (state.taskTagsByTaskId[taskId] || []).filter((id) => id !== tagId),
      },
    }));

    try {
      await ipc.invoke(IPC.TAGS.REMOVE_FROM_TASK, { taskId, tagId });
    } catch (err) {
      set((state) => ({
        taskTagsByTaskId: {
          ...state.taskTagsByTaskId,
          [taskId]: [...(state.taskTagsByTaskId[taskId] || []), tagId],
        },
      }));
      throw err;
    }
  },

  getTagsForTask: (taskId: string) => {
    const tagIds = get().taskTagsByTaskId[taskId] || [];
    const tagsById = get().tagsById;
    return tagIds.map((id) => tagsById[id]).filter(Boolean);
  },
}));

export default useTagStore;
