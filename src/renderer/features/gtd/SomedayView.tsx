import React, { useState, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/index.js';
import { useSomedayTasks, useCompletedTasks, useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { InlineTaskCreator } from '../tasks/InlineTaskCreator.js';
import { useCompletionLinger } from '../../hooks/useCompletionLinger.js';
import { Button } from '../../components/Button/Button.js';
import { useViewSearch } from '../../hooks/useViewSearch.js';
import { ViewSearch } from '../search/ViewSearch.js';
import { ViewSearchContext } from '../search/ViewSearchContext.js';
import { SearchCollapse } from '../search/SearchCollapse.js';
import styles from './SomedayView.module.css';

interface SomedayViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function SomedayView({
  onSelectTask,
  selectedTaskId,
}: SomedayViewProps): React.ReactElement {
  const rawTasks = useSomedayTasks();
  const { isExiting, withLingering, isLingering, markCompleted, lingerVersion } = useCompletionLinger();
  const tasks = withLingering(rawTasks);
  const completedTasks = useCompletedTasks('smart_someday');
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
  const updateProject = useProjectStore((s) => s.updateProject);
  const { toggleComplete, toggleStar, deleteTask, duplicateTask, updateTask } = useTaskStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);

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
    viewKey: 'smart_someday',
    viewName: 'Someday / Maybe',
    enabled: activeTab === 'tasks',
    onOpenTaskDetail: handleOpenTaskDetail,
  });

  const somedayProjects = useMemo(() => {
    return (Object.values(projectsById) as Project[]).filter(
      (p) => (p.is_someday === 1 || p.status === 'parked') && p.status !== 'archived'
    );
  }, [projectsById]);

  const handleUnparkProject = async (project: Project) => {
    await updateProject(project.id, { is_someday: 0, status: 'active' });
  };

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

  const totalCount = tasks.length + somedayProjects.length;

  return (
    <ViewSearchContext.Provider value={search}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Someday / Maybe</h1>
            <span className={styles.badge}>{totalCount}</span>
          </div>

          <div className={styles.headerControls}>
            <div className={styles.segmentedControl} role="tablist" aria-label="Someday views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tasks'}
                className={`${styles.segmentedBtn} ${activeTab === 'tasks' ? styles.segmentedBtnActive : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                Tasks ({tasks.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'projects'}
                className={`${styles.segmentedBtn} ${activeTab === 'projects' ? styles.segmentedBtnActive : ''}`}
                onClick={() => {
                  search.close();
                  setActiveTab('projects');
                }}
              >
                Projects ({somedayProjects.length})
              </button>
            </div>
            {activeTab === 'tasks' && (
              <ViewSearch searchState={search} onOpenDetail={handleOpenTaskDetail} />
            )}
          </div>
        </header>

        {activeTab === 'tasks' && <InlineTaskCreator defaultBucket="someday" />}

        <div className={styles.scrollArea}>
          {activeTab === 'tasks' ? (
            search.isFiltering && search.matchCount === 0 ? (
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
                  in Someday / Maybe
                </div>
              </div>
            ) : tasks.length === 0 && visibleCompletedTasks.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No Someday Tasks"
                description="Park ideas, aspirational goals, or deferred tasks here until you are ready to review them."
              />
            ) : (
              <>
                {tasks.length > 0 && (
                  <SortableContext
                    items={tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={styles.taskList}>
                      {tasks.map((task) => (
                        <SearchCollapse key={task.id} collapsed={!search.isRowVisible(task.id)}>
                          <TaskCard
                            key={task.id}
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
                                  key={task.id}
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
              </>
            )
          ) : somedayProjects.length === 0 ? (
            <EmptyState
              icon="📁"
              title="No Parked Projects"
              description="Projects marked as Someday are paused and hidden from active sidebar counts."
            />
          ) : (
            somedayProjects.map((project) => (
              <div key={project.id} className={styles.projectCard}>
                <div className={styles.projectInfo}>
                  <span className={styles.projectIcon}>{project.icon || '📁'}</span>
                  <div>
                    <div className={styles.projectName}>{project.name}</div>
                    <div className={styles.projectMeta}>
                      Parked • Last reviewed:{' '}
                      {project.reviewed_at
                        ? new Date(project.reviewed_at).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </div>
                </div>

                <div className={styles.projectActions}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleUnparkProject(project)}
                  >
                    Unpark (Make Active)
                  </Button>
                </div>
              </div>
            ))
          )}
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

export default SomedayView;
