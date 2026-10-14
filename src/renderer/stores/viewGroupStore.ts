import { create } from 'zustand';

export type GroupByOption =
  | 'none'
  | 'time'
  | 'date'
  | 'tag'
  | 'project'
  | 'area'
  | 'priority'
  | 'custom';

export const GROUP_BY_LABELS: Record<GroupByOption, string> = {
  none: 'None',
  time: 'Time',
  date: 'Date',
  tag: 'Tag',
  project: 'Project',
  area: 'Area',
  priority: 'Priority',
  custom: 'Custom',
};

const VALID_OPTIONS = new Set<string>([
  'none',
  'time',
  'date',
  'tag',
  'project',
  'area',
  'priority',
  'custom',
]);

const STORAGE_KEY_GROUP_BY = 'os11:view-group-by';
const STORAGE_KEY_VISIBLE = 'os11:view-group-visible';
const STORAGE_KEY_COLLAPSED = 'os11:view-group-collapsed';
const STORAGE_KEY_ACTIVE_CUSTOM_GROUP = 'os11:view-active-custom-group';
const STORAGE_KEY_HIDE_EMPTY = 'os11:view-hide-empty';

function getInitialGroupByMap(): Record<string, GroupByOption> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_GROUP_BY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        const result: Record<string, GroupByOption> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (VALID_OPTIONS.has(v)) {
            result[k] = v as GroupByOption;
          }
        }
        return result;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function getInitialVisibilityMap(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_VISIBLE);
      if (raw) {
        return JSON.parse(raw) as Record<string, boolean>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function getInitialCollapsedMap(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
      if (raw) {
        return JSON.parse(raw) as Record<string, boolean>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function getInitialActiveCustomGroupMap(): Record<string, string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_ACTIVE_CUSTOM_GROUP);
      if (raw) {
        return JSON.parse(raw) as Record<string, string>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function getInitialHideEmptyMap(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY_HIDE_EMPTY);
      if (raw) {
        return JSON.parse(raw) as Record<string, boolean>;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

export interface ViewGroupState {
  groupByMap: Record<string, GroupByOption>;
  visibleMap: Record<string, boolean>;
  collapsedGroupsMap: Record<string, boolean>;
  activeCustomGroupMap: Record<string, string>;
  hideEmptyMap: Record<string, boolean>;

  setGroupBy: (viewId: string, option: GroupByOption) => void;
  toggleVisible: (viewId: string) => void;
  setVisible: (viewId: string, visible: boolean) => void;
  getGroupBy: (viewId: string) => GroupByOption;
  isVisible: (viewId: string) => boolean;
  toggleGroupCollapsed: (viewId: string, groupKey: string) => void;
  setGroupCollapsed: (viewId: string, groupKey: string, collapsed: boolean) => void;
  isGroupCollapsed: (viewId: string, groupKey: string) => boolean;

  setActiveCustomGroup: (viewId: string, groupId: string | null) => void;
  getActiveCustomGroup: (viewId: string) => string | null;
  setHideEmpty: (viewId: string, hide: boolean) => void;
  isHideEmpty: (viewId: string) => boolean;
  validateActiveCustomGroups: (validGroupIds: Set<string>) => void;
}

export const useViewGroupStore = create<ViewGroupState>((set, get) => ({
  groupByMap: getInitialGroupByMap(),
  visibleMap: getInitialVisibilityMap(),
  collapsedGroupsMap: getInitialCollapsedMap(),
  activeCustomGroupMap: getInitialActiveCustomGroupMap(),
  hideEmptyMap: getInitialHideEmptyMap(),

  setGroupBy: (viewId: string, option: GroupByOption) => {
    set((prev) => {
      const nextGroupByMap = { ...prev.groupByMap, [viewId]: option };

      // Selecting "none" auto-hides the pill for this view
      const nextVisibleMap =
        option === 'none'
          ? { ...prev.visibleMap, [viewId]: false }
          : prev.visibleMap;

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_GROUP_BY, JSON.stringify(nextGroupByMap));
          if (option === 'none') {
            window.localStorage.setItem(STORAGE_KEY_VISIBLE, JSON.stringify(nextVisibleMap));
          }
        }
      } catch {
        // ignore
      }

      return { groupByMap: nextGroupByMap, visibleMap: nextVisibleMap };
    });
  },

  toggleVisible: (viewId: string) => {
    set((prev) => {
      const nextVisible = !prev.visibleMap[viewId];
      const nextVisibleMap = { ...prev.visibleMap, [viewId]: nextVisible };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_VISIBLE, JSON.stringify(nextVisibleMap));
        }
      } catch {
        // ignore
      }
      return { visibleMap: nextVisibleMap };
    });
  },

  setVisible: (viewId: string, visible: boolean) => {
    set((prev) => {
      const nextVisibleMap = { ...prev.visibleMap, [viewId]: visible };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_VISIBLE, JSON.stringify(nextVisibleMap));
        }
      } catch {
        // ignore
      }
      return { visibleMap: nextVisibleMap };
    });
  },

  getGroupBy: (viewId: string) => get().groupByMap[viewId] ?? 'none',
  isVisible: (viewId: string) => get().visibleMap[viewId] ?? false,

  toggleGroupCollapsed: (viewId: string, groupKey: string) => {
    set((prev) => {
      const compositeKey = `${viewId}:${groupKey}`;
      const nextCollapsed = !prev.collapsedGroupsMap[compositeKey];
      const nextCollapsedMap = { ...prev.collapsedGroupsMap, [compositeKey]: nextCollapsed };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(nextCollapsedMap));
        }
      } catch {
        // ignore
      }
      return { collapsedGroupsMap: nextCollapsedMap };
    });
  },

  setGroupCollapsed: (viewId: string, groupKey: string, collapsed: boolean) => {
    set((prev) => {
      const compositeKey = `${viewId}:${groupKey}`;
      const nextCollapsedMap = { ...prev.collapsedGroupsMap, [compositeKey]: collapsed };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(nextCollapsedMap));
        }
      } catch {
        // ignore
      }
      return { collapsedGroupsMap: nextCollapsedMap };
    });
  },

  isGroupCollapsed: (viewId: string, groupKey: string) =>
    Boolean(get().collapsedGroupsMap[`${viewId}:${groupKey}`]),

  setActiveCustomGroup: (viewId: string, groupId: string | null) => {
    set((prev) => {
      const nextActiveMap = { ...prev.activeCustomGroupMap };
      if (groupId === null) {
        delete nextActiveMap[viewId];
      } else {
        nextActiveMap[viewId] = groupId;
      }

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_ACTIVE_CUSTOM_GROUP, JSON.stringify(nextActiveMap));
        }
      } catch {
        // ignore
      }

      return { activeCustomGroupMap: nextActiveMap };
    });
  },

  getActiveCustomGroup: (viewId: string) => get().activeCustomGroupMap[viewId] ?? null,

  setHideEmpty: (viewId: string, hide: boolean) => {
    set((prev) => {
      const nextHideMap = { ...prev.hideEmptyMap, [viewId]: hide };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_HIDE_EMPTY, JSON.stringify(nextHideMap));
        }
      } catch {
        // ignore
      }
      return { hideEmptyMap: nextHideMap };
    });
  },

  isHideEmpty: (viewId: string) => get().hideEmptyMap[viewId] ?? false,

  validateActiveCustomGroups: (validGroupIds: Set<string>) => {
    set((prev) => {
      let changed = false;
      const nextGroupByMap = { ...prev.groupByMap };
      const nextActiveMap = { ...prev.activeCustomGroupMap };

      for (const [viewId, groupId] of Object.entries(prev.activeCustomGroupMap)) {
        if (!validGroupIds.has(groupId)) {
          delete nextActiveMap[viewId];
          if (nextGroupByMap[viewId] === 'custom') {
            nextGroupByMap[viewId] = 'none';
          }
          changed = true;
        }
      }

      if (!changed) return prev;

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_GROUP_BY, JSON.stringify(nextGroupByMap));
          window.localStorage.setItem(STORAGE_KEY_ACTIVE_CUSTOM_GROUP, JSON.stringify(nextActiveMap));
        }
      } catch {
        // ignore
      }

      return {
        groupByMap: nextGroupByMap,
        activeCustomGroupMap: nextActiveMap,
      };
    });
  },
}));

export default useViewGroupStore;
