import React, { useState, useMemo } from 'react';
import {
  useDndMonitor,
  useDroppable,
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
import type { FlattenedTaskItem } from '../tasks/TaskList.js';
import styles from './ProjectListView.module.css';

interface DroppableGroupHeaderProps {
  groupKey: string;
  title: string;
  isEmpty?: boolean;
}

function DroppableGroupHeader({
  groupKey,
  title,
  isEmpty,
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
      role="region"
      aria-label={title}
    >
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

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}

export function ProjectListView({
  project,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectListViewProps): React.ReactElement {
  const {
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    duplicateTask,
    makeSubtask,
    reorderTask,
  } = useTaskStore();

  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const viewId = `project:${project.id}`;
  const groupBy = useViewGroupStore((state) => state.getGroupBy(viewId));
  const tagsById = useTagStore((state) => state.tagsById);
  const taskTagsByTaskId = useTagStore((state) => state.taskTagsByTaskId);

  // Filter tasks into active and completed
  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.is_completed === 1 && t.is_trashed === 0)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '') || a.sort_order - b.sort_order);
  }, [tasks]);

  const flattenedActiveItems: FlattenedTaskItem[] = useMemo(() => {
    return activeTasks.map((t) => ({
      task: t,
      depth: 0,
      hasSubtasks: false,
      isExpanded: false,
      subtaskCount: { completed: 0, total: 0 },
    }));
  }, [activeTasks]);

  const groupedTasks = useGroupedTasks({
    items: flattenedActiveItems,
    groupBy,
    tagsById,
    taskTagsByTaskId,
    includeEmpty: false,
  });

  const allActiveTaskIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const allCompletedTaskIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);

  const sortableTaskIds = useMemo(
    () => (groupBy === 'none' ? allActiveTaskIds : groupedTasks.flatMap((g) => g.items.map((i) => i.task.id))),
    [groupBy, allActiveTaskIds, groupedTasks]
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const activeTask = tasks.find((t) => t.id === activeIdStr);
    if (!activeTask) return;

    const todayStr = new Date().toISOString().split('T')[0];

    if (groupBy !== 'none') {
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

    const oldIndex = activeTasks.findIndex((t) => t.id === active.id);
    const newIndex = activeTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(activeTasks, oldIndex, newIndex);
    const prevSibling = newIndex > 0 ? reordered[newIndex - 1] : null;
    const nextSibling = newIndex < reordered.length - 1 ? reordered[newIndex + 1] : null;

    const newSortOrder = between(prevSibling?.sort_order ?? null, nextSibling?.sort_order ?? null);
    await reorderTask(String(active.id), newSortOrder);
  };

  useDndMonitor({
    onDragEnd: handleDragEnd,
  });

  return (
    <div className={styles.listContainer}>
      {/* Inline Task Creator */}
      <InlineTaskCreator defaultProjectId={project.id} />

      {/* Active Tasks Reorderable Stream */}
      {activeTasks.length > 0 ? (
        groupBy === 'none' ? (
          <SortableContext items={allActiveTaskIds} strategy={verticalListSortingStrategy}>
            <div className={styles.tasksList} role="list" aria-label="Active tasks">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                  allTaskIds={allActiveTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                    onSelectTask(t);
                  }}
                  onOpenDetail={(t) => onSelectTask(t)}
                  onToggleComplete={toggleComplete}
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
              ))}
            </div>
          </SortableContext>
        ) : (
          <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
            <div className={styles.groupedContainer} role="list" aria-label="Grouped tasks">
              {groupedTasks.map((group) => (
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
                  />
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
                          isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                          allTaskIds={sortableTaskIds}
                          onSelect={(t) => {
                            setFocusedTaskId(t.id);
                            onSelectTask(t);
                          }}
                          onOpenDetail={(t) => onSelectTask(t)}
                          onToggleComplete={toggleComplete}
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
                      ))}
                    </div>
                  )}
                </section>
              ))}
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
              ▶
            </span>
            <span>Completed ({completedTasks.length})</span>
          </div>

          {isCompletedOpen && (
            <div className={styles.completedList} role="list" aria-label="Completed tasks">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                  allTaskIds={allCompletedTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                    onSelectTask(t);
                  }}
                  onOpenDetail={(t) => onSelectTask(t)}
                  onToggleComplete={toggleComplete}
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
        onToggleComplete={toggleComplete}
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
    </div>
  );
}

export default ProjectListView;
