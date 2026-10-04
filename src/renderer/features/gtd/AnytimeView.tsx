import React, { useState, useMemo } from 'react';
import type { Task } from '@shared/types/task.js';
import { useAnytimeTasks } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { QuickAddBar } from '../quickadd/QuickAddBar.js';
import styles from './AnytimeView.module.css';

interface AnytimeViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

type GroupByOption = 'none' | 'project' | 'area';

export function AnytimeView({
  onSelectTask,
  selectedTaskId,
}: AnytimeViewProps): React.ReactElement {
  const tasks = useAnytimeTasks();
  const projectsById = useProjectStore((s) => s.projectsById);
  const areasById = useAreaStore((s) => s.areasById);
  const [groupBy, setGroupBy] = useState<GroupByOption>('area');

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: 'All Anytime Tasks', tasks }];
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

      const result = Object.entries(groups).map(([pId, groupTasks]) => ({
        key: `project-${pId}`,
        title: `${projectsById[pId]?.icon || '📁'} ${projectsById[pId]?.name}`,
        tasks: groupTasks,
      }));

      if (noProject.length > 0) {
        result.push({
          key: 'no-project',
          title: 'No Project',
          tasks: noProject,
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

    const result = Object.entries(groups).map(([aId, groupTasks]) => ({
      key: `area-${aId}`,
      title: `${areasById[aId]?.icon || '📁'} ${areasById[aId]?.name}`,
      tasks: groupTasks,
    }));

    if (noArea.length > 0) {
      result.push({
        key: 'no-area',
        title: 'Loose Tasks (No Area)',
        tasks: noArea,
      });
    }

    return result;
  }, [tasks, groupBy, projectsById, areasById]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <span>⚡</span> Anytime
          </h1>
          <span className={styles.badge}>{tasks.length}</span>
        </div>

        <div className={styles.controls}>
          <label htmlFor="anytime-group-select" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            Group by:
          </label>
          <select
            id="anytime-group-select"
            className={styles.groupBySelect}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
          >
            <option value="area">Area</option>
            <option value="project">Project</option>
            <option value="none">None</option>
          </select>
        </div>
      </header>

      <div className={styles.quickAddWrapper}>
        <QuickAddBar placeholder="Capture a task to Anytime..." />
      </div>

      <div className={styles.scrollArea}>
        {tasks.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No Anytime Tasks"
            description="Mark undated tasks as Anytime when you're ready to execute them as soon as possible."
          />
        ) : (
          groupedTasks.map((group) => (
            <section key={group.key} className={styles.groupSection}>
              {groupBy !== 'none' && (
                <div className={styles.groupHeader}>
                  <span>{group.title}</span>
                  <span className={styles.groupCount}>({group.tasks.length})</span>
                </div>
              )}
              <div className={styles.taskList}>
                {group.tasks.map((task) => (
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
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default AnytimeView;
