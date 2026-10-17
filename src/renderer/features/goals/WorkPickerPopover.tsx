import React, { useState, useMemo, useEffect } from 'react';
import { Popover } from '../../components/Popover/Popover.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useOkrStore } from '../../stores/okrStore.js';
import styles from './WorkPickerPopover.module.css';

export interface WorkPickerPopoverProps {
  keyResultId: string;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export const WorkPickerPopover: React.FC<WorkPickerPopoverProps> = ({
  keyResultId,
  trigger,
  align = 'start',
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'projects' | 'tasks'>('projects');
  const [showCompleted, setShowCompleted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const tasksById = useTaskStore((s) => s.tasksById);
  const updateTask = useTaskStore((s) => s.updateTask);

  const projectsById = useProjectStore((s) => s.projectsById);
  const updateProject = useProjectStore((s) => s.updateProject);

  const areasById = useAreaStore((s) => s.areasById);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [tab, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setTab('projects');
      setShowCompleted(false);
      setHighlightedIndex(0);
    }
  }, [open]);

  const allMatchingProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(projectsById)
      .filter((p) => p.status !== 'archived')
      .filter((p) => p.key_result_id !== keyResultId)
      .filter((p) => (!q ? true : p.name.toLowerCase().includes(q)));
  }, [projectsById, keyResultId, query]);

  const projectsToRender = useMemo(() => allMatchingProjects.slice(0, 50), [allMatchingProjects]);

  const allMatchingTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(tasksById)
      .filter((t) => t.is_trashed === 0 && t.parent_task_id === null)
      .filter((t) => t.key_result_id !== keyResultId)
      .filter((t) => (showCompleted ? true : !t.is_completed))
      .filter((t) => (!q ? true : t.title.toLowerCase().includes(q)));
  }, [tasksById, keyResultId, showCompleted, query]);

  const tasksToRender = useMemo(() => allMatchingTasks.slice(0, 50), [allMatchingTasks]);

  const currentItems = tab === 'projects' ? projectsToRender : tasksToRender;
  const totalMatches = tab === 'projects' ? allMatchingProjects.length : allMatchingTasks.length;

  const handleLinkTask = async (taskId: string) => {
    await updateTask({ id: taskId, key_result_id: keyResultId });
    setOpen(false);
  };

  const handleLinkProject = async (projectId: string) => {
    await updateProject(projectId, { key_result_id: keyResultId });
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItems.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % currentItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItems.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = currentItems[highlightedIndex];
      if (selected) {
        if (tab === 'projects') {
          handleLinkProject(selected.id);
        } else {
          handleLinkTask(selected.id);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      align={align}
      side={side}
      variant="glass"
      className={styles.popoverContent}
    >
      <div onKeyDown={handleKeyDown}>
        <div className={styles.searchWrapper}>
          <svg
            className={styles.searchIcon}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search projects and tasks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'projects'}
            className={`${styles.tab} ${tab === 'projects' ? styles.activeTab : ''}`}
            onClick={() => setTab('projects')}
          >
            Projects
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tasks'}
            className={`${styles.tab} ${tab === 'tasks' ? styles.activeTab : ''}`}
            onClick={() => setTab('tasks')}
          >
            Tasks
          </button>
        </div>

        <div className={styles.listArea}>
          {tab === 'projects' ? (
            projectsToRender.length === 0 ? (
              <div className={styles.emptyState}>No projects found</div>
            ) : (
              projectsToRender.map((p, idx) => {
                const area = p.area_id ? areasById[p.area_id] : null;
                const otherKr = p.key_result_id ? keyResultsById[p.key_result_id] : null;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.itemRow} ${isHighlighted ? styles.itemHighlighted : ''}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleLinkProject(p.id)}
                  >
                    <div className={styles.itemLeft}>
                      <span className={styles.itemTitle}>{p.name}</span>
                      {area && <span className={styles.secondaryText}>· {area.name}</span>}
                    </div>
                    {otherKr && (
                      <span className={styles.otherKrBadge}>In {otherKr.title}</span>
                    )}
                  </button>
                );
              })
            )
          ) : tasksToRender.length === 0 ? (
            <div className={styles.emptyState}>No tasks found</div>
          ) : (
            tasksToRender.map((t, idx) => {
              const project = t.project_id ? projectsById[t.project_id] : null;
              const otherKr = t.key_result_id ? keyResultsById[t.key_result_id] : null;
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.itemRow} ${isHighlighted ? styles.itemHighlighted : ''}`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleLinkTask(t.id)}
                >
                  <div className={styles.itemLeft}>
                    <span className={styles.itemTitle}>{t.title}</span>
                    {project && <span className={styles.secondaryText}>· {project.name}</span>}
                  </div>
                  {otherKr && (
                    <span className={styles.otherKrBadge}>In {otherKr.title}</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          {tab === 'tasks' && (
            <label className={styles.showCompletedLabel}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              <span>Show completed</span>
            </label>
          )}
          {totalMatches > 50 && (
            <span className={styles.typeToNarrow}>Type to narrow</span>
          )}
        </div>
      </div>
    </Popover>
  );
};

export default WorkPickerPopover;
