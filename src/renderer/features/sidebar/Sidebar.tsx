import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore, useSmartLists } from '../../stores/listStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { ListItem } from './ListItem.js';
import { CreateListModal } from '../lists/CreateListModal.js';
import { ListContextMenu, type ListContextMenuPosition } from '../lists/ListContextMenu.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAreaStore, useAreas } from '../../stores/areaStore.js';
import { CreateProjectModal } from '../projects/CreateProjectModal.js';
import { ProjectContextMenu, type ProjectContextMenuPosition } from '../projects/ProjectContextMenu.js';
import { CreateAreaModal } from '../areas/CreateAreaModal.js';
import { AreaContextMenu, type AreaContextMenuPosition } from '../areas/AreaContextMenu.js';
import { TagContextMenu, type TagContextMenuPosition } from '../tags/TagContextMenu.js';
import { TagEditModal } from '../tags/TagEditModal.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { List } from '@shared/types/List.js';
import type { Project } from '@shared/types/index.js';
import type { Area } from '@shared/types/Area.js';
import type { Tag } from '@shared/types/Tag.js';
import { useCountsStore } from '../../stores/countsStore.js';
import { isStalled } from '@shared/utils/project-health.js';
import { showPrompt } from '../../components/PromptDialog/PromptDialog.js';
import styles from './Sidebar.module.css';

interface NavView {
  id: string;
  label: string;
  icon: string;
  moduleName?: string;
}

const VIEWS: NavView[] = [
  { id: 'view_goals', label: 'Goals', icon: '🎯', moduleName: 'goals_habits' },
  { id: 'view_pomodoro', label: 'Pomodoro', icon: '⏱️', moduleName: 'pomodoro' },
];

const KNOWN_ICON_MAP: Record<string, string> = {
  Layers: '⚡',
  Archive: '📦',
  Clock: '⏳',
  inbox: '📥',
  today: '☀️',
  important: '⭐',
  planned: '📅',
  anytime: '⚡',
  someday: '📦',
  waiting_for: '⏳',
  all: '📋',
  completed: '✅',
};

function resolveListIcon(icon: string | null | undefined, smartType?: string | null): string | null {
  if (icon && KNOWN_ICON_MAP[icon]) {
    return KNOWN_ICON_MAP[icon];
  }
  if (!icon && smartType && KNOWN_ICON_MAP[smartType]) {
    return KNOWN_ICON_MAP[smartType];
  }
  return icon ?? null;
}

