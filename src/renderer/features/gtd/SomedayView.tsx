import React, { useState, useMemo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/index.js';
import { useSomedayTasks, useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { InlineTaskCreator } from '../tasks/InlineTaskCreator.js';
import { Button } from '../../components/Button/Button.js';
import styles from './SomedayView.module.css';

interface SomedayViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function SomedayView({
  onSelectTask,
  selectedTaskId,
}: SomedayViewProps): React.ReactElement {
  const tasks = useSomedayTasks();
  const projectsById = useProjectStore((s) => s.projectsById);
  const updateProject = useProjectStore((s) => s.updateProject);
  const { toggleComplete, toggleStar, deleteTask, duplicateTask, updateTask } = useTaskStore();

  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);

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
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Someday / Maybe</h1>
          <span className={styles.badge}>{totalCount}</span>
        </div>

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
            onClick={() => setActiveTab('projects')}
          >
            Projects ({somedayProjects.length})
          </button>
        </div>
      </header>

      {activeTab === 'tasks' && <InlineTaskCreator defaultBucket="someday" />}

      <div className={styles.scrollArea}>
        {activeTab === 'tasks' ? (
          tasks.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No Someday Tasks"
              description="Park ideas, aspirational goals, or deferred tasks here until you are ready to review them."
            />
          ) : (
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.taskList}>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    onSelect={() => onSelectTask?.(task)}
                    onOpenDetail={() => onSelectTask?.(task)}
                    onToggleComplete={() => toggleComplete(task.id)}
                    onToggleStar={() => toggleStar(task.id)}
                    onDelete={() => deleteTask(task.id)}
                    onDuplicate={() => duplicateTask(task.id)}
                    onContextMenu={(e) => handleContextMenu(e, task)}
                    disableDrag={false}
                  />
                ))}
              </div>
            </SortableContext>
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
          onToggleComplete={(id) => toggleComplete(id)}
          onToggleStar={(id) => toggleStar(id)}
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
  );
}

export default SomedayView;
