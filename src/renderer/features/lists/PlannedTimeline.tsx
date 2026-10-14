import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Task } from '@shared/types/task.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import { useCompletionLinger } from '../../hooks/useCompletionLinger.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { computeTaskItemEstimate } from '../tasks/TaskList.js';
import { PlannedDateGroup } from './PlannedDateGroup.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { useOptionalViewSearchContext } from '../search/ViewSearchContext.js';
import type { PlannedGroup } from '../../hooks/usePlannedGroups.js';
import styles from './PlannedTimeline.module.css';

export interface PlannedTimelineProps {
  groups: PlannedGroup[];
  tasksById: Record<string, Task>;
  isLoading?: boolean;
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
  targetScrollRequest?: { dateISO: string; timestamp: number } | null;
}

type TimelineItem =
  | { type: 'header'; group: PlannedGroup; key: string; count: number }
  | { type: 'task'; task: Task; group: PlannedGroup; key: string };

interface TaskRowDroppableProps {
  task: Task;
  group: PlannedGroup;
  parentTitle?: string;
  isSelected: boolean;
  allTaskIds: string[];
  onSelect: (task: Task) => void;
  onOpenDetail: (task: Task) => void;
  onToggleComplete: (id: string) => void;
  onToggleStar: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, task: Task) => void;
  exiting?: boolean;
}