function AreaHeaderButton({
  area,
  isOpen,
  areaProjectsCount,
  onToggleExpand,
  onContextMenu,
  onSelectArea,
  onNewProject,
}: {
  area: Area;
  isOpen: boolean;
  areaProjectsCount: number;
  onToggleExpand: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onSelectArea: () => void;
  onNewProject: () => void;
}): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: `area:${area.id}`,
    data: {
      type: 'sidebar-item',
      id: `area:${area.id}`,
      areaId: area.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={`${styles.groupHeaderButton} ${isOver ? styles.groupDragOver : ''}`}
      onClick={onToggleExpand}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      onContextMenu={onContextMenu}
      aria-expanded={isOpen}
      aria-label={`Area ${area.name}, ${areaProjectsCount} projects`}
    >
      <span className={styles.groupIcon}>{area.icon || '📁'}</span>
      <span
        className={styles.groupName}
        title={`Open ${area.name} Overview`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectArea();
        }}
      >
        {area.name}
      </span>
      <span
        className={`${styles.groupChevron} ${
          !isOpen ? styles.groupChevronCollapsed : ''
        }`}
      >
        ▾
      </span>
      <div
        className={styles.sectionHeaderActions}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.sectionActionBtn}
          onClick={(e) => {
            e.stopPropagation();
            onNewProject();
          }}
          title={`New project in ${area.name}`}
          aria-label={`New project in ${area.name}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function Sidebar(): React.ReactElement {
  const { activeListId, setActiveListId, setSidebarVisible } = useAppStore();
  const { loadLists } = useListStore();
  const smartLists = useSmartLists();
  const { isEnabled, loadModules } = useModuleStore();
  const { counts, loadCounts } = useCountsStore();

  const {
    projectsById,
    selectedProjectId,
    setSelectedProjectId,
    loadProjects,
    deleteProject,
    archiveProject,
    updateProject,
    reorderProjects,
  } = useProjectStore();

  const tasksById = useTaskStore((state) => state.tasksById);

  const { tagsById, loadTags } = useTagStore();

  // Profile dropdown, identity, and toggle state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>('Local User');
  const [userAvatarEmoji, setUserAvatarEmoji] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-hiding scrollbar state
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 800);
  }, []);

  const getInitials = useCallback((name: string): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name.slice(0, 2) || 'U').toUpperCase();
  }, []);

  useEffect(() => {
    invoke<{ display_name?: string; avatar_emoji?: string | null }>(IPC.IDENTITY.GET)
      .then((res) => {
        if (res?.display_name) {
          setUserName(res.display_name);
        }
        if (res?.avatar_emoji) {
          setUserAvatarEmoji(res.avatar_emoji);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  // Modals and context menu state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<List | null>(null);
  const [contextMenuList, setContextMenuList] = useState<List | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<ListContextMenuPosition | null>(null);

  // Areas state
  const { loadAreas, deleteArea } = useAreaStore();
  const areas = useAreas();
  const [isCreateAreaModalOpen, setIsCreateAreaModalOpen] = useState(false);
  const [areaToEdit, setAreaToEdit] = useState<Area | null>(null);
  const [contextMenuArea, setContextMenuArea] = useState<Area | null>(null);
  const [contextMenuAreaPos, setContextMenuAreaPos] = useState<AreaContextMenuPosition | null>(null);
  const [dragOverAreaId, setDragOverAreaId] = useState<string | null>(null);
  const [initialProjectAreaId, setInitialProjectAreaId] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const [expandedAreaIds, setExpandedAreaIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('os11:sidebar_expanded_areas');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleAreaExpand = (areaId: string) => {
    setExpandedAreaIds((prev) => {
      const next = { ...prev, [areaId]: prev[areaId] === undefined ? false : !prev[areaId] };
      try {
        localStorage.setItem('os11:sidebar_expanded_areas', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const isAreaExpanded = (areaId: string) => {
    return expandedAreaIds[areaId] !== false;
  };

  // Projects modals and context menu state
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [contextMenuProject, setContextMenuProject] = useState<Project | null>(null);
  const [contextMenuProjectPos, setContextMenuProjectPos] = useState<ProjectContextMenuPosition | null>(null);

  // Tag context menu and edit modal state
  const [contextMenuTag, setContextMenuTag] = useState<Tag | null>(null);
  const [contextMenuTagPos, setContextMenuTagPos] = useState<TagContextMenuPosition | null>(null);
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const [isTagEditModalOpen, setIsTagEditModalOpen] = useState(false);

  // Section collapse persistence state (LISTS, PROJECTS, TAGS, VIEWS)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('os11:sidebar_collapsed_sections');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      try {
        localStorage.setItem('os11:sidebar_collapsed_sections', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleTagContextMenu = (e: React.MouseEvent, tag: Tag) => {
    e.preventDefault();
    setContextMenuTag(tag);
    setContextMenuTagPos({ x: e.clientX, y: e.clientY });
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (window.confirm(`Delete tag #${tag.name}? It will be removed from all tasks.`)) {
      if (activeListId === `tag:${tag.id}`) {
        setActiveListId('smart_my_day');
      }
      await useTagStore.getState().deleteTag(tag.id);
    }
  };

  // Drag-to-reorder state
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [draggingTopItemId, setDraggingTopItemId] = useState<string | null>(null);

  // Sidebar resizer state (180px - 280px)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLists();
    loadProjects();
    loadAreas();
    loadModules();
    loadTags();
    loadCounts();

    invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL)
      .then((res) => {
        if (res) {
          if (typeof res.sidebar_show_all_tasks === 'boolean') setShowAllTasks(res.sidebar_show_all_tasks);
          if (typeof res.sidebar_show_completed === 'boolean') setShowCompleted(res.sidebar_show_completed);
        }
      })
      .catch(() => {});

    const handleSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === 'sidebar_show_all_tasks') setShowAllTasks(Boolean(detail.value));
      if (detail?.key === 'sidebar_show_completed') setShowCompleted(Boolean(detail.value));
    };

    const handleOpenArea = () => {
      setAreaToEdit(null);
      setIsCreateAreaModalOpen(true);
    };
    const handleOpenProject = () => {
      setProjectToEdit(null);
      setIsCreateProjectModalOpen(true);
    };

    window.addEventListener('os11:settings-changed', handleSettingsChanged);
    window.addEventListener('open-create-area-modal', handleOpenArea);
    window.addEventListener('open-create-project-modal', handleOpenProject);

    return () => {
      window.removeEventListener('os11:settings-changed', handleSettingsChanged);
      window.removeEventListener('open-create-area-modal', handleOpenArea);
      window.removeEventListener('open-create-project-modal', handleOpenProject);
    };
  }, [loadLists, loadProjects, loadAreas, loadModules, loadTags, loadCounts]);

  useEffect(() => {
    loadCounts();
  }, [tasksById, loadCounts]);


  const projects = useMemo(
    () => (Object.values(projectsById) as Project[]).sort((a, b) => a.sort_order - b.sort_order),
    [projectsById]
  );
  const pinnedProjects = useMemo(
    () => projects.filter((p: Project) => (p.is_pinned ?? 0) === 1 && p.status !== 'archived'),
    [projects]
  );

  const projectAsList = useCallback(
    (project: Project): List => ({
      id: `project:${project.id}`,
      name: project.name,
      icon: project.icon ?? '📁',
      color: project.color ?? null,
      background_type: 'none',
      background_value: null,
      sort_order: project.sort_order,
      is_smart: 0,
      group_id: project.group_id ?? null,
      notification_enabled: 0,
      is_pinned: project.is_pinned ?? 0,
      pinned_sort_order: project.pinned_sort_order ?? 0,
      created_at: project.created_at,
      updated_at: project.updated_at,
    }),
    []
  );

  interface TopSectionItem {
    id: string;
    type: 'smart' | 'list' | 'project';
    rawId: string;
    order: number;
    listModel: List;
    originalProject?: Project;
  }

  const topSectionItems = useMemo<TopSectionItem[]>(() => {
    const items: TopSectionItem[] = [];

    for (const sl of smartLists) {
      if (sl.id === 'smart_all' && !showAllTasks) continue;
      if (sl.id === 'smart_completed' && !showCompleted) continue;
      if (sl.id === 'smart_anytime' && !isEnabled('anytime')) continue;
      if (sl.id === 'smart_someday' && !isEnabled('someday')) continue;
      if (sl.id === 'smart_waiting_for' && !isEnabled('waiting_for')) continue;

      items.push({
        id: sl.id,
        type: 'smart',
        rawId: sl.id,
        order: sl.pinned_sort_order ?? sl.sort_order,
        listModel: {
          ...sl,
          icon: resolveListIcon(sl.icon, sl.smart_type),
        },
      });
    }

    for (const pp of pinnedProjects) {
      items.push({
        id: `project:${pp.id}`,
        type: 'project',
        rawId: pp.id,
        order: pp.pinned_sort_order ?? pp.sort_order,
        listModel: projectAsList(pp),
        originalProject: pp,
      });
    }

    return items.sort((a, b) => a.order - b.order);
  }, [smartLists, pinnedProjects, projectAsList, showAllTasks, showCompleted, isEnabled]);

  const handleTogglePinList = async (list: List) => {
    const isCurrentlyPinned = Boolean(list.is_pinned);
    const maxOrder = topSectionItems.length > 0
      ? Math.max(...topSectionItems.map((i) => i.order))
      : 0;

    await useListStore.getState().updateList(list.id, {
      is_pinned: isCurrentlyPinned ? 0 : 1,
      pinned_sort_order: isCurrentlyPinned ? 0 : maxOrder + 1,
    });
  };

  const handleTogglePinProject = async (project: Project) => {
    const isCurrentlyPinned = Boolean(project.is_pinned);
    const maxOrder = topSectionItems.length > 0
      ? Math.max(...topSectionItems.map((i) => i.order))
      : 0;

    await updateProject(project.id, {
      is_pinned: isCurrentlyPinned ? 0 : 1,
      pinned_sort_order: isCurrentlyPinned ? 0 : maxOrder + 1,
    });
  };

  // Click-outside listener for profile menu
  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileRef.current &&
        !profileRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // Global shortcut: Ctrl+P / Ctrl+L (or Cmd+P / Cmd+L) to open Create Project modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        setProjectToEdit(null);
        setInitialProjectAreaId(areas[0]?.id ?? null);
        setIsCreateProjectModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [areas]);

  // Compute task count per list
  const getTaskCount = useCallback(
    (listId: string): number => {
      const today = new Date().toISOString().split('T')[0];
      const tasks = Object.values(tasksById).filter((t) => t.is_trashed === 0);

      switch (listId) {
        case 'list_inbox':
          return tasks.filter((t) => t.is_completed === 0 && ((t.area_id === null && t.project_id === null) || t.list_id === 'list_inbox')).length;
        case 'smart_my_day':
          return tasks.filter((t) => t.my_day_date === today && t.is_completed === 0).length;
        case 'smart_important':
          return tasks.filter((t) => t.is_starred === 1 && t.is_completed === 0).length;
        case 'smart_planned':
          return tasks.filter((t) => t.due_date !== null && t.is_completed === 0).length;
        case 'smart_anytime':
          return counts.anytime || tasks.filter((t) => t.is_completed === 0 && t.bucket === 'anytime').length;
        case 'smart_someday':
          return counts.someday || tasks.filter((t) => t.is_completed === 0 && t.bucket === 'someday').length;
        case 'smart_waiting_for':
          return counts.waitingFor || tasks.filter((t) => t.is_completed === 0 && Boolean(t.waiting_on)).length;
        case 'smart_all':
          return tasks.filter((t) => t.is_completed === 0 && t.parent_task_id === null).length;
        case 'smart_completed':
          return 0; // Completed list does not show a pending badge per FEEL UI
        default:
          return tasks.filter((t) => (t.list_id === listId || t.project_id === listId) && t.is_completed === 0).length;
      }
    },
    [tasksById, counts]
  );

  // Compute active loose task count per area
  const getAreaLooseTaskCount = useCallback(
    (areaId: string): number => {
      let count = 0;
      for (const task of Object.values(tasksById)) {
        if (
          task &&
          task.area_id === areaId &&
          task.project_id === null &&
          task.is_trashed === 0 &&
          task.is_completed === 0
        ) {
          count++;
        }
      }
      return count;
    },
    [tasksById]
  );

  // Compute active task count per tag
  const getTagTaskCount = useCallback(
    (tagId: string): number => {
      const taskTags = useTagStore.getState().taskTagsByTaskId;
      let count = 0;
      for (const [taskId, tagIds] of Object.entries(taskTags)) {
        if (tagIds.includes(tagId)) {
          const task = tasksById[taskId];
          if (task && task.is_trashed === 0 && task.is_completed === 0) {
            count++;
          }
        }
      }
      return count;
    },
    [tasksById]
  );

  // Drag resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const clampedWidth = Math.min(Math.max(e.clientX, 180), 280);
      document.documentElement.style.setProperty('--sidebar-width', `${clampedWidth}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Reset drag state when drag ends anywhere
  useEffect(() => {
    const handleDragEnd = () => {
      setDraggingListId(null);
      setDraggingProjectId(null);
      setDraggingTopItemId(null);
      setDragOverAreaId(null);
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  // Compute active task count for a project
  const getProjectTaskCount = useCallback(
    (projectId: string) => {
      let count = 0;
      for (const task of Object.values(tasksById)) {
        if (task && task.project_id === projectId && task.is_trashed === 0 && task.is_completed === 0) {
          count++;
        }
      }
      return count;
    },
    [tasksById]
  );

  // Project context menu handler
  const handleProjectContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setContextMenuProject(project);
    setContextMenuProjectPos({ x: e.clientX, y: e.clientY });
  };

  // Drag over handler for top section items
  const handleTopSectionDragOver = (e: React.DragEvent, targetId: string) => {
    if (draggingTopItemId) {
      e.preventDefault();
    } else if (targetId === 'smart_my_day') {
      e.preventDefault();
    } else if (e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
    }
  };

  // Reorder top section on drop, or assign task if task is dropped
  const handleTopSectionDrop = async (e: React.DragEvent, targetItem: TopSectionItem) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');

    if (taskId && !draggingTopItemId && !draggingListId && !draggingProjectId) {
      if (targetItem.id === 'smart_my_day') {
        const today = new Date().toISOString().split('T')[0];
        await useTaskStore.getState().updateTask({ id: taskId, my_day_date: today });
      } else if (targetItem.id === 'smart_anytime') {
        await useTaskStore.getState().setBucket(taskId, 'anytime');
      } else if (targetItem.id === 'smart_someday') {
        await useTaskStore.getState().setBucket(taskId, 'someday');
      } else if (targetItem.id === 'smart_waiting_for') {
        const person = await showPrompt({
          title: 'Waiting For',
          message: 'Waiting on whom or what?',
          placeholder: 'e.g. Sarah for approval',
        });
        if (person && person.trim()) {
          await useTaskStore.getState().setWaiting({ taskId, waitingOn: person.trim() });
        }
      } else if (targetItem.id === 'list_inbox') {
        await useTaskStore.getState().updateTask({ id: taskId, list_id: 'list_inbox', project_id: null, area_id: null });
      } else if (targetItem.type === 'project') {
        const proj = projectsById[targetItem.rawId];
        await useTaskStore.getState().updateTask({ id: taskId, project_id: targetItem.rawId, area_id: proj?.area_id ?? null });
      } else if (targetItem.type === 'list') {
        await useTaskStore.getState().updateTask({ id: taskId, list_id: targetItem.rawId });
      }
      return;
    }

    if (!draggingTopItemId || draggingTopItemId === targetItem.id) {
      setDraggingTopItemId(null);
      setDraggingListId(null);
      setDraggingProjectId(null);
      return;
    }

    const currentItems = [...topSectionItems];
    const dragIdx = currentItems.findIndex((i) => i.id === draggingTopItemId);
    const targetIdx = currentItems.findIndex((i) => i.id === targetItem.id);

    if (dragIdx === -1 || targetIdx === -1) {
      setDraggingTopItemId(null);
      setDraggingListId(null);
      setDraggingProjectId(null);
      return;
    }

    const [moved] = currentItems.splice(dragIdx, 1);
    currentItems.splice(targetIdx, 0, moved);

    for (let index = 0; index < currentItems.length; index++) {
      const item = currentItems[index];
      if (item.type === 'smart') {
        useListStore.getState().updateList(item.rawId, {
          sort_order: index,
          pinned_sort_order: index,
        });
      } else if (item.type === 'list') {
        useListStore.getState().updateList(item.rawId, {
          pinned_sort_order: index,
        });
      } else if (item.type === 'project') {
        updateProject(item.rawId, {
          pinned_sort_order: index,
        });
      }
    }

    setDraggingTopItemId(null);
    setDraggingListId(null);
    setDraggingProjectId(null);
  };

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, list: List) => {
    e.preventDefault();
    setContextMenuList(list);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };



  // Reorder projects on drop, or assign task to project if task is dropped
  const handleProjectDrop = async (targetProjectId: string) => {
    if (!draggingProjectId || draggingProjectId === targetProjectId) return;

    const projA = projectsById[draggingProjectId];
    const projB = projectsById[targetProjectId];

    if (projA && projB && projA.group_id !== projB.group_id) {
      await updateProject(draggingProjectId, { group_id: projB.group_id });
    }

    const currentOrder = [...projects];
    const dragIdx = currentOrder.findIndex((p) => p.id === draggingProjectId);
    const targetIdx = currentOrder.findIndex((p) => p.id === targetProjectId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const [moved] = currentOrder.splice(dragIdx, 1);
    currentOrder.splice(targetIdx, 0, moved);

    const updates = currentOrder.map((p, index) => ({
      id: p.id,
      sortOrder: index,
    }));

    reorderProjects(updates);
    setDraggingProjectId(null);
  };

  const handleProjectItemDrop = async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || (window as any).__draggingTaskId;
    if (taskId && !draggingProjectId && !draggingListId) {
      const targetProject = projectsById[targetProjectId];
      await useTaskStore.getState().updateTask({
        id: taskId,
        project_id: targetProjectId,
        area_id: targetProject?.area_id ?? null,
      });
      return;
    }
    handleProjectDrop(targetProjectId);
  };

  const handleAreaContextMenu = (e: React.MouseEvent, area: Area) => {
    e.preventDefault();
    setContextMenuArea(area);
    setContextMenuAreaPos({ x: e.clientX, y: e.clientY });
  };



  // Duplicate list handler
  const handleDuplicateList = async (list: List) => {
    try {
      const created = await useListStore.getState().createList({
        name: `${list.name} (Copy)`,
        icon: list.icon,
        color: list.color,
        group_id: list.group_id,
      });

      // Duplicate all tasks in this list
      const tasksInList = Object.values(tasksById).filter(
        (t) => t.list_id === list.id && t.is_trashed === 0
      );
      for (const t of tasksInList) {
        useTaskStore.getState().createTask({
          title: t.title,
          notes: t.notes,
          list_id: created.id,
          priority: t.priority,
          due_date: t.due_date,
          due_time: t.due_time,
          all_day: t.all_day === 1,
        });
      }
    } catch (err) {
      console.error('Failed to duplicate list:', err);
    }
  };

  // Export list handler
  const handleExportList = (list: List) => {
    const tasksInList = Object.values(tasksById).filter(
      (t) => t.list_id === list.id && t.is_trashed === 0
    );
    const json = JSON.stringify({ list, tasks: tasksInList }, null, 2);
    navigator.clipboard.writeText(json);
  };

  // Filter views based on moduleStore.isEnabled()
  const enabledViews = VIEWS.filter((view) => {
    if (!view.moduleName) return true;
    return isEnabled(view.moduleName);
  });

  return (
    <aside
      ref={sidebarRef}
      className={styles.sidebarContainer}
      aria-label="Application Sidebar"
    >
      {/* Top Profile Header & Collapse Toggle */}
      <div className={styles.header}>
        <div
          ref={profileRef}
          className={styles.profileTrigger}
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsProfileMenuOpen((prev) => !prev);
            }
          }}
          role="button"
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={isProfileMenuOpen}
          aria-label="User profile and menu"
          title={userName}
        >
          <div className={styles.avatar}>{userAvatarEmoji || getInitials(userName)}</div>
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{userName}</span>
          </div>
          <span className={styles.chevron}>{isProfileMenuOpen ? '▴' : '▾'}</span>
        </div>

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setSidebarVisible(false)}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>

        {/* Profile Dropdown Menu */}
        {isProfileMenuOpen && (
          <div ref={menuRef} className={styles.profileMenu} role="menu" aria-label="Profile navigation options">
            <button
              type="button"
              className={`${styles.menuItem} ${activeListId === 'view_dashboard' ? styles.menuItemActive : ''}`}
              onClick={() => {
                setActiveListId('view_dashboard');
                setIsProfileMenuOpen(false);
              }}
              role="menuitem"
            >
              <span className={styles.menuItemIcon}>📊</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`${styles.menuItem} ${activeListId === 'view_settings' ? styles.menuItemActive : ''}`}
              onClick={() => {
                setActiveListId('view_settings');
                setIsProfileMenuOpen(false);
              }}
              role="menuitem"
            >
              <span className={styles.menuItemIcon}>⚙️</span>
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>

      <div
        className={`${styles.scrollWrap} ${isScrolling ? styles.scrollWrapScrolling : ''}`}
        onScroll={handleScroll}
      >
        {/* Top Section: Smart Lists, Pinned Lists & Pinned Projects */}
        <div className={styles.smartListSection}>
          {topSectionItems.map((item) => {
            const isProject = item.type === 'project';
            const isActive = isProject
              ? activeListId === item.id || (activeListId === 'view_projects' && selectedProjectId === item.rawId)
              : activeListId === item.id;
            const count = isProject ? getProjectTaskCount(item.rawId) : getTaskCount(item.rawId);

            return (
              <ListItem
                key={item.id}
                droppableId={isProject ? `project:${item.rawId}` : `list:${item.rawId}`}
                list={item.listModel}
                isActive={isActive}
                taskCount={count}
                isStalled={
                  isProject && item.originalProject
                    ? isStalled(item.originalProject, Object.values(tasksById))
                    : false
                }
                onClick={() => {
                  if (isProject) {
                    setSelectedProjectId(item.rawId);
                    setActiveListId(item.id);
                  } else {
                    setActiveListId(item.id);
                  }
                }}
                onContextMenu={(e) => {
                  if (isProject && item.originalProject) {
                    handleProjectContextMenu(e, item.originalProject);
                  } else {
                    handleContextMenu(e, item.listModel);
                  }
                }}
                isDraggable
                onDragStart={(_e) => {
                  setDraggingTopItemId(item.id);
                  if (isProject) {
                    setDraggingProjectId(item.rawId);
                  } else {
                    setDraggingListId(item.rawId);
                  }
                }}
                onDragOver={(e) => handleTopSectionDragOver(e, item.id)}
                onDrop={(e) => handleTopSectionDrop(e, item)}
              />
            );
          })}
        </div>

        {/* Areas & Projects Section (Single Area: no Area header) */}
        {areas.length <= 1 && (
          <div className={styles.projectsSection}>
            {areas[0] && getAreaLooseTaskCount(areas[0].id) > 0 && (
              <ListItem
                key={`area_loose_${areas[0].id}`}
                droppableId={`area:${areas[0].id}`}
                list={{
                  id: `area:${areas[0].id}`,
                  name: 'Tasks',
                  icon: '📋',
                  color: null,
                  background_type: 'none',
                  background_value: null,
                  sort_order: -1,
                  is_smart: 0,
                  notification_enabled: 0,
                  created_at: areas[0].created_at,
                  updated_at: areas[0].updated_at,
                }}
                isActive={activeListId === `area:${areas[0].id}`}
                taskCount={getAreaLooseTaskCount(areas[0].id)}
                onClick={() => setActiveListId(`area:${areas[0].id}`)}
                onContextMenu={(e) => handleAreaContextMenu(e, areas[0])}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain') || (window as any).__draggingTaskId;
                  if (taskId) {
                    await useTaskStore.getState().updateTask({
                      id: taskId,
                      area_id: areas[0].id,
                      project_id: null,
                    });
                  }
                }}
              />
            )}

            {projects
              .filter((p) => p.status !== 'archived' && (p.is_pinned ?? 0) === 0)
              .map((project: Project) => (
                <ListItem
                  key={project.id}
                  droppableId={`project:${project.id}`}
                  list={projectAsList(project)}
                  isActive={
                    activeListId === `project:${project.id}` ||
                    (activeListId === 'view_projects' && selectedProjectId === project.id)
                  }
                  taskCount={getProjectTaskCount(project.id)}
                  isStalled={isStalled(project, Object.values(tasksById))}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setActiveListId(`project:${project.id}`);
                  }}
                  onContextMenu={(e) => handleProjectContextMenu(e, project)}
                  isDraggable
                  onDragStart={(_e) => setDraggingProjectId(project.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => handleProjectItemDrop(e, project.id)}
                />
              ))}
          </div>
        )}

        {/* Areas & Projects Section (Multi-Area: collapsible Area sections) */}
        {areas.length >= 2 && (
          <div className={styles.projectsSection}>
            {areas.map((area) => {
              const areaProjects = projects.filter(
                (p) => p.area_id === area.id && p.status !== 'archived' && (p.is_pinned ?? 0) === 0
              );
              const isOpen = isAreaExpanded(area.id);
              const isDragTarget = dragOverAreaId === area.id;

              return (
                <div
                  key={`area_group_${area.id}`}
                  className={`${styles.listGroupBlock} ${isDragTarget ? styles.groupDragOver : ''}`}
                  onDragOver={(e) => {
                    if (draggingProjectId || e.dataTransfer.types.includes('text/plain')) {
                      e.preventDefault();
                      setDragOverAreaId(area.id);
                    }
                  }}
                  onDragLeave={() => setDragOverAreaId((curr) => (curr === area.id ? null : curr))}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDragOverAreaId(null);
                    if (draggingProjectId) {
                      await updateProject(draggingProjectId, { area_id: area.id });
                      setDraggingProjectId(null);
                      return;
                    }
                    const taskId = e.dataTransfer.getData('text/plain') || (window as any).__draggingTaskId;
                    if (taskId) {
                      await useTaskStore.getState().updateTask({
                        id: taskId,
                        area_id: area.id,
                        project_id: null,
                      });
                    }
                  }}
                >
                  <AreaHeaderButton
                    area={area}
                    isOpen={isOpen}
                    areaProjectsCount={areaProjects.length}
                    onToggleExpand={() => toggleAreaExpand(area.id)}
                    onContextMenu={(e) => handleAreaContextMenu(e, area)}
                    onSelectArea={() => setActiveListId(`area:${area.id}`)}
                    onNewProject={() => {
                      setInitialProjectAreaId(area.id);
                      setProjectToEdit(null);
                      setIsCreateProjectModalOpen(true);
                    }}
                  />

                  {isOpen && (
                    <div className={styles.groupItems}>
                      {/* Area projects */}
                      {areaProjects.map((project: Project) => (
                        <ListItem
                          key={project.id}
                          droppableId={`project:${project.id}`}
                          list={projectAsList(project)}
                          isActive={
                            activeListId === `project:${project.id}` ||
                            (activeListId === 'view_projects' && selectedProjectId === project.id)
                          }
                          taskCount={getProjectTaskCount(project.id)}
                          isStalled={isStalled(project, Object.values(tasksById))}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setActiveListId(`project:${project.id}`);
                          }}
                          onContextMenu={(e) => handleProjectContextMenu(e, project)}
                          isDraggable
                          onDragStart={(_e) => setDraggingProjectId(project.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => handleProjectItemDrop(e, project.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tags Section - only shown when user has created tags */}
        {Object.values(tagsById).length > 0 && (
          <>
            <div
              className={styles.sectionLabel}
              onClick={() => toggleSection('tags')}
              role="button"
              tabIndex={0}
              aria-expanded={!collapsedSections['tags']}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection('tags');
                }
              }}
            >
              <span>Tags</span>
            </div>

            <div
              className={styles.collapsibleWrapper}
              data-collapsed={collapsedSections['tags'] ? 'true' : 'false'}
            >
              <div className={styles.collapsibleInner}>
                {Object.values(tagsById).map((tag) => {
                  const pseudoList: List = {
                    id: `tag:${tag.id}`,
                    name: `#${tag.name}`,
                    icon: null,
                    color: tag.color ?? 'var(--tag-gray)',
                    background_type: 'none',
                    background_value: null,
                    sort_order: tag.sort_order,
                    is_smart: 0,
                    notification_enabled: 0,
                    created_at: tag.created_at,
                    updated_at: tag.created_at,
                  };
                  return (
                    <ListItem
                      key={tag.id}
                      droppableId={`tag:${tag.id}`}
                      list={pseudoList}
                      isActive={activeListId === `tag:${tag.id}`}
                      taskCount={getTagTaskCount(tag.id)}
                      onClick={(id) => setActiveListId(id)}
                      onContextMenu={(e) => handleTagContextMenu(e, tag)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData('text/plain') || (window as any).__draggingTaskId;
                        if (taskId) {
                          await useTagStore.getState().addTagToTask(taskId, tag.id);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Views Section */}
        {enabledViews.length > 0 && (
          <>
            <div
              className={styles.sectionLabel}
              onClick={() => toggleSection('views')}
              role="button"
              tabIndex={0}
              aria-expanded={!collapsedSections['views']}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection('views');
                }
              }}
            >
              <span>Views</span>
            </div>

            <div
              className={styles.collapsibleWrapper}
              data-collapsed={collapsedSections['views'] ? 'true' : 'false'}
            >
              <div className={styles.collapsibleInner}>
                {enabledViews.map((item) => {
                  const isActive = activeListId === item.id;
                  const pseudoList: List = {
                    id: item.id,
                    name: item.label,
                    icon: item.icon,
                    color: null,
                    background_type: 'none',
                    background_value: null,
                    sort_order: 0,
                    is_smart: 1,
                    notification_enabled: 0,
                    created_at: '',
                    updated_at: '',
                  };
                  return (
                    <ListItem
                      key={item.id}
                      list={pseudoList}
                      isActive={isActive}
                      onClick={(id) => setActiveListId(id)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Bar with + Button */}
      <div className={styles.bottomBar}>
        {areas.length <= 1 ? (
          <>
            <button
              type="button"
              className={styles.newListButton}
              onClick={() => {
                setInitialProjectAreaId(areas[0]?.id ?? null);
                setProjectToEdit(null);
                setIsCreateProjectModalOpen(true);
              }}
              title={isMac ? 'New project (Cmd + P)' : 'New project (Ctrl + P)'}
              aria-label="New project"
            >
              <svg
                className={styles.newListIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className={styles.newListLabel}>New project</span>
            </button>
            <button
              type="button"
              className={styles.newGroupButton}
              onClick={() => {
                setAreaToEdit(null);
                setIsCreateAreaModalOpen(true);
              }}
              title="New area"
              aria-label="New area"
            >
              <svg
                className={styles.newListIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.newListButton}
            onClick={() => {
              setAreaToEdit(null);
              setIsCreateAreaModalOpen(true);
            }}
            title="New area"
            aria-label="New area"
          >
            <svg
              className={styles.newListIcon}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className={styles.newListLabel}>New area</span>
          </button>
        )}
      </div>

      {/* Drag Resizer on right border */}
      <div
        className={`${styles.resizer} ${isResizing ? styles.resizerActive : ''}`}
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize sidebar"
      />

      {/* Create / Edit List Modal */}
      <CreateListModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        listToEdit={listToEdit}
      />

      {/* Right-click Context Menu */}
      {contextMenuList && (
        <ListContextMenu
          list={contextMenuList}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuList(null);
            setContextMenuPos(null);
          }}
          onEdit={(l) => {
            setListToEdit(l);
            setIsCreateModalOpen(true);
          }}
          onDuplicate={handleDuplicateList}
          onExport={handleExportList}
          onTogglePin={handleTogglePinList}
          onDelete={(l) => {
            if (activeListId === l.id) {
              setActiveListId('smart_my_day');
            }
            useListStore.getState().deleteList(l.id);
          }}
        />
      )}

      {/* Create / Edit Project Modal */}
      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onOpenChange={(open) => {
          setIsCreateProjectModalOpen(open);
          if (!open) {
            setProjectToEdit(null);
            setInitialProjectAreaId(null);
          }
        }}
        projectToEdit={projectToEdit}
        initialAreaId={initialProjectAreaId}
        onCreated={(proj) => {
          setSelectedProjectId(proj.id);
          setActiveListId(`project:${proj.id}`);
        }}
        onSaved={(proj) => {
          if (selectedProjectId === proj.id) {
            setSelectedProjectId(proj.id);
          }
        }}
      />

      {/* Right-click Context Menu for Projects */}
      {contextMenuProject && (
        <ProjectContextMenu
          project={contextMenuProject}
          position={contextMenuProjectPos}
          onClose={() => {
            setContextMenuProject(null);
            setContextMenuProjectPos(null);
          }}
          onEdit={(proj) => {
            setProjectToEdit(proj);
            setIsCreateProjectModalOpen(true);
          }}
          onArchive={async (proj) => {
            await archiveProject(proj.id);
          }}
          onTogglePin={handleTogglePinProject}
          onMoveToGroup={async (proj, targetGroupId) => {
            await updateProject(proj.id, { group_id: targetGroupId, area_id: targetGroupId });
          }}
          onCreateGroupAndMove={(_proj) => {
            setAreaToEdit(null);
            setIsCreateAreaModalOpen(true);
          }}
          onDelete={async (proj) => {
            await deleteProject(proj.id);
            if (activeListId === `project:${proj.id}`) {
              setActiveListId('smart_my_day');
            }
          }}
        />
      )}

      {/* Right-click Context Menu for Tags */}
      {contextMenuTag && (
        <TagContextMenu
          tag={contextMenuTag}
          position={contextMenuTagPos}
          onClose={() => {
            setContextMenuTag(null);
            setContextMenuTagPos(null);
          }}
          onEdit={(tag) => {
            setTagToEdit(tag);
            setIsTagEditModalOpen(true);
          }}
          onDelete={handleDeleteTag}
        />
      )}

      {/* Edit Tag Modal */}
      <TagEditModal
        open={isTagEditModalOpen}
        onOpenChange={(open) => {
          setIsTagEditModalOpen(open);
          if (!open) setTagToEdit(null);
        }}
        tagToEdit={tagToEdit}
      />

      {/* Create / Edit Area Modal */}
      <CreateAreaModal
        open={isCreateAreaModalOpen}
        onOpenChange={(open) => {
          setIsCreateAreaModalOpen(open);
          if (!open) setAreaToEdit(null);
        }}
        areaToEdit={areaToEdit}
      />

      {/* Right-click Context Menu for Areas */}
      {contextMenuArea && (
        <AreaContextMenu
          area={contextMenuArea}
          position={contextMenuAreaPos}
          onClose={() => {
            setContextMenuArea(null);
            setContextMenuAreaPos(null);
          }}
          onRename={(area) => {
            setAreaToEdit(area);
            setIsCreateAreaModalOpen(true);
          }}
          onNewProject={(area) => {
            setInitialProjectAreaId(area.id);
            setProjectToEdit(null);
            setIsCreateProjectModalOpen(true);
          }}
          canDelete={
            areas.length > 1 &&
            !Object.values(projectsById).some(
              (p) => p.area_id === contextMenuArea.id && p.status !== 'archived'
            ) &&
            !Object.values(tasksById).some(
              (t) => t.area_id === contextMenuArea.id && t.project_id === null && t.is_trashed === 0
            )
          }
          deleteDisabledReason={
            areas.length <= 1
              ? 'At least one area must always exist.'
              : "Move or delete this Area's projects and loose tasks first."
          }
          onDelete={async (area) => {
            await deleteArea(area.id);
            if (activeListId === `area:${area.id}`) {
              setActiveListId('smart_my_day');
            }
          }}
        />
      )}
    </aside>
  );
}

export default Sidebar;
