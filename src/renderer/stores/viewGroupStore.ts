import { create } from 'zustand';

export type GroupByOption =
  | 'none'
  | 'time'
  | 'date'
  | 'tag'
  | 'project'
  | 'area'
  | 'priority';

export const GROUP_BY_LABELS: Record<GroupByOption, string> = {
  none: 'None',
  time: 'Time',
  date: 'Date',
  tag: 'Tag',
  project: 'Project',
  area: 'Area',
  priority: 'Priority',
};

const VALID_OPTIONS = new Set<string>([
  'none',
  'time',
  'date',
  'tag',
  'project',
  'area',
  'priority',
]);

const STORAGE_KEY_GROUP_BY = 'os11:view-group-by';
const STORAGE_KEY_VISIBLE = 'os11:view-group-visible';

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

export interface ViewGroupState {
  groupByMap: Record<string, GroupByOption>;
  visibleMap: Record<string, boolean>;

  setGroupBy: (viewId: string, option: GroupByOption) => void;
  toggleVisible: (viewId: string) => void;
  setVisible: (viewId: string, visible: boolean) => void;
  getGroupBy: (viewId: string) => GroupByOption;
  isVisible: (viewId: string) => boolean;
}

export const useViewGroupStore = create<ViewGroupState>((set, get) => ({
  groupByMap: getInitialGroupByMap(),
  visibleMap: getInitialVisibilityMap(),

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
}));

export default useViewGroupStore;