const PlannedTaskRow = React.memo(function PlannedTaskRow({
  task,
  group,
  parentTitle,
  isSelected,
  allTaskIds,
  onSelect,
  onOpenDetail,
  onToggleComplete,
  onToggleStar,
  onUpdateTitle,
  onDelete,
  onDuplicate,
  onContextMenu,
  exiting,
}: TaskRowDroppableProps) {
  const isOverdue = group.kind === 'overdue';
  const search = useOptionalViewSearchContext();
  const isSearchFiltering = Boolean(search?.isFiltering);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: task.id,
    disabled: isSearchFiltering,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `droppable-row-${task.id}`,
    data: {
      type: 'planned-group',
      targetDropDateISO: group.targetDropDateISO,
      kind: group.kind,
      groupKey: group.key,
    },
  });

  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  const isInvalidHover = isOver && isOverdue;
  const isValidHover = isOver && !isOverdue;

  return (
    <div
      ref={combinedRef}
      className={`${styles.taskRowDroppable} ${
        isValidHover ? styles.dropActiveRow : ''
      } ${isInvalidHover ? styles.invalidDropRow : ''}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        parentTitle={parentTitle}
        disableDrag={true}
        isSelected={isSelected}
        allTaskIds={allTaskIds}
        onSelect={onSelect}
        onOpenDetail={onOpenDetail}
        onToggleComplete={onToggleComplete}
        onToggleStar={onToggleStar}
        onUpdateTitle={onUpdateTitle}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onContextMenu={onContextMenu}
        exiting={exiting}
      />
    </div>
  );
});

export function PlannedTimeline({
  groups,
  tasksById,
  isLoading,
  onSelectTask,
  selectedTaskId,
  targetScrollRequest,
}: PlannedTimelineProps): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const { updateTask, deleteTask, restoreTask, toggleComplete, toggleStar, duplicateTask } =
    useTaskStore();
  const { pushAction } = useUndoRedo();
  const search = useOptionalViewSearchContext();

  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const allTasksArray = useMemo(() => Object.values(tasksById), [tasksById]);
  const { isLingering, isExiting, lingerVersion } = useCompletionLinger(allTasksArray);

  // Flatten groups into a single list of headers + tasks
  const { flattenedItems, dateIndexMap, allTaskIds } = useMemo(() => {
    const items: TimelineItem[] = [];
    const indexMap: Record<string, number> = {};
    const taskIds: string[] = [];

    for (const group of groups) {
      const groupTasks: Task[] = [];
      for (const taskId of group.taskIds) {
        const task = tasksById[taskId];
        if (task && task.is_trashed === 0 && (task.is_completed === 0 || isLingering(task.id))) {
          if (!search?.isFiltering || search.isRowVisible(task.id)) {
            groupTasks.push(task);
          }
        }
      }

      if (search?.isFiltering && groupTasks.length === 0) {
        continue;
      }

      const headerIndex = items.length;
      items.push({
        type: 'header',
        group,
        key: `header_${group.kind}_${group.dateISO ?? group.label}`,
        count: search?.isFiltering ? groupTasks.length : group.taskIds.length,
      });

      if (group.dateISO) {
        indexMap[group.dateISO] = headerIndex;
      }
      if (group.targetDropDateISO) {
        indexMap[group.targetDropDateISO] = headerIndex;
      }

      for (const task of groupTasks) {
        taskIds.push(task.id);
        items.push({
          type: 'task',
          task,
          group,
          key: `task_${task.id}`,
        });
      }
    }

    return { flattenedItems: items, dateIndexMap: indexMap, allTaskIds: taskIds };
  }, [groups, tasksById, isLingering, lingerVersion, search?.isFiltering, search?.query, search?.results]);

  // Virtualizer for the flat timeline
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    getItemKey: index => flattenedItems[index]?.key ?? index,
    estimateSize: index => {
      const item = flattenedItems[index];
      if (!item) return 44;
      if (item.type === 'header') return 32;
      return computeTaskItemEstimate({
        task: item.task,
        hasSubtasks: false,
      });
    },
    overscan: 10,
  });

  // Handle calendar jump request
  useEffect(() => {
    if (!targetScrollRequest) return;
    const { dateISO } = targetScrollRequest;

    // 1. Direct index lookup
    let targetIndex = dateIndexMap[dateISO];

    // 2. Nearest later populated group if exact date is not present
    if (targetIndex === undefined) {
      for (const group of groups) {
        if (group.dateISO && group.dateISO >= dateISO) {
          targetIndex = dateIndexMap[group.dateISO];
          break;
        } else if (group.targetDropDateISO && group.targetDropDateISO >= dateISO) {
          targetIndex = dateIndexMap[group.targetDropDateISO];
          break;
        }
      }
    }

    // 3. If after all groups, scroll to last group
    if (targetIndex === undefined && groups.length > 0) {
      const lastGroup = groups[groups.length - 1];
      const lastKey = lastGroup.dateISO ?? lastGroup.targetDropDateISO;
      if (lastKey && dateIndexMap[lastKey] !== undefined) {
        targetIndex = dateIndexMap[lastKey];
      }
    }

    if (targetIndex !== undefined) {
      virtualizer.scrollToIndex(targetIndex, { align: 'start' });
    }
  }, [targetScrollRequest, dateIndexMap, groups, virtualizer]);

  // Task deletion with Undo Toast
  const handleDeleteTask = useCallback(
    async (id: string) => {
      const target = tasksById[id];
      if (!target) return;

      await deleteTask(id);

      pushAction({
        description: `Task "${target.title}" moved to trash`,
        undoFn: async () => {
          await restoreTask(target.id);
        },
        redoFn: async () => {
          await deleteTask(target.id);
        },
      });
    },
    [tasksById, deleteTask, pushAction, restoreTask]
  );

  if (isLoading && flattenedItems.length === 0) {
    return (
      <div className={styles.timelinePanel} aria-label="Loading planned tasks">
        <div className={styles.skeletonContainer}>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonRow} />
        </div>
      </div>
    );
  }

  if (search?.isFiltering && search.matchCount === 0) {
    return (
      <div className={styles.timelinePanel}>
        <div className={styles.emptyWrap}>
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
              in Planned
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (flattenedItems.length === 0) {
    return (
      <div className={styles.timelinePanel}>
        <div className={styles.emptyWrap}>
          <EmptyState
            title="No planned tasks"
            description="Tasks with a due date will appear here grouped by day and week."
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className={styles.timelinePanel}>
      <div
        className={styles.virtualContainer}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const item = flattenedItems[virtualItem.index];
          if (!item) return null;

          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              className={styles.virtualItem}
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {item.type === 'header' ? (
                <PlannedDateGroup group={item.group} taskCount={item.count} />
              ) : (
                <PlannedTaskRow
                  task={item.task}
                  group={item.group}
                  parentTitle={
                    item.task.parent_task_id
                      ? tasksById[item.task.parent_task_id]?.title
                      : undefined
                  }
                  isSelected={selectedTaskId === item.task.id || focusedTaskId === item.task.id}
                  allTaskIds={allTaskIds}
                  onSelect={t => setFocusedTaskId(t.id)}
                  onOpenDetail={t => onSelectTask?.(t)}
                  onToggleComplete={toggleComplete}
                  onToggleStar={toggleStar}
                  onUpdateTitle={(id, title) => updateTask({ id, title })}
                  onDelete={handleDeleteTask}
                  onDuplicate={duplicateTask}
                  onContextMenu={(e, t) => {
                    setContextMenuTask(t);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                  exiting={isExiting(item.task.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Task Context Menu */}
      {contextMenuTask && contextMenuPos && (
        <TaskContextMenu
          task={contextMenuTask}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuTask(null);
            setContextMenuPos(null);
          }}
          onSetPriority={(id, priority) => updateTask({ id, priority })}
          onSetDueDate={(id, date, time, allDay) =>
            updateTask({
              id,
              due_date: date,
              due_time: time,
              all_day: allDay ? 1 : 0,
            })
          }
          onDelete={handleDeleteTask}
          onDuplicate={duplicateTask}
        />
      )}
    </div>
  );
}

export default PlannedTimeline;
