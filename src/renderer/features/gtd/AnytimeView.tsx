import React, { useState, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '@shared/types/task.js';
import { useAnytimeTasks, useCompletedTasks, useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { InlineTaskCreator } from '../tasks/InlineTaskCreator.js';
import { useCompletionLinger } from '../../hooks/useCompletionLinger.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import { useViewSearch } from '../../hooks/useViewSearch.js';
import { ViewSearch } from '../search/ViewSearch.js';
import { ViewSearchContext } from '../search/ViewSearchContext.js';
import { SearchCollapse } from '../search/SearchCollapse.js';
import styles from './AnytimeView.module.css';

interface AnytimeViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

type GroupByOption = 'none' | 'project' | 'area';

const ANYTIME_VIEW_ID = 'smart_anytime';

interface AnytimeTaskGroup {
  key: string;
  title: string;
  tasks: Task[];
  areaId: string | null;
  projectId: string | null;
}

const GROUP_BY_LABELS: Record<GroupByOption, string> = {
  area: 'Area',
  project: 'Project',
  none: 'None',
};

export function AnytimeView({
  onSelectTask,
  selectedTaskId,
}: AnytimeViewProps): React.ReactElement {
  const rawTasks = useAnytimeTasks();
  const { isExiting, withLingering, isLingering, markCompleted, lingerVersion } = useCompletionLinger();
  const tasks = withLingering(rawTasks);
  const completedTasks = useCompletedTasks('smart_anytime');
  const visibleCompletedTasks = useMemo(
    () => completedTasks.filter((t) => !isLingering(t.id)),
    [completedTasks, isLingering, lingerVersion]
  );
  const allCompletedTaskIds = useMemo(
    () => visibleCompletedTasks.map((t) => t.id),
    [visibleCompletedTasks]
  );
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const projectsById = useProjectStore((s) => s.projectsById);
  const areasById = useAreaStore((s) => s.areasById);
  const { toggleComplete, toggleStar, deleteTask, duplicateTask, updateTask } = useTaskStore();

  const searchTasks = useMemo(
    () => [...tasks, ...visibleCompletedTasks],
    [tasks, visibleCompletedTasks]
  );

  const handleOpenTaskDetail = (taskId: string) => {
    const target = searchTasks.find((t) => t.id === taskId);
    if (target && onSelectTask) {
      onSelectTask(target);
    }
  };

  const search = useViewSearch({
    tasks: searchTasks,
    viewKey: ANYTIME_VIEW_ID,
    viewName: 'Anytime',
    onOpenTaskDetail: handleOpenTaskDetail,
  });

  const storedGroupBy = useViewGroupStore((s) => s.groupByMap[ANYTIME_VIEW_ID]);
  const groupBy: GroupByOption =
    storedGroupBy === 'project' || storedGroupBy === 'area' || storedGroupBy === 'none'
      ? storedGroupBy
      : 'area';
  const collapsedGroupsMap = useViewGroupStore((s) => s.collapsedGroupsMap);
  const { setGroupBy, toggleGroupCollapsed } = useViewGroupStore.getState();

  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuTask(task);
  };

  const handleCloseContextMenu = () => {
    setContextMenuPos(null);
    setContextMenuTask(null);
  };

  const groupByMenuItems: (DropdownMenuItemConfig | 'separator')[] = [
    {
      id: 'group-area',
      label: `Area${groupBy === 'area' ? ' ✓' : ''}`,
      onClick: () => setGroupBy(ANYTIME_VIEW_ID, 'area'),
    },
    {
      id: 'group-project',
      label: `Project${groupBy === 'project' ? ' ✓' : ''}`,
      onClick: () => setGroupBy(ANYTIME_VIEW_ID, 'project'),
    },
    {
      id: 'group-none',
      label: `None${groupBy === 'none' ? ' ✓' : ''}`,
      onClick: () => setGroupBy(ANYTIME_VIEW_ID, 'none'),
    },
  ];

  const groupedTasks: AnytimeTaskGroup[] = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: 'All Anytime Tasks', tasks, areaId: null, projectId: null }];
    }

    if (groupBy === 'project') {
      const groups: Record<string, Task[]> = {};
      const noProject: Task[] = [];

      for (const t of tasks) {
        if (t.project_id && projectsById[t.project_id]) {
          const pId = t.project_id;
          if (!groups[pId]) groups[pId] = [];
          groups[pId].push(t);
        } else {
          noProject.push(t);
        }
      }

      const result: AnytimeTaskGroup[] = Object.entries(groups).map(([pId, groupTasks]) => ({
        key: `project-${pId}`,
        title: `${projectsById[pId]?.icon || '📁'} ${projectsById[pId]?.name}`,
        tasks: groupTasks,
        areaId: projectsById[pId]?.area_id ?? null,
        projectId: pId,
      }));

      if (noProject.length > 0) {
        result.push({
          key: 'no-project',
          title: 'No Project',
          tasks: noProject,
          areaId: null,
          projectId: null,
        });
      }

      return result;
    }

    // Group by Area
    const groups: Record<string, Task[]> = {};
    const noArea: Task[] = [];

    for (const t of tasks) {
      if (t.area_id && areasById[t.area_id]) {
        const aId = t.area_id;
        if (!groups[aId]) groups[aId] = [];
        groups[aId].push(t);
      } else {
        noArea.push(t);
      }
    }

    const result: AnytimeTaskGroup[] = Object.entries(groups).map(([aId, groupTasks]) => ({
      key: `area-${aId}`,
      title: `${areasById[aId]?.icon || '📁'} ${areasById[aId]?.name}`,
      tasks: groupTasks,
      areaId: aId,
      projectId: null,
    }));

    if (noArea.length > 0) {
      result.push({
        key: 'no-area',
        title: 'Loose Tasks (No Area)',
        tasks: noArea,
        areaId: null,
        projectId: null,
      });
    }

    return result;
  }, [tasks, groupBy, projectsById, areasById]);

  return (
    <ViewSearchContext.Provider value={search}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Anytime</h1>
            <span className={styles.badge}>{tasks.length}</span>
          </div>

          <div className={styles.controls}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              Group by:
            </label>
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className={styles.groupTriggerBtn}
                  aria-label={`Group by: ${GROUP_BY_LABELS[groupBy]}`}
                >
                  <span>{GROUP_BY_LABELS[groupBy]}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              }
              items={groupByMenuItems}
              align="end"
            />
            <ViewSearch searchState={search} onOpenDetail={handleOpenTaskDetail} />
          </div>
        </header>

        <InlineTaskCreator defaultBucket="anytime" />

        <div className={styles.scrollArea}>
          {search.isFiltering && search.matchCount === 0 ? (
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
                in Anytime
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon="⚡"
              title="No Anytime Tasks"
              description="Mark undated tasks as Anytime when you're ready to execute them as soon as possible."
            />
          ) : (
            groupedTasks.map((group) => {
              const hasMatches = search.isFiltering
                ? group.tasks.some((t) => search.isRowVisible(t.id))
                : true;
              if (search.isFiltering && !hasMatches) return null;

              const userCollapsed = Boolean(collapsedGroupsMap[`${ANYTIME_VIEW_ID}:${group.key}`]);
              const isOpen = search.groupOpen(group.key, !userCollapsed, hasMatches);
              const isCollapsed = !isOpen;

              const matchingCount = search.isFiltering
                ? group.tasks.filter((t) => search.isRowVisible(t.id)).length
                : group.tasks.length;

              return (
                <section key={group.key} className={styles.groupSection}>
                  {groupBy !== 'none' && (
                    <div
                      className={styles.groupHeader}
                      role="button"
                      tabIndex={0}
                      aria-expanded={!isCollapsed}
                      aria-label={`${group.title} (${matchingCount} tasks)`}
                      onClick={() => {
                        if (search.isFiltering) {
                          search.setGroupOverride(group.key, isCollapsed);
                        } else {
                          toggleGroupCollapsed(ANYTIME_VIEW_ID, group.key);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (search.isFiltering) {
                            search.setGroupOverride(group.key, isCollapsed);
                          } else {
                            toggleGroupCollapsed(ANYTIME_VIEW_ID, group.key);
                          }
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
                      <span>{group.title}</span>
                      <span className={styles.groupCount}>({matchingCount})</span>
                    </div>
                  )}
                  <div
                    className={styles.collapsibleWrapper}
                    data-collapsed={isCollapsed ? 'true' : 'false'}
                  >
                    <div className={styles.collapsibleInner}>
                      <SortableContext
                        items={group.tasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className={styles.taskList}>
                          {group.tasks.map((task) => (
                            <SearchCollapse key={task.id} collapsed={!search.isRowVisible(task.id)}>
                              <TaskCard
                                task={task}
                                isSelected={task.id === selectedTaskId || task.id === focusedTaskId}
                                onSelect={() => setFocusedTaskId(task.id)}
                                onOpenDetail={() => onSelectTask?.(task)}
                                onToggleComplete={() => {
                                  markCompleted(task.id, task);
                                  toggleComplete(task.id);
                                }}
                                onToggleStar={() => toggleStar(task.id)}
                                onDelete={() => deleteTask(task.id)}
                                onDuplicate={() => duplicateTask(task.id)}
                                onContextMenu={(e) => handleContextMenu(e, task)}
                                disableDrag={search.isFiltering}
                                exiting={isExiting(task.id)}
                              />
                            </SearchCollapse>
                          ))}
                        </div>
                      </SortableContext>
                    </div>
                  </div>
                </section>
              );
            })
          )}

          {/* Collapsible Completed Section */}
          {visibleCompletedTasks.length > 0 &&
            (!search.isFiltering || visibleCompletedTasks.some((t) => search.isRowVisible(t.id))) &&
            (() => {
              const hasCompletedMatches = visibleCompletedTasks.some((t) => search.isRowVisible(t.id));
              const completedMatchingCount = search.isFiltering
                ? visibleCompletedTasks.filter((t) => search.isRowVisible(t.id)).length
                : visibleCompletedTasks.length;
              const isSectionOpen = search.groupOpen('completed', isCompletedOpen, hasCompletedMatches);

              return (
                <div className={styles.completedSection}>
                  <div
                    className={styles.completedHeader}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSectionOpen}
                    aria-label={`Completed tasks (${completedMatchingCount})`}
                    onClick={() => {
                      if (search.isFiltering) {
                        search.setGroupOverride('completed', !isSectionOpen);
                      } else {
                        setIsCompletedOpen((prev) => !prev);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (search.isFiltering) {
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
                    <span>Completed ({completedMatchingCount})</span>
                  </div>

                  {isSectionOpen && (
                    <div className={styles.completedList} role="list" aria-label="Completed tasks">
                      {visibleCompletedTasks.map((task) => (
                        <SearchCollapse key={task.id} collapsed={!search.isRowVisible(task.id)}>
                          <TaskCard
                            task={task}
                            isSelected={task.id === selectedTaskId || task.id === focusedTaskId}
                            allTaskIds={allCompletedTaskIds}
                            onSelect={() => setFocusedTaskId(task.id)}
                            onOpenDetail={() => onSelectTask?.(task)}
                            onToggleComplete={() => toggleComplete(task.id)}
                            onToggleStar={() => toggleStar(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            onDuplicate={() => duplicateTask(task.id)}
                            onContextMenu={(e) => handleContextMenu(e, task)}
                            disableDrag={true}
                          />
                        </SearchCollapse>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
        </div>

        {contextMenuPos && contextMenuTask && (
          <TaskContextMenu
            task={contextMenuTask}
            position={contextMenuPos}
            onClose={handleCloseContextMenu}
            onToggleComplete={(id) => {
              const t = tasks.find((x) => x.id === id);
              if (t && t.is_completed === 0) markCompleted(id, t);
              toggleComplete(id);
            }}
            onToggleStar={(id) => toggleStar(id)}
            onSetPriority={(id, priority) => updateTask({ id, priority })}
            onSetDueDate={(id, date, time, allDay) =>
              updateTask({
                id,
                due_date: date,
                due_time: time,
                all_day: allDay ? 1 : 0,
              })
            }
            onDelete={(id) => deleteTask(id)}
            onDuplicate={(id) => duplicateTask(id)}
            onOpenDetail={(task) => {
              onSelectTask?.(task);
              handleCloseContextMenu();
            }}
            onMoveToList={async (id, listId) => {
              await updateTask({ id, list_id: listId, bucket: null });
              handleCloseContextMenu();
            }}
            onMoveTo={async (id, dest) => {
              await updateTask({ id, ...dest, bucket: null });
              handleCloseContextMenu();
            }}
          />
        )}
      </div>
    </ViewSearchContext.Provider>
  );
}

export default AnytimeView;
