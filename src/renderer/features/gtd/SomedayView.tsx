import React, { useState, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import type { Project } from '@shared/types/index.js';
import { useSomedayTasks } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
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

  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');

  const somedayProjects = useMemo(() => {
    return (Object.values(projectsById) as Project[]).filter(
      (p) => (p.is_someday === 1 || p.status === 'parked') && p.status !== 'archived'
    );
  }, [projectsById]);

  const handleUnparkProject = async (project: Project) => {
    await updateProject(project.id, { is_someday: 0, status: 'active' });
  };

  const totalCount = tasks.length + somedayProjects.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>📦</span> Someday / Maybe
          </h1>
          <span className={styles.badge}>{totalCount}</span>
        </div>

        <div className={styles.tabButtons}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'tasks' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks ({tasks.length})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'projects' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects ({somedayProjects.length})
          </button>
        </div>
      </header>

      {activeTab === 'tasks' && (
        <div className={styles.quickAddWrapper}>
          <QuickAddBar placeholder="Capture a someday/maybe idea..." />
        </div>
      )}

      <div className={styles.scrollArea}>
        {activeTab === 'tasks' ? (
          tasks.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No Someday Tasks"
              description="Park ideas, aspirational goals, or deferred tasks here until you are ready to review them."
            />
          ) : (
            <div className={styles.taskList}>
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  onSelect={() => onSelectTask?.(task)}
                  onOpenDetail={() => onSelectTask?.(task)}
                  disableDrag
                />
              ))}
            </div>
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
    </div>
  );
}

export default SomedayView;
