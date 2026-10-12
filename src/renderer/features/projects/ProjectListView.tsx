import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { InlineTaskCreator } from '../tasks/InlineTaskCreator.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
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
import styles from './ProjectListView.module.css';

interface DroppableGroupHeaderProps {
  groupKey: string;
  title: string;
  isEmpty?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

function DroppableGroupHeader({
  groupKey,
  title,
  isEmpty,
  isCollapsed,
  onToggle,
}: DroppableGroupHeaderProps): React.ReactElement {
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
      className={`${styles.groupHeader} ${isOver ? styles.groupHeaderDropActive : ''} ${
        isEmpty ? styles.groupHeaderEmpty : ''
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={!isCollapsed}
      aria-label={`${title}${isEmpty ? ' (empty)' : ''}`}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
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
      <span className={styles.groupHeaderTitle}>{title}</span>
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
  const tagsById = useTagStore((state) => state.tagsById);
  const taskTagsByTaskId = useTagStore((state) => state.taskTagsByTaskId);

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
      (t) => !t.parent_task_id || !activeTasksMap.has(t.parent_task_id)
    );

    const result: FlattenedTaskItem[] = [];

    const appendTree = (task: Task, depth: number) => {
      const stats = subtaskStats.get(task.id) || { completed: 0, total: 0 };
      const hasSubtasks = stats.total > 0;
      const isExpanded = !collapsedParentIds.has(task.id);

      result.push({
        task,
        depth,
        hasSubtasks,
        isExpanded,
        subtaskCount: stats,
      });

      if (hasSubtasks && isExpanded) {
        const children = childrenByParentId.get(task.id) || [];
        for (const child of children) {
          appendTree(child, depth + 1);
        }
      }
    };

    for (const root of rootTasks) {
      appendTree(root, 0);
    }

    return result;
  }, [activeTasks, tasksById, collapsedParentIds]);

  const groupedTasks = useGroupedTasks({
    items: flattenedActiveItems,
    groupBy,
    tagsById,
    taskTagsByTaskId,
    includeEmpty: false,
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
    setDraggingTaskId(String(event.active.id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
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
    const { active, over, delta } = event;
    clearDragState();
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (isExternalDropTarget(overIdStr)) return;

    const activeTask = tasks.find((t) => t.id === activeIdStr);
    if (!activeTask) return;

    const todayStr = new Date().toISOString().split('T')[0];

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
        });

        if (mutation) {
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
      {activeTasks.length > 0 ? (
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
                  onToggleExpand={toggleParentExpand}
                  isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                  allTaskIds={allActiveTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                    onSelectTask(t);
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
                const isCollapsed = Boolean(collapsedGroupsMap[`${viewId}:${group.key}`]);
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
                      isEmpty={group.items.length === 0}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleGroupCollapsed(viewId, group.key)}
                    />
                    <div
                      className={styles.collapsibleWrapper}
                      data-collapsed={isCollapsed ? 'true' : 'false'}
                    >
                      <div className={styles.collapsibleInner}>
                        {group.items.length > 0 && (
                          <div className={styles.groupedTaskList}>
                            {group.items.map((item) => (
                              <TaskCard
                                key={item.task.id}
                                task={item.task}
                                depth={item.depth}
                                hasSubtasks={item.hasSubtasks}
                                isExpanded={item.isExpanded}
                                subtaskCount={item.subtaskCount}
                                onToggleExpand={toggleParentExpand}
                                isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                                allTaskIds={sortableTaskIds}
                                onSelect={(t) => {
                                  setFocusedTaskId(t.id);
                                  onSelectTask(t);
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
      {completedTasks.length > 0 && (
        <div className={styles.completedSection}>
          <div
            className={styles.completedHeader}
            role="button"
            tabIndex={0}
            aria-expanded={isCompletedOpen}
            aria-label={`Completed tasks (${completedTasks.length})`}
            onClick={() => setIsCompletedOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsCompletedOpen((prev) => !prev);
              }
            }}
          >
            <span
              className={`${styles.completedCaret} ${
                isCompletedOpen ? styles.completedCaretOpen : ''
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
            <span>Completed ({completedTasks.length})</span>
          </div>

          {isCompletedOpen && (
            <div className={styles.completedList} role="list" aria-label="Completed tasks">
              {completedTasks.map((task) => (
                <div key={task.id} className={styles.completedTaskItem}>
                  <TaskCard
                    task={task}
                    isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                    allTaskIds={allCompletedTaskIds}
                    onSelect={(t) => {
                      setFocusedTaskId(t.id);
                      onSelectTask(t);
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
      )}

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
          const today = new Date().toISOString().split('T')[0];
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
