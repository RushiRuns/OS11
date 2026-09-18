import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore, useSmartLists, useUserLists, useListGroups } from '../../stores/listStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { ListItem } from './ListItem.js';
import { CreateListModal } from '../lists/CreateListModal.js';
import { ListGroupModal } from '../lists/ListGroupModal.js';
import { ListContextMenu, type ListContextMenuPosition } from '../lists/ListContextMenu.js';
import { ListGroupContextMenu } from '../lists/ListGroupContextMenu.js';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { List } from '@shared/types/List.js';
import type { ListGroup } from '@shared/types/ListGroup.js';
import styles from './Sidebar.module.css';

interface NavView {
  id: string;
  label: string;
  icon: string;
  moduleName?: string;
}

const VIEWS: NavView[] = [
  { id: 'view_agenda', label: 'Agenda', icon: '📆', moduleName: 'agenda' },
  { id: 'view_projects', label: 'Projects', icon: '📁', moduleName: 'project_management' },
  { id: 'view_pomodoro', label: 'Pomodoro', icon: '⏱️', moduleName: 'pomodoro' },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export function Sidebar(): React.ReactElement {
  const { activeListId, setActiveListId, setSidebarVisible } = useAppStore();
  const { loadLists } = useListStore();
  const smartLists = useSmartLists();
  const userLists = useUserLists();
  const listGroups = useListGroups();
  const { isEnabled, loadModules } = useModuleStore();

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
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<List | null>(null);
  const [groupToEdit, setGroupToEdit] = useState<ListGroup | null>(null);
  const [contextMenuList, setContextMenuList] = useState<List | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<ListContextMenuPosition | null>(null);
  const [contextMenuGroup, setContextMenuGroup] = useState<ListGroup | null>(null);
  const [contextMenuGroupPos, setContextMenuGroupPos] = useState<ListContextMenuPosition | null>(null);

  // Folder collapse and drag-to-reorder state
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [isDragOverRootLists, setIsDragOverRootLists] = useState(false);

  // Sidebar resizer state (180px - 280px)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLists();
    loadModules();
    loadTags();
  }, [loadLists, loadModules, loadTags]);

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

  // Global shortcut: Ctrl+L (or Cmd+L) to open Create List modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setListToEdit(null);
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute task count per list
  const getTaskCount = useCallback(
    (listId: string): number => {
      const today = new Date().toISOString().split('T')[0];
      const tasks = Object.values(tasksById).filter((t) => t.is_trashed === 0);

      switch (listId) {
        case 'smart_my_day':
          return tasks.filter((t) => t.my_day_date === today && t.is_completed === 0).length;
        case 'smart_important':
          return tasks.filter((t) => t.is_starred === 1 && t.is_completed === 0).length;
        case 'smart_planned':
          return tasks.filter((t) => t.due_date !== null && t.is_completed === 0).length;
        case 'smart_all':
          return tasks.filter((t) => t.is_completed === 0 && t.parent_task_id === null).length;
        case 'smart_completed':
          return 0; // Completed list does not show a pending badge per FEEL UI
        default:
          return tasks.filter((t) => t.list_id === listId && t.is_completed === 0).length;
      }
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
    };
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  // Drag over handler for smart lists (allow dropping smart list or task onto My Day)
  const handleSmartListDragOver = (e: React.DragEvent, targetListId: string) => {
    if (draggingListId) {
      if (smartLists.some((l) => l.id === draggingListId)) {
        e.preventDefault();
      }
    } else if (targetListId === 'smart_my_day') {
      e.preventDefault();
    }
  };

  // Reorder smart lists on drop, or assign task to My Day if task is dropped
  const handleSmartListDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && !draggingListId) {
      if (targetListId === 'smart_my_day') {
        const today = new Date().toISOString().split('T')[0];
        await useTaskStore.getState().updateTask({ id: taskId, my_day_date: today });
      }
      return;
    }

    if (!draggingListId || draggingListId === targetListId) return;

    const currentOrder = [...smartLists];
    const dragIdx = currentOrder.findIndex((l) => l.id === draggingListId);
    const targetIdx = currentOrder.findIndex((l) => l.id === targetListId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const [moved] = currentOrder.splice(dragIdx, 1);
    currentOrder.splice(targetIdx, 0, moved);

    const updates = currentOrder.map((l, index) => ({
      id: l.id,
      sortOrder: index,
    }));

    useListStore.getState().reorderLists(updates);
    setDraggingListId(null);
  };

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, list: List) => {
    e.preventDefault();
    setContextMenuList(list);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Reorder user lists on drop, or move task to list if task is dropped
  const handleDrop = async (targetListId: string) => {
    if (!draggingListId || draggingListId === targetListId) return;

    const listA = useListStore.getState().listsById[draggingListId];
    const listB = useListStore.getState().listsById[targetListId];

    // If moving between different groups or in/out of a group
    if (listA && listB && listA.group_id !== listB.group_id) {
      await useListStore.getState().updateList(draggingListId, { group_id: listB.group_id });
    }

    const currentOrder = [...userLists];
    const dragIdx = currentOrder.findIndex((l) => l.id === draggingListId);
    const targetIdx = currentOrder.findIndex((l) => l.id === targetListId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const [moved] = currentOrder.splice(dragIdx, 1);
    currentOrder.splice(targetIdx, 0, moved);

    const updates = currentOrder.map((l, index) => ({
      id: l.id,
      sortOrder: index,
    }));

    useListStore.getState().reorderLists(updates);
    setDraggingListId(null);
  };

  const handleItemDrop = async (e: React.DragEvent, targetListId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && !draggingListId) {
      await useTaskStore.getState().updateTask({ id: taskId, list_id: targetListId });
      return;
    }
    handleDrop(targetListId);
  };

  // Move list into a folder by dropping onto folder header
  const handleDropOnGroup = async (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);

    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && !draggingListId) {
      return;
    }

    if (draggingListId) {
      const list = useListStore.getState().listsById[draggingListId];
      if (list && list.group_id !== targetGroupId) {
        await useListStore.getState().updateList(draggingListId, { group_id: targetGroupId });
      }
      // Ensure target folder is expanded so member list is visible
      setExpandedGroupIds((prev) => ({ ...prev, [targetGroupId]: true }));
      setDraggingListId(null);
    }
  };

  // Move list out of folder into root lists by dropping onto Lists header
  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverRootLists(false);

    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && !draggingListId) {
      return;
    }

    if (draggingListId) {
      const list = useListStore.getState().listsById[draggingListId];
      if (list && list.group_id !== null) {
        await useListStore.getState().updateList(draggingListId, { group_id: null });
      }
      setDraggingListId(null);
    }
  };

  // Toggle folder expansion (defaults to true / expanded)
  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((prev) => ({
      ...prev,
      [groupId]: prev[groupId] !== undefined ? !prev[groupId] : false,
    }));
  };

  const isGroupExpanded = (groupId: string): boolean => {
    return expandedGroupIds[groupId] !== false;
  };

  const handleGroupContextMenu = (e: React.MouseEvent, group: ListGroup) => {
    e.preventDefault();
    setContextMenuGroup(group);
    setContextMenuGroupPos({ x: e.clientX, y: e.clientY });
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
        {/* Flat & Reorderable Smart Lists */}
        <div className={styles.smartListSection}>
          {smartLists.map((list) => (
            <ListItem
              key={list.id}
              list={list}
              isActive={activeListId === list.id}
              taskCount={getTaskCount(list.id)}
              onClick={(id) => setActiveListId(id)}
              isDraggable
              onDragStart={(_e, id) => setDraggingListId(id)}
              onDragOver={(e) => handleSmartListDragOver(e, list.id)}
              onDrop={(e, id) => handleSmartListDrop(e, id)}
            />
          ))}
        </div>

        {/* User Lists Section */}
        <div
          className={`${styles.sectionLabel} ${isDragOverRootLists ? styles.rootListsDragOver : ''}`}
          onDragOver={(e) => {
            if (draggingListId) {
              e.preventDefault();
              setIsDragOverRootLists(true);
            }
          }}
          onDragLeave={() => setIsDragOverRootLists(false)}
          onDrop={handleDropOnRoot}
        >
          <span>Lists</span>
          <button
            type="button"
            className={styles.sectionActionBtn}
            onClick={() => {
              setListToEdit(null);
              setIsCreateModalOpen(true);
            }}
            title="New list"
          >
            +
          </button>
        </div>

        {/* Ungrouped User Lists */}
        {userLists
          .filter((l) => !l.group_id)
          .map((list) => (
            <ListItem
              key={list.id}
              list={list}
              isActive={activeListId === list.id}
              taskCount={getTaskCount(list.id)}
              onClick={(id) => setActiveListId(id)}
              onContextMenu={handleContextMenu}
              isDraggable
              onDragStart={(_e, id) => setDraggingListId(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e, id) => handleItemDrop(e, id)}
            />
          ))}

        {/* Grouped User Lists */}
        {listGroups.map((group) => {
          const listsInGroup = userLists.filter((l) => l.group_id === group.id);
          const isOpen = isGroupExpanded(group.id);
          const isDragTarget = dragOverGroupId === group.id;

          return (
            <div
              key={group.id}
              className={`${styles.listGroupBlock} ${isDragTarget ? styles.groupDragOver : ''}`}
              onDragOver={(e) => {
                if (draggingListId) {
                  e.preventDefault();
                  setDragOverGroupId(group.id);
                }
              }}
              onDragLeave={() => setDragOverGroupId((curr) => (curr === group.id ? null : curr))}
              onDrop={(e) => handleDropOnGroup(e, group.id)}
            >
              <button
                type="button"
                className={styles.groupHeaderButton}
                onClick={() => toggleGroup(group.id)}
                onContextMenu={(e) => handleGroupContextMenu(e, group)}
                aria-expanded={isOpen}
                aria-label={`Folder ${group.name}, ${listsInGroup.length} lists`}
              >
                <span className={styles.groupIcon}>📁</span>
                <span className={styles.groupName}>{group.name}</span>
                <span
                  className={`${styles.groupChevron} ${
                    !isOpen ? styles.groupChevronCollapsed : ''
                  }`}
                >
                  ▾
                </span>
              </button>

              {isOpen && (
                <div className={styles.groupItems}>
                  {listsInGroup.map((list) => (
                    <ListItem
                      key={list.id}
                      list={list}
                      isActive={activeListId === list.id}
                      taskCount={getTaskCount(list.id)}
                      onClick={(id) => setActiveListId(id)}
                      onContextMenu={handleContextMenu}
                      isDraggable
                      onDragStart={(_e, id) => setDraggingListId(id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e, id) => handleItemDrop(e, id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Tags Section */}
        {Object.values(tagsById).length > 0 && (
          <>
            <div className={styles.sectionLabel}>Tags</div>
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
                  list={pseudoList}
                  isActive={activeListId === `tag:${tag.id}`}
                  taskCount={getTagTaskCount(tag.id)}
                  onClick={(id) => setActiveListId(id)}
                />
              );
            })}
          </>
        )}

        {/* Views Section (omits disabled modules per Phase 6 spec) */}
        {enabledViews.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Views</div>
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
          </>
        )}
      </div>

      {/* Bottom Bar with + Button */}
      <div className={styles.bottomBar}>
        <button
          type="button"
          className={styles.newListButton}
          onClick={() => {
            setListToEdit(null);
            setIsCreateModalOpen(true);
          }}
          title={isMac ? 'New list (Cmd + L)' : 'New list (Ctrl + L)'}
          aria-label="New list"
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
          <span className={styles.newListLabel}>New list</span>
        </button>

        <button
          type="button"
          className={styles.newGroupButton}
          onClick={() => setIsGroupModalOpen(true)}
          title="Create a new group"
          aria-label="Create a new group"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="7" width="13" height="13" rx="2" />
            <path d="M19 3v6" />
            <path d="M16 6h6" />
          </svg>
        </button>
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

      {/* List Group Modal */}
      <ListGroupModal
        open={isGroupModalOpen}
        onOpenChange={(open) => {
          setIsGroupModalOpen(open);
          if (!open) setGroupToEdit(null);
        }}
        groupToEdit={groupToEdit}
      />

      {/* Right-click Context Menu for List Groups / Folders */}
      {contextMenuGroup && (
        <ListGroupContextMenu
          group={contextMenuGroup}
          position={contextMenuGroupPos}
          onClose={() => {
            setContextMenuGroup(null);
            setContextMenuGroupPos(null);
          }}
          onRename={(grp) => {
            setGroupToEdit(grp);
            setIsGroupModalOpen(true);
          }}
          onDelete={(grp) => {
            useListStore.getState().deleteGroup(grp.id);
          }}
        />
      )}

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
          onDelete={(l) => {
            if (activeListId === l.id) {
              setActiveListId('smart_my_day');
            }
            useListStore.getState().deleteList(l.id);
          }}
        />
      )}
    </aside>
  );
}

export default Sidebar;
