import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  useDndMonitor,
  useDroppable,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Project, Section, Task } from '@shared/types/index.js';
import { between } from '@shared/utils/fractional-index.js';
import { toISODateOnly } from '@shared/utils/date.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { InlineTaskCreator } from '../tasks/InlineTaskCreator.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useGroupedTasks, resolveGroupDropMutation } from '../../hooks/useGroupedTasks.js';
import { useCompletionLinger } from '../../hooks/useCompletionLinger.js';
import {
  type FlattenedTaskItem,
  planDrop,
  isExternalDropTarget,
  INDENT_PX,
  INDENT_LINE_BASE_PADDING,
  ROW_GAP_PX,
  type DropPlan,
} from '../tasks/TaskList.js';
import { useOptionalViewSearchContext } from '../search/ViewSearchContext.js';
import styles from './ProjectListView.module.css';

interface DroppableGroupHeaderProps {
  groupKey: string;
  title: string;
  count: number;
  isEmpty?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  isCustomSection?: boolean;
  canHide?: boolean;
  hasOverride?: boolean;
  onRename?: (newName: string) => void;
  onHide?: () => void;
  onResetOverride?: () => void;
}

function DroppableGroupHeader({
  groupKey,
  title,
  count,
  isEmpty,
  isCollapsed,
  onToggle,
  isCustomSection,
  canHide,
  hasOverride,
  onRename,
  onHide,
  onResetOverride,
}: DroppableGroupHeaderProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-header:${groupKey}`,
    data: {
      type: 'group-header',
      groupKey,
    },
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState(title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRenameText(title);
  }, [title]);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const handleCommitRename = () => {
    const trimmed = renameText.trim();
    setIsRenaming(false);
    if (trimmed && trimmed !== title) {
      onRename?.(trimmed);
    } else {
      setRenameText(title);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`${styles.groupHeader} ${isOver ? styles.groupHeaderDropActive : ''} ${
        isEmpty ? styles.groupHeaderEmpty : ''
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={!isCollapsed}
      aria-label={`${title} (${count})${isEmpty ? ' (empty)' : ''}`}
      onClick={() => {
        if (!isRenaming) {
          onToggle?.();
        }
      }}
      onKeyDown={(e) => {
        if (!isRenaming && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle?.();
        }
      }}
    >
      <span
        className={`${styles.groupChevron} ${isCollapsed ? styles.groupChevronCollapsed : ''}`}
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          className={styles.renameInput}
          value={renameText}
          maxLength={40}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setRenameText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommitRename();
            } else if (e.key === 'Escape') {
              setIsRenaming(false);
              setRenameText(title);
            }
          }}
          onBlur={handleCommitRename}
        />
      ) : (
        <span
          className={styles.groupHeaderTitle}
          onDoubleClick={(e) => {
            if (isCustomSection) {
              e.stopPropagation();
              setIsRenaming(true);
            }
          }}
        >
          {title}
        </span>
      )}
      <span className={styles.groupCount}>({count})</span>

      {isCustomSection && !isRenaming && (
        <div className={styles.groupHeaderActions} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.groupActionBtn}
            title="Rename section for this project"
            aria-label="Rename section for this project"
            onClick={() => setIsRenaming(true)}
          >
            ✏️
          </button>
          <button
            type="button"
            className={styles.groupActionBtn}
            title={
              canHide
                ? 'Hide section in this project'
                : 'Cannot hide a section with active tasks. Move or complete tasks first.'
            }
            aria-label="Hide section in this project"
            disabled={!canHide}
            onClick={onHide}
          >
            👁️
          </button>
          {hasOverride && (
            <button
              type="button"
              className={styles.groupActionBtn}
              title="Reset to group default"
              aria-label="Reset to group default"
              onClick={onResetOverride}
            >
              ↺
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptySectionDropTarget({ groupKey }: { groupKey: string }): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-header:${groupKey}`,
    data: {
      type: 'group-header',
      groupKey,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.emptySectionDropTarget} ${isOver ? styles.emptySectionDropTargetActive : ''}`}
    >
      Drop tasks here
    </div>
  );
}

interface ProjectListViewProps {
  project: Project;
  sections?: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string | null;
}


