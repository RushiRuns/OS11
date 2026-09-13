import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../stores/app-store.js';
import { useListStore, useSmartLists, useUserLists, useListGroups } from '../../stores/listStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { ListItem } from './ListItem.js';
import { SmartListGroup } from './SmartListGroup.js';
import { CreateListModal } from '../lists/CreateListModal.js';
import { ListGroupModal } from '../lists/ListGroupModal.js';
import { ListContextMenu, type ListContextMenuPosition } from '../lists/ListContextMenu.js';
import type { List } from '@shared/types/List.js';
import styles from './Sidebar.module.css';

interface NavView {
  id: string;
  label: string;
  icon: string;
  moduleName?: string;
}

const VIEWS: NavView[] = [
  { id: 'view_dashboard', label: 'Dashboard', icon: '📊', moduleName: 'dashboard' },
  { id: 'view_agenda', label: 'Agenda', icon: '📆', moduleName: 'agenda' },
  { id: 'view_projects', label: 'Projects', icon: '📁', moduleName: 'project_management' },
  { id: 'view_pomodoro', label: 'Pomodoro', icon: '⏱️', moduleName: 'pomodoro' },
  { id: 'view_settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar(): React.ReactElement {
  const { activeListId, setActiveListId } = useAppStore();
  const { loadLists } = useListStore();
  const smartLists = useSmartLists();
  const userLists = useUserLists();
  const listGroups = useListGroups();
  const { isEnabled, loadModules } = useModuleStore();

  const tasksById = useTaskStore((state) => state.tasksById);

  // Modals and context menu state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<List | null>(null);
  const [contextMenuList, setContextMenuList] = useState<List | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<ListContextMenuPosition | null>(null);

  // Drag-to-reorder state
  const [draggingListId, setDraggingListId] = useState<string | null>(null);

  // Sidebar resizer state (180px - 280px)
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLists();
    loadModules();
  }, [loadLists, loadModules]);

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

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, list: List) => {
    e.preventDefault();
    setContextMenuList(list);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Reorder user lists on drop, or move task to list if task is dropped
  const handleDrop = (targetListId: string) => {
    if (!draggingListId || draggingListId === targetListId) return;

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

  // Duplicate list handler
  const handleDuplicateList = async (list: List) => {
    try {
      const created = await useListStore.getState().createList({
        name: `${list.name} (Copy)`,
        icon: list.icon,
        color: list.color,
        background_type: list.background_type,
        background_value: list.background_value,
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
      <div className={styles.scrollWrap}>
        {/* Smart Lists Collapsible Group */}
        <SmartListGroup
          smartLists={smartLists}
          activeListId={activeListId}
          onSelectList={(id) => setActiveListId(id)}
          getTaskCount={getTaskCount}
        />

        {/* User Lists Section */}
        <div className={styles.sectionLabel}>
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
          return (
            <div key={group.id} className={styles.listGroupBlock}>
              <div className={styles.groupHeader}>
                <span>📁</span>
                <span>{group.name}</span>
              </div>
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
            </div>
          );
        })}

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
        >
          <span className={styles.newListIcon}>+</span>
          <span>New List</span>
        </button>

        <button
          type="button"
          className={styles.sectionActionBtn}
          onClick={() => setIsGroupModalOpen(true)}
          title="New folder"
        >
          📁+
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
        onOpenChange={setIsGroupModalOpen}
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
          onDelete={(l) => {
            useListStore.getState().deleteList(l.id);
          }}
        />
      )}
    </aside>
  );
}

export default Sidebar;
