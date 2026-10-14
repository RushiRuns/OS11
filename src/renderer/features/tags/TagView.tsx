import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTagStore } from '../../stores/tagStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useCompletionLinger } from '../../hooks/useCompletionLinger.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '@shared/types/task.js';
import { getTagShapeClass } from '@shared/utils/tag-shape.js';
import { useViewSearch } from '../../hooks/useViewSearch.js';
import { ViewSearch } from '../search/ViewSearch.js';
import { ViewSearchContext } from '../search/ViewSearchContext.js';
import { SearchCollapse } from '../search/SearchCollapse.js';
import styles from './TagView.module.css';

export interface TagViewProps {
  tagId: string;
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string;
}

export function TagView({
  tagId,
  onSelectTask,
  selectedTaskId,
}: TagViewProps): React.ReactElement {
  const { tagsById, loadTags } = useTagStore();
  const { toggleComplete, toggleStar, updateTask, deleteTask, duplicateTask } = useTaskStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const { isLingering, isExiting, lingerVersion } = useCompletionLinger(tasks);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeTasks = useMemo(
    () => tasks.filter((t) => (t.is_completed === 0 || isLingering(t.id)) && t.is_trashed === 0),
    [tasks, isLingering, lingerVersion]
  );

  const completedTasks = useMemo(
    () => tasks.filter((t) => t.is_completed === 1 && !isLingering(t.id) && t.is_trashed === 0),
    [tasks, isLingering, lingerVersion]
  );

  const allActiveTaskIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const allCompletedTaskIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const currentTag = tagsById[tagId];

  const fetchTasksForTag = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await ipc.invoke<Task[]>(IPC.TAGS.GET_TASKS_FOR_TAG, tagId);
      setTasks(result || []);
    } catch (err) {
      console.error('Failed to fetch tasks for tag:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    loadTags();
    fetchTasksForTag();
  }, [tagId, loadTags, fetchTasksForTag]);

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenuTask(task);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleToggleComplete = async (taskId: string) => {
    await toggleComplete(taskId);
    fetchTasksForTag();
  };

  const handleToggleStar = async (taskId: string) => {
    await toggleStar(taskId);
    fetchTasksForTag();
  };

  const handleUpdateTitle = async (taskId: string, newTitle: string) => {
    await updateTask({ id: taskId, title: newTitle });
    fetchTasksForTag();
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    fetchTasksForTag();
  };

  const handleDuplicate = async (taskId: string) => {
    await duplicateTask(taskId);
    fetchTasksForTag();
  };

  const searchTasks = useMemo(
    () => [...activeTasks, ...completedTasks],
    [activeTasks, completedTasks]
  );

  const handleOpenTaskDetail = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      if (target && onSelectTask) {
        onSelectTask(target);
      }
    },
    [tasks, onSelectTask]
  );

  const tagName = currentTag?.name ? `#${currentTag.name}` : '#Tag';

  const search = useViewSearch({
    tasks: searchTasks,
    viewKey: `tag:${tagId}`,
    viewName: tagName,
    onOpenTaskDetail: handleOpenTaskDetail,
  });

  const hasCompletedMatches = useMemo(() => {
    return completedTasks.some((t) => search.results.get(t.id)?.isMatch);
  }, [completedTasks, search.results]);

  const isCompletedSectionVisible = search.isFiltering
    ? hasCompletedMatches
    : completedTasks.length > 0;

  const isCompletedExpanded = search.groupOpen('completed', isCompletedOpen, hasCompletedMatches);

  return (
    <ViewSearchContext.Provider value={search}>
      <div className={styles.tagViewContainer}>
        <header className={styles.header}>
          <div className={styles.tagBadgeRow}>
            <div className={styles.tagTitleGroup}>
              <span
                className={`${styles.colorDot} ${getTagShapeClass(currentTag?.id || currentTag?.name || '')}`}
                style={{ background: currentTag?.color ?? 'var(--tag-gray)' }}
                aria-hidden="true"
              />
              <h1 className={styles.tagName}>
                #{currentTag?.name ?? 'Tag'}
              </h1>
              <span className={styles.taskCount}>
                {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            <ViewSearch searchState={search} onOpenDetail={handleOpenTaskDetail} />
          </div>
        </header>

        <div className={styles.scrollArea}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyText}>Loading tasks...</span>
            </div>
          ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🏷️</span>
              <span className={styles.emptyText}>
                No tasks tagged with #{currentTag?.name ?? 'this tag'}
              </span>
            </div>
          ) : search.isFiltering && search.matchCount === 0 ? (
            <div className={styles.emptySearchState}>
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
                in #{currentTag?.name ?? 'tag'}
              </div>
            </div>
          ) : (
            <>
              {activeTasks.length > 0 && (
                <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {activeTasks.map((task) => {
                    const isVisible = search.isRowVisible(task.id);
                    return (
                      <SearchCollapse key={task.id} collapsed={!isVisible}>
                        <TaskCard
                          task={task}
                          isSelected={task.id === selectedTaskId || task.id === focusedTaskId}
                          allTaskIds={allActiveTaskIds}
                          onSelect={(t) => setFocusedTaskId(t.id)}
                          onOpenDetail={onSelectTask}
                          onToggleComplete={handleToggleComplete}
                          onToggleStar={handleToggleStar}
                          onUpdateTitle={handleUpdateTitle}
                          onDelete={handleDelete}
                          onDuplicate={handleDuplicate}
                          onContextMenu={handleContextMenu}
                          exiting={isExiting(task.id)}
                        />
                      </SearchCollapse>
                    );
                  })}
                </div>
              )}

              {/* Collapsible Completed Section */}
              {isCompletedSectionVisible && (
                <div className={styles.completedSection}>
                  <div
                    className={styles.completedHeader}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isCompletedExpanded}
                    aria-label={`Completed tasks (${completedTasks.length})`}
                    onClick={() => {
                      if (search.isFiltering) {
                        search.setGroupOverride('completed', !isCompletedExpanded);
                      } else {
                        setIsCompletedOpen((prev) => !prev);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (search.isFiltering) {
                          search.setGroupOverride('completed', !isCompletedExpanded);
                        } else {
                          setIsCompletedOpen((prev) => !prev);
                        }
                      }
                    }}
                  >
                    <span
                      className={`${styles.completedCaret} ${
                        isCompletedExpanded ? styles.completedCaretOpen : ''
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

                  {isCompletedExpanded && (
                    <div className={styles.completedList} role="list" aria-label="Completed tasks">
                      {completedTasks.map((task) => {
                        const isVisible = search.isRowVisible(task.id);
                        return (
                          <SearchCollapse key={task.id} collapsed={!isVisible}>
                            <TaskCard
                              task={task}
                              isSelected={task.id === selectedTaskId || task.id === focusedTaskId}
                              allTaskIds={allCompletedTaskIds}
                              onSelect={(t) => setFocusedTaskId(t.id)}
                              onOpenDetail={onSelectTask}
                              onToggleComplete={handleToggleComplete}
                              onToggleStar={handleToggleStar}
                              onUpdateTitle={handleUpdateTitle}
                              onDelete={handleDelete}
                              onDuplicate={handleDuplicate}
                              onContextMenu={handleContextMenu}
                            />
                          </SearchCollapse>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

      {contextMenuTask && (
        <TaskContextMenu
          task={contextMenuTask}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuTask(null);
            setContextMenuPos(null);
          }}
          onToggleComplete={handleToggleComplete}
          onToggleStar={handleToggleStar}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onOpenDetail={onSelectTask}
        />
      )}
    </div>
  </ViewSearchContext.Provider>
  );
}

export default TagView;