export function ProjectListView({
  project,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectListViewProps): React.ReactElement {
  const {
    tasksById,
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    duplicateTask,
    makeSubtask,
    reorderTask,
    moveTask,
  } = useTaskStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    top: number;
    left: number;
    width: number;
    depth: number;
  } | null>(null);

  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(() => new Set());
  const toggleParentExpand = useCallback((id: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const viewId = `project:${project.id}`;
  const groupBy = useViewGroupStore((state) => state.getGroupBy(viewId));
  const collapsedGroupsMap = useViewGroupStore((state) => state.collapsedGroupsMap);
  const { toggleGroupCollapsed } = useViewGroupStore.getState();
  const activeGroupId = useViewGroupStore((state) => state.getActiveCustomGroup(viewId));
  const hideEmpty = useViewGroupStore((state) => state.isHideEmpty(viewId));

  const customGroups = useCustomGroupStore((state) => state.groups);
  const overrides = useCustomGroupStore((state) => state.overrides);
  const taskValues = useCustomGroupStore((state) => state.taskValues);
  const setActiveProjectAndGroup = useCustomGroupStore((state) => state.setActiveProjectAndGroup);
  const setProjectOverride = useCustomGroupStore((state) => state.setProjectOverride);
  const clearProjectOverride = useCustomGroupStore((state) => state.clearProjectOverride);
  const moveTasks = useCustomGroupStore((state) => state.moveTasks);

  useEffect(() => {
    setActiveProjectAndGroup(project.id, activeGroupId);
  }, [project.id, activeGroupId, setActiveProjectAndGroup]);

  const activeGroup = useMemo(
    () => customGroups.find((g) => g.id === activeGroupId),
    [customGroups, activeGroupId]
  );

  const tagsById = useTagStore((state) => state.tagsById);
  const taskTagsByTaskId = useTagStore((state) => state.taskTagsByTaskId);

  const search = useOptionalViewSearchContext();
  const isSearchFiltering = Boolean(search?.isFiltering);

  // Filter tasks into active and completed
  const { isLingering, isExiting, lingerVersion, markCompleted } = useCompletionLinger(tasks);

  const handleToggleComplete = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (target && target.is_completed === 0) {
        markCompleted(id, target);
      }
      await toggleComplete(id);
    },
    [tasks, markCompleted, toggleComplete]
  );

  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => (t.is_completed === 0 || isLingering(t.id)) && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks, isLingering, lingerVersion]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.is_completed === 1 && !isLingering(t.id) && t.is_trashed === 0)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '') || a.sort_order - b.sort_order);
  }, [tasks, isLingering, lingerVersion]);

  const flattenedActiveItems: FlattenedTaskItem[] = useMemo(() => {
    const activeTasksMap = new Map<string, Task>();
    for (const t of activeTasks) {
      activeTasksMap.set(t.id, t);
    }

    const childrenByParentId = new Map<string, Task[]>();
    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 0 && t.is_completed === 0 && t.parent_task_id) {
        const list = childrenByParentId.get(t.parent_task_id) || [];
        list.push(t);
        childrenByParentId.set(t.parent_task_id, list);
      }
    }
    for (const childList of childrenByParentId.values()) {
      childList.sort((a, b) => a.sort_order - b.sort_order);
    }

    const subtaskStats = new Map<string, { completed: number; total: number }>();
    for (const t of Object.values(tasksById)) {
      if (t.is_trashed === 0 && t.parent_task_id) {
        const stats = subtaskStats.get(t.parent_task_id) || { completed: 0, total: 0 };
        stats.total += 1;
        if (t.is_completed === 1) stats.completed += 1;
        subtaskStats.set(t.parent_task_id, stats);
      }
    }

    const rootTasks = activeTasks.filter(
      (t) =>
        (!t.parent_task_id || !activeTasksMap.has(t.parent_task_id)) &&
        (!search?.isFiltering || search.isRowVisible(t.id))
    );

    const result: FlattenedTaskItem[] = [];

    const appendTree = (task: Task, depth: number) => {
      const stats = subtaskStats.get(task.id) || { completed: 0, total: 0 };
      const hasSubtasks = stats.total > 0;
      let isExpanded = !collapsedParentIds.has(task.id);

      if (search?.isFiltering) {
        const res = search.results.get(task.id);
        if (res && !res.isTitleMatch && res.isMatch) {
          isExpanded = true;
        }
      }

      result.push({
        task,
        depth,
        hasSubtasks,
        isExpanded,
        subtaskCount: stats,
      });

      if (hasSubtasks && isExpanded) {
        let children = childrenByParentId.get(task.id) || [];
        if (search?.isFiltering) {
          const parentRes = search.results.get(task.id);
          if (parentRes && !parentRes.isTitleMatch) {
            children = children.filter((c) => search.isRowVisible(c.id));
          }
        }
        for (const child of children) {
          appendTree(child, depth + 1);
        }
      }
    };

    for (const root of rootTasks) {
      appendTree(root, 0);
    }

    return result;
  }, [activeTasks, tasksById, collapsedParentIds, search?.isFiltering, search?.query, search?.results]);

  const groupedTasks = useGroupedTasks({
    items: flattenedActiveItems,
    groupBy,
    tagsById,
    taskTagsByTaskId,
    includeEmpty: false,
    customSections: activeGroup?.sections,
    customOverrides: overrides,
    taskCustomValues: taskValues,
    isDragging: Boolean(draggingTaskId),
    hideEmpty,
  });

  const allActiveTaskIds = useMemo(() => flattenedActiveItems.map((item) => item.task.id), [flattenedActiveItems]);
  const allCompletedTaskIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);

  const sortableTaskIds = useMemo(
    () => (groupBy === 'none' ? allActiveTaskIds : groupedTasks.flatMap((g) => g.items.map((i) => i.task.id))),
    [groupBy, allActiveTaskIds, groupedTasks]
  );

  const computeDropPlan = useCallback(
    (
      activeId: string,
      overId: string,
      deltaX: number,
      activeRect: { top: number; height: number } | null,
      overRect: { top: number; height: number }
    ): DropPlan | null =>
      planDrop({
        items: flattenedActiveItems,
        activeId,
        overId,
        deltaX,
        activeRect,
        overRect,
        indentPx: INDENT_PX,
        rowGapPx: ROW_GAP_PX,
      }),
    [flattenedActiveItems]
  );

  const clearDragState = () => {
    setDraggingTaskId(null);
    setDropIndicator(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isSearchFiltering) return;
    setDraggingTaskId(String(event.active.id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (isSearchFiltering) {
      setDropIndicator(null);
      return;
    }
    const { active, over, delta } = event;
    if (
      !over ||
      groupBy !== 'none' ||
      isExternalDropTarget(String(over.id)) ||
      String(over.id).startsWith('group-header:')
    ) {
      setDropIndicator(null);
      return;
    }

    const plan = computeDropPlan(
      String(active.id),
      String(over.id),
      delta.x,
      active.rect.current.translated ?? active.rect.current.initial ?? null,
      over.rect
    );
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!plan || plan.isNoop || !containerRect) {
      setDropIndicator(null);
      return;
    }

    const left = containerRect.left + INDENT_LINE_BASE_PADDING + plan.depth * INDENT_PX;
    const nextIndicator = {
      top: plan.lineTop,
      left,
      width: Math.max(40, containerRect.right - left - 16),
      depth: plan.depth,
    };
    setDropIndicator((prev) =>
      prev &&
      prev.top === nextIndicator.top &&
      prev.left === nextIndicator.left &&
      prev.width === nextIndicator.width
        ? prev
        : nextIndicator
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isSearchFiltering) {
      clearDragState();
      return;
    }
    const { active, over, delta } = event;
    clearDragState();
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (isExternalDropTarget(overIdStr)) return;

    const activeTask = tasks.find((t) => t.id === activeIdStr);
    if (!activeTask) return;

    const todayStr = toISODateOnly(new Date());

    if (groupBy !== 'none') {
      if (active.id === over.id) return;
      const { addTagToTask, removeTagFromTask } = useTagStore.getState();

      // 1. Dropped directly onto a group header
      if (overIdStr.startsWith('group-header:')) {
        const targetGroupKey = overIdStr.replace('group-header:', '');
        const targetGroup = groupedTasks.find((g) => g.key === targetGroupKey);

        let newSortOrder: number;
        if (targetGroup && targetGroup.items.length > 0) {
          const firstItem = targetGroup.items[0];
          if (firstItem.task.id === activeIdStr) {
            newSortOrder = activeTask.sort_order;
          } else {
            newSortOrder = between(null, firstItem.task.sort_order);
          }
        } else {
          newSortOrder = Date.now();
        }

        const mutation = resolveGroupDropMutation({
          task: activeTask,
          groupBy,
          targetGroupKey,
          targetTask: null,
          taskTagsByTaskId,
          todayStr,
          taskCustomValues: taskValues,
          customSections: activeGroup?.sections,
        });

        if (mutation) {
          if (mutation.customSectionChange) {
            await moveTasks(
              [activeTask.id],
              mutation.customSectionChange.targetSectionId,
              newSortOrder
            );
            return;
          }
          if (Object.keys(mutation.updates).length > 0) {
            await updateTask({
              id: activeTask.id,
              sort_order: newSortOrder,
              ...mutation.updates,
            });
          } else {
            await reorderTask(activeTask.id, newSortOrder);
          }
          if (mutation.tagChanges) {
            if (mutation.tagChanges.addTagId) {
              await addTagToTask(activeTask.id, mutation.tagChanges.addTagId);
            }
            if (mutation.tagChanges.removeTagId) {
              await removeTagFromTask(activeTask.id, mutation.tagChanges.removeTagId);
            }
          }
        } else {
          await reorderTask(activeTask.id, newSortOrder);
        }
        return;
      }

      // 2. Dropped over another task in a group
      const targetGroup = groupedTasks.find((g) => g.items.some((i) => i.task.id === overIdStr));
      const targetTask = tasks.find((t) => t.id === overIdStr) ?? null;

      if (targetGroup) {
        const mutation = resolveGroupDropMutation({
          task: activeTask,
          groupBy,
          targetGroupKey: targetGroup.key,
          targetTask,
          taskTagsByTaskId,
          todayStr,
          taskCustomValues: taskValues,
          customSections: activeGroup?.sections,
        });

        const groupItems = targetGroup.items.map((i) => i.task);
        const overIndex = groupItems.findIndex((t) => t.id === overIdStr);
        const activeIndexInGroup = groupItems.findIndex((t) => t.id === activeIdStr);

        let newSortOrder = activeTask.sort_order;
        if (overIndex !== -1) {
          const isMovingDown = activeIndexInGroup !== -1 && activeIndexInGroup < overIndex;
          const prev = isMovingDown ? groupItems[overIndex] : groupItems[overIndex - 1] ?? null;
          const next = isMovingDown ? groupItems[overIndex + 1] ?? null : groupItems[overIndex];
          newSortOrder = between(prev?.sort_order ?? null, next?.sort_order ?? null);
        }

        if (mutation) {
          if (mutation.customSectionChange) {
            await moveTasks(
              [activeTask.id],
              mutation.customSectionChange.targetSectionId,
              newSortOrder
            );
            return;
          }
          if (Object.keys(mutation.updates).length > 0) {
            await updateTask({
              id: activeTask.id,
              sort_order: newSortOrder,
              ...mutation.updates,
            });
          } else {
            await reorderTask(activeTask.id, newSortOrder);
          }
          if (mutation.tagChanges) {
            if (mutation.tagChanges.addTagId) {
              await addTagToTask(activeTask.id, mutation.tagChanges.addTagId);
            }
            if (mutation.tagChanges.removeTagId) {
              await removeTagFromTask(activeTask.id, mutation.tagChanges.removeTagId);
            }
          }
        } else {
          await reorderTask(activeTask.id, newSortOrder);
        }
        return;
      }
    }

    // Flat view tree-aware drop
    const activeId = activeIdStr;
    const activeTaskObj = tasksById[activeId] ?? activeTask;
    const prevParentId = activeTaskObj.parent_task_id ?? null;
    const displayedParentId =
      prevParentId && allActiveTaskIds.includes(prevParentId) ? prevParentId : null;

    const plan = computeDropPlan(
      activeId,
      overIdStr,
      delta.x,
      active.rect.current.translated ?? active.rect.current.initial ?? null,
      over.rect
    );

    if (!plan || plan.isNoop) return;

    const parentChanged = plan.parentId !== displayedParentId;
    const prevSibling = plan.prevSiblingId
      ? tasksById[plan.prevSiblingId] ?? tasks.find((t) => t.id === plan.prevSiblingId) ?? null
      : null;
    const nextSibling = plan.nextSiblingId
      ? tasksById[plan.nextSiblingId] ?? tasks.find((t) => t.id === plan.nextSiblingId) ?? null
      : null;
    const newSortOrder = between(prevSibling?.sort_order ?? null, nextSibling?.sort_order ?? null);
    const nextParentId = parentChanged ? plan.parentId : undefined;

    await moveTask(activeId, { parentId: nextParentId, sortOrder: newSortOrder });
  };

  useDndMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: clearDragState,
  });

  return (
    <div
      ref={containerRef}
      className={styles.listContainer}
      data-dragging={Boolean(draggingTaskId)}
    >
      {/* Inline Task Creator */}
      <InlineTaskCreator defaultProjectId={project.id} />

      {/* Active Tasks Reorderable Stream */}
      {search?.isFiltering && search.matchCount === 0 ? (
        <div className={styles.emptySearchState} data-testid="empty-search-state">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.emptySearchIcon}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <div className={styles.emptySearchTitle}>
            No tasks match &ldquo;{search.query}&rdquo;
          </div>
          <div className={styles.emptySearchSubtitle}>
            in {project.name}
          </div>
        </div>
      ) : activeTasks.length > 0 ? (
        groupBy === 'none' ? (
          <SortableContext items={allActiveTaskIds} strategy={verticalListSortingStrategy}>
            <div className={styles.tasksList} role="list" aria-label="Active tasks">
              {flattenedActiveItems.map((item) => (
                <TaskCard
                  key={item.task.id}
                  task={item.task}
                  depth={item.depth}
                  hasSubtasks={item.hasSubtasks}
                  isExpanded={item.isExpanded}
                  subtaskCount={item.subtaskCount}
                  disableDrag={isSearchFiltering}
                  onToggleExpand={toggleParentExpand}
                  isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                  allTaskIds={allActiveTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                  }}
                  onOpenDetail={(t) => onSelectTask(t)}
                  onToggleComplete={handleToggleComplete}
                  onToggleStar={toggleStar}
                  onUpdateTitle={(id, title) => updateTask({ id, title })}
                  onDelete={(id) => deleteTask(id)}
                  onDuplicate={duplicateTask}
                  onContextMenu={(e, t) => {
                    e.preventDefault();
                    setContextMenuTask(t);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                  exiting={isExiting(item.task.id)}
                />
              ))}
            </div>
          </SortableContext>
        ) : (
          <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
            <div className={styles.groupedContainer} role="list" aria-label="Grouped tasks">
              {groupedTasks.map((group) => {
                if (search?.isFiltering && group.items.length === 0) return null;
                const userCollapsed = Boolean(collapsedGroupsMap[`${viewId}:${group.key}`]);
                const isCollapsed = !search?.groupOpen(group.key, !userCollapsed, group.items.length > 0);
                const isCustomSection =
                  groupBy === 'custom' &&
                  group.key.startsWith('custom-section:') &&
                  group.key !== 'custom-section:__unsorted__';
                const sectionId = isCustomSection
                  ? group.key.replace('custom-section:', '')
                  : undefined;
                const sectionOverride = sectionId
                  ? overrides.find((o) => o.section_id === sectionId)
                  : undefined;
                const canHide = isCustomSection && group.items.length === 0;

                return (
                  <section
                    key={group.key}
                    className={styles.groupSection}
                    role="region"
                    aria-label={group.title}
                  >
                    <DroppableGroupHeader
                      groupKey={group.key}
                      title={group.title}
                      count={group.items.length}
                      isEmpty={group.items.length === 0}
                      isCollapsed={isCollapsed}
                      isCustomSection={isCustomSection}
                      canHide={canHide}
                      hasOverride={Boolean(sectionOverride)}
                      onToggle={() => {
                        if (search?.isFiltering) {
                          search.setGroupOverride(group.key, isCollapsed);
                        } else {
                          toggleGroupCollapsed(viewId, group.key);
                        }
                      }}
                      onRename={async (newName) => {
                        if (sectionId) {
                          await setProjectOverride({
                            project_id: project.id,
                            section_id: sectionId,
                            name_override: newName,
                          });
                        }
                      }}
                      onHide={async () => {
                        if (sectionId) {
                          await setProjectOverride({
                            project_id: project.id,
                            section_id: sectionId,
                            is_hidden: 1,
                          });
                        }
                      }}
                      onResetOverride={async () => {
                        if (sectionId) {
                          await clearProjectOverride(project.id, sectionId);
                        }
                      }}
                    />
                    <div
                      className={styles.collapsibleWrapper}
                      data-collapsed={isCollapsed ? 'true' : 'false'}
                    >
                      <div className={styles.collapsibleInner}>
                        {group.items.length > 0 ? (
                          <div className={styles.groupedTaskList}>
                            {group.items.map((item) => (
                              <TaskCard
                                key={item.task.id}
                                task={item.task}
                                depth={item.depth}
                                hasSubtasks={item.hasSubtasks}
                                isExpanded={item.isExpanded}
                                subtaskCount={item.subtaskCount}
                                disableDrag={isSearchFiltering}
                                onToggleExpand={toggleParentExpand}
                                isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                                allTaskIds={sortableTaskIds}
                                onSelect={(t) => {
                                  setFocusedTaskId(t.id);
                                }}
                                onOpenDetail={(t) => onSelectTask(t)}
                                onToggleComplete={handleToggleComplete}
                                onToggleStar={toggleStar}
                                onUpdateTitle={(id, title) => updateTask({ id, title })}
                                onDelete={(id) => deleteTask(id)}
                                onDuplicate={duplicateTask}
                                onContextMenu={(e, t) => {
                                  e.preventDefault();
                                  setContextMenuTask(t);
                                  setContextMenuPos({ x: e.clientX, y: e.clientY });
                                }}
                                exiting={isExiting(item.task.id)}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptySectionDropTarget groupKey={group.key} />
                        )}

                        {groupBy === 'custom' && activeGroupId && (
                          <div className={styles.sectionInlineCreator}>
                            <InlineTaskCreator
                              defaultProjectId={project.id}
                              customValue={{
                                groupId: activeGroupId,
                                sectionId:
                                  group.key === 'custom-section:__unsorted__'
                                    ? ''
                                    : group.key.replace('custom-section:', ''),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </SortableContext>
        )
      ) : completedTasks.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title="No tasks in this project"
            description="Type a task name in the input above and press Enter to get started."
          />
        </div>
      ) : null}

      {/* Collapsible Completed Section */}
      {completedTasks.length > 0 &&
        (!search?.isFiltering || completedTasks.some((t) => search?.isRowVisible(t.id))) &&
        (() => {
          const hasCompletedMatches = completedTasks.some((t) => Boolean(search?.isRowVisible(t.id)));
          const completedMatches = search?.isFiltering
            ? completedTasks.filter((t) => search?.isRowVisible(t.id))
            : completedTasks;
          const isSectionOpen =
            search?.groupOpen('completed', isCompletedOpen, hasCompletedMatches) ?? isCompletedOpen;

          return (
            <div className={styles.completedSection}>
              <div
                className={styles.completedHeader}
                role="button"
                tabIndex={0}
                aria-expanded={isSectionOpen}
                aria-label={`Completed tasks (${completedMatches.length})`}
                onClick={() => {
                  if (search?.isFiltering) {
                    search.setGroupOverride('completed', !isSectionOpen);
                  } else {
                    setIsCompletedOpen((prev) => !prev);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (search?.isFiltering) {
                      search.setGroupOverride('completed', !isSectionOpen);
                    } else {
                      setIsCompletedOpen((prev) => !prev);
                    }
                  }
                }}
              >
                <span
                  className={`${styles.completedCaret} ${
                    isSectionOpen ? styles.completedCaretOpen : ''
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
                <span>Completed ({completedMatches.length})</span>
              </div>

              {isSectionOpen &&
                (groupBy === 'custom' && activeGroup ? (
                  (() => {
                    const sectionsMap = new Map<string, Task[]>();
                    for (const sec of activeGroup.sections ?? []) {
                      sectionsMap.set(sec.id, []);
                    }
                    const unsortedCompleted: Task[] = [];
                    for (const task of completedMatches) {
                      const secId = taskValues[task.id];
                      if (secId && sectionsMap.has(secId)) {
                        sectionsMap.get(secId)!.push(task);
                      } else {
                        unsortedCompleted.push(task);
                      }
                    }

                    return (
                      <div className={styles.completedList} role="list" aria-label="Completed tasks">
                        {(activeGroup.sections ?? []).map((sec) => {
                          const secTasks = sectionsMap.get(sec.id) ?? [];
                          if (secTasks.length === 0) return null;
                          const override = overrides.find((o) => o.section_id === sec.id);
                          const secName = override?.name_override ?? sec.name;
                          return (
                            <div key={sec.id} className={styles.completedCustomSection}>
                              <div className={styles.completedCustomSectionTitle}>
                                {secName} ({secTasks.length})
                              </div>
                              {secTasks.map((task) => (
                                <div key={task.id} className={styles.completedTaskItem}>
                                  <TaskCard
                                    task={task}
                                    disableDrag={true}
                                    isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                                    allTaskIds={allCompletedTaskIds}
                                    onSelect={(t) => {
                                      setFocusedTaskId(t.id);
                                    }}
                                    onOpenDetail={(t) => onSelectTask(t)}
                                    onToggleComplete={handleToggleComplete}
                                    onToggleStar={toggleStar}
                                    onUpdateTitle={(id, title) => updateTask({ id, title })}
                                    onDelete={(id) => deleteTask(id)}
                                    onDuplicate={duplicateTask}
                                    onContextMenu={(e, t) => {
                                      e.preventDefault();
                                      setContextMenuTask(t);
                                      setContextMenuPos({ x: e.clientX, y: e.clientY });
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        {unsortedCompleted.length > 0 && (
                          <div className={styles.completedCustomSection}>
                            <div className={styles.completedCustomSectionTitle}>
                              Unsorted ({unsortedCompleted.length})
                            </div>
                            {unsortedCompleted.map((task) => (
                              <div key={task.id} className={styles.completedTaskItem}>
                                <TaskCard
                                  task={task}
                                  disableDrag={true}
                                  isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                                  allTaskIds={allCompletedTaskIds}
                                  onSelect={(t) => {
                                    setFocusedTaskId(t.id);
                                  }}
                                  onOpenDetail={(t) => onSelectTask(t)}
                                  onToggleComplete={handleToggleComplete}
                                  onToggleStar={toggleStar}
                                  onUpdateTitle={(id, title) => updateTask({ id, title })}
                                  onDelete={(id) => deleteTask(id)}
                                  onDuplicate={duplicateTask}
                                  onContextMenu={(e, t) => {
                                    e.preventDefault();
                                    setContextMenuTask(t);
                                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className={styles.completedList} role="list" aria-label="Completed tasks">
                    {completedMatches.map((task) => (
                      <div key={task.id} className={styles.completedTaskItem}>
                        <TaskCard
                          task={task}
                          disableDrag={true}
                          isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                          allTaskIds={allCompletedTaskIds}
                          onSelect={(t) => {
                            setFocusedTaskId(t.id);
                          }}
                          onOpenDetail={(t) => onSelectTask(t)}
                          onToggleComplete={handleToggleComplete}
                          onToggleStar={toggleStar}
                          onUpdateTitle={(id, title) => updateTask({ id, title })}
                          onDelete={(id) => deleteTask(id)}
                          onDuplicate={duplicateTask}
                          onContextMenu={(e, t) => {
                            e.preventDefault();
                            setContextMenuTask(t);
                            setContextMenuPos({ x: e.clientX, y: e.clientY });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          );
        })()}

      {/* Task Context Menu */}
      <TaskContextMenu
        task={contextMenuTask}
        position={contextMenuPos}
        onClose={() => {
          setContextMenuTask(null);
          setContextMenuPos(null);
        }}
        onToggleComplete={handleToggleComplete}
        onToggleStar={toggleStar}
        onSetPriority={(id, priority) => updateTask({ id, priority })}
        onSetDueDate={(id, date, time, allDay) =>
          updateTask({
            id,
            due_date: date,
            due_time: time,
            all_day: allDay ? 1 : 0,
          })
        }
        onToggleMyDay={(id) => {
          const today = toISODateOnly(new Date());
          const target = tasks.find((t) => t.id === id);
          const next = target?.my_day_date === today ? null : today;
          updateTask({ id, my_day_date: next });
        }}
        onMoveToList={(id, listId) => updateTask({ id, list_id: listId })}
        onDuplicate={duplicateTask}
        onCreateSubtask={(parentId) => makeSubtask(`task-${Date.now()}`, parentId)}
        onOpenDetail={(t) => onSelectTask(t)}
        onDelete={(id) => deleteTask(id)}
      />

      {dropIndicator && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: `${dropIndicator.top}px`,
              left: `${dropIndicator.left}px`,
              width: `${dropIndicator.width}px`,
              height: '2px',
              background: 'var(--accent)',
              zIndex: 60,
              pointerEvents: 'none',
              transform: 'translateY(-1px)',
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: `${dropIndicator.top}px`,
              left: `${dropIndicator.left - 4}px`,
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              border: '2px solid var(--accent)',
              background: 'var(--surface-base)',
              zIndex: 61,
              pointerEvents: 'none',
              transform: 'translate(0, -50%)',
            }}
          />
        </>
      )}
    </div>
  );
}

export default ProjectListView;
