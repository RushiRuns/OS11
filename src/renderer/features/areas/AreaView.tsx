import React, { useState, useMemo } from 'react';
import { useArea } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTaskStore, useTasksByArea } from '../../stores/taskStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
import { CreateProjectModal } from '../projects/CreateProjectModal.js';
import { Button } from '../../components/Button/Button.js';
import type { Task } from '@shared/types/index.js';
import styles from './AreaView.module.css';

export interface AreaViewProps {
  areaId: string;
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string | null;
}

export function AreaView({
  areaId,
  onSelectTask,
  selectedTaskId,
}: AreaViewProps): React.ReactElement {
  const area = useArea(areaId);
  const looseTasks = useTasksByArea(areaId);
  const setActiveListId = useAppStore((state) => state.setActiveListId);

  const {
    tasksById,
    toggleComplete,
    toggleStar,
    updateTask,
    deleteTask,
    duplicateTask,
  } = useTaskStore();

  const projects = useProjectStore((state) =>
    Object.values(state.projectsById).filter((p) => p.area_id === areaId && p.status !== 'archived')
  );

  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  // Stats calculation for project cards
  const projectStats = useMemo(() => {
    const allTasks = Object.values(tasksById).filter((t) => t.is_trashed === 0);
    const stats: Record<string, { total: number; completed: number; percentage: number }> = {};

    for (const p of projects) {
      const pTasks = allTasks.filter((t) => t.project_id === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.is_completed === 1).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      stats[p.id] = { total, completed, percentage };
    }
    return stats;
  }, [projects, tasksById]);

  if (!area) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyNotice}>Area not found</div>
      </div>
    );
  }

  const allLooseTaskIds = looseTasks.map((t) => t.id);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <span className={styles.icon}>{area.icon || '📁'}</span>
          <h1 className={styles.title}>
            {area.name}
            <span className={styles.badge}>
              {looseTasks.length} {looseTasks.length === 1 ? 'task' : 'tasks'} · {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          </h1>
        </div>
        <Button
          variant="primary"
          onClick={() => setIsCreateProjectOpen(true)}
        >
          + New Project
        </Button>
      </div>

      {/* Loose Tasks Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Loose Tasks</h2>
        </div>

        {/* Quick add loose task inside this Area */}
        <QuickAddBar
          placeholder={`Add a loose task to ${area.name}...`}
        />

        {looseTasks.length === 0 ? (
          <div className={styles.emptyNotice}>
            No loose tasks in this Area. Tasks created here don&apos;t belong to any project.
          </div>
        ) : (
          <div className={styles.taskList} role="list">
            {looseTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                depth={0}
                isSelected={selectedTaskId === task.id}
                allTaskIds={allLooseTaskIds}
                onSelect={(t) => onSelectTask?.(t)}
                onOpenDetail={(t) => onSelectTask?.(t)}
                onToggleComplete={toggleComplete}
                onToggleStar={toggleStar}
                onUpdateTitle={(id, title) => updateTask({ id, title })}
                onDelete={deleteTask}
                onDuplicate={duplicateTask}
                onContextMenu={(e, t) => {
                  setContextMenuTask(t);
                  setContextMenuPos({ x: e.clientX, y: e.clientY });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Projects</h2>
        </div>

        <div className={styles.projectsGrid}>
          {projects.map((p) => {
            const stats = projectStats[p.id] ?? { total: 0, completed: 0, percentage: 0 };
            return (
              <div
                key={p.id}
                className={styles.projectCard}
                onClick={() => {
                  useProjectStore.getState().setSelectedProjectId(p.id);
                  setActiveListId(`project:${p.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    useProjectStore.getState().setSelectedProjectId(p.id);
                    setActiveListId(`project:${p.id}`);
                  }
                }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.cardIcon}>{p.icon || '📁'}</span>
                  <div className={styles.cardInfo}>
                    <div className={styles.projectName} title={p.name}>
                      {p.name}
                    </div>
                    {p.description && (
                      <p className={styles.projectDescription}>{p.description}</p>
                    )}
                  </div>
                </div>

                <div className={styles.cardBottom}>
                  <div className={styles.progressBarContainer}>
                    <div
                      className={styles.progressBarFill}
                      style={{ width: `${stats.percentage}%` }}
                    />
                  </div>
                  <span>
                    {stats.completed}/{stats.total} ({stats.percentage}%)
                  </span>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className={styles.newProjectCard}
            onClick={() => setIsCreateProjectOpen(true)}
          >
            <span style={{ fontSize: '20px' }}>+</span>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Create Project</span>
          </button>
        </div>
      </div>

      {/* Modals and Context Menus */}
      <CreateProjectModal
        open={isCreateProjectOpen}
        onOpenChange={setIsCreateProjectOpen}
        initialAreaId={areaId}
        onCreated={(newProj) => {
          useProjectStore.getState().setSelectedProjectId(newProj.id);
          setActiveListId(`project:${newProj.id}`);
        }}
      />

      <TaskContextMenu
        task={contextMenuTask}
        position={contextMenuPos}
        onClose={() => {
          setContextMenuTask(null);
          setContextMenuPos(null);
        }}
        onToggleComplete={toggleComplete}
        onToggleStar={toggleStar}
        onOpenDetail={onSelectTask}
        onDelete={deleteTask}
        onDuplicate={duplicateTask}
      />
    </div>
  );
}

export default AreaView;
