import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, Section, Milestone, Task } from '@shared/types/index.js';
import { ViewSwitcher, type ProjectViewMode } from './ViewSwitcher.js';
import { exportProjectToCsv, exportProjectToMarkdown, exportProjectToPdf } from './projectExport.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAppStore } from '../../stores/app-store.js';
import styles from './ProjectHeader.module.css';
import menuStyles from '../lists/ListContextMenu.module.css';

interface ProjectHeaderProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  milestones: Milestone[];
  currentView: ProjectViewMode;
  onViewChange: (view: ProjectViewMode) => void;
  onUpdateViews?: (views: ProjectViewMode[]) => void | Promise<void>;
  onOpenMilestones: () => void;
  onOpenTemplates: () => void;
}

export function ProjectHeader({
  project,
  sections,
  tasks,
  milestones,
  currentView,
  onViewChange,
  onUpdateViews,
  onOpenMilestones,
  onOpenTemplates,
}: ProjectHeaderProps): React.ReactElement {
  const { archiveProject, updateProject, deleteProject } = useProjectStore();
  const setActiveListId = useAppStore((state) => state.setActiveListId);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExportSubmenuOpen, setIsExportSubmenuOpen] = useState(false);
  const [isCustomizeViewsOpen, setIsCustomizeViewsOpen] = useState(false);
  const [showProgressTooltip, setShowProgressTooltip] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  // Close floating menu on Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsExportSubmenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Completion calculation
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.is_completed === 1).length;
  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(
    (t) => t.is_completed === 0 && t.due_date && t.due_date < today
  ).length;

  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // SVG Progress Ring
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Menu positioning
  const triggerRect = menuTriggerRef.current?.getBoundingClientRect();
  const menuWidth = 190;
  const menuHeight = 220;
  const posX = triggerRect
    ? Math.max(8, Math.min(triggerRect.left, window.innerWidth - menuWidth - 8))
    : 8;
  const posY = triggerRect
    ? Math.max(8, Math.min(triggerRect.bottom + 6, window.innerHeight - menuHeight - 8))
    : 8;

  const exportSubmenuWidth = 170;
  const exportSubmenuPosX =
    posX + menuWidth + exportSubmenuWidth <= window.innerWidth - 8
      ? posX + menuWidth - 4
      : Math.max(8, posX - exportSubmenuWidth + 4);
  const exportSubmenuPosY = Math.max(8, Math.min(posY + 70, window.innerHeight - 150));

  return (
    <header className={styles.headerContainer} aria-label="Project Details Header">
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <span className={styles.projectIcon}>{project.icon || '📁'}</span>
            <h1 className={styles.titleHeading}>{project.name}</h1>
            <button
              ref={menuTriggerRef}
              type="button"
              className={styles.moreBtn}
              aria-label="Project actions"
              title="Project actions"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMenuOpen((prev) => !prev);
                }
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
                <circle cx="5" cy="12" r="2" />
              </svg>
            </button>
            <span
              className={`${styles.statusBadge} ${
                project.status === 'archived'
                  ? styles.statusArchived
                  : project.status === 'completed'
                  ? styles.statusCompleted
                  : styles.statusActive
              }`}
            >
              {project.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : 'Active'}
            </span>
          </div>
          {project.description && <p className={styles.description}>{project.description}</p>}
        </div>

        {/* Compact Progress Pill with rich hover tooltip */}
        <div className={styles.progressPillWrapper}>
          <div
            className={styles.progressPill}
            onMouseEnter={() => setShowProgressTooltip(true)}
            onMouseLeave={() => setShowProgressTooltip(false)}
            tabIndex={0}
            aria-label={`${completedTasks} of ${totalTasks} tasks done (${percentage}%)`}
          >
            <span
              className={styles.pillDot}
              style={{
                backgroundColor:
                  percentage === 100
                    ? 'var(--color-success)'
                    : percentage > 0
                    ? 'var(--accent)'
                    : 'var(--text-tertiary)',
              }}
            />
            <span className={styles.pillText}>
              {totalTasks === 0 ? '0 tasks' : `${completedTasks}/${totalTasks} done`}
            </span>
            {overdueTasks > 0 && <span className={styles.pillOverdue}>• {overdueTasks} overdue</span>}
          </div>

          {showProgressTooltip && (
            <div className={styles.progressTooltip} role="tooltip">
              <div className={styles.tooltipRingWrapper}>
                <svg className={styles.tooltipRingSvg} viewBox="0 0 44 44">
                  <circle className={styles.ringBg} cx="22" cy="22" r={radius} />
                  <circle
                    className={styles.ringProgress}
                    cx="22"
                    cy="22"
                    r={radius}
                    style={{
                      strokeDasharray: circumference,
                      strokeDashoffset,
                    }}
                  />
                </svg>
                <span className={styles.tooltipPercentage}>{percentage}%</span>
              </div>
              <div className={styles.tooltipStats}>
                <span className={styles.tooltipHeading}>{percentage}% Completed</span>
                <span className={styles.tooltipSub}>
                  {completedTasks} of {totalTasks} tasks done
                </span>
                {overdueTasks > 0 && (
                  <span className={styles.tooltipOverdue}>
                    {overdueTasks} task{overdueTasks > 1 ? 's' : ''} overdue
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Three-Dot Menu Portal */}
      {isMenuOpen &&
        createPortal(
          <div
            className={menuStyles.overlay}
            onClick={() => {
              setIsMenuOpen(false);
              setIsExportSubmenuOpen(false);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsMenuOpen(false);
              setIsExportSubmenuOpen(false);
            }}
          >
            <div
              ref={menuRef}
              className={menuStyles.menu}
              style={{ left: posX, top: posY, minWidth: menuWidth }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={menuStyles.menuItem}
                onMouseEnter={() => setIsExportSubmenuOpen(false)}
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenMilestones();
                }}
              >
                <span>◆</span>
                <span>Milestones ({milestones.length})</span>
              </button>

              <button
                type="button"
                className={menuStyles.menuItem}
                onMouseEnter={() => setIsExportSubmenuOpen(false)}
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenTemplates();
                }}
              >
                <span>📑</span>
                <span>Template</span>
              </button>

              <button
                type="button"
                className={menuStyles.menuItem}
                onMouseEnter={() => setIsExportSubmenuOpen(false)}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsCustomizeViewsOpen(true);
                }}
              >
                <span>🎛️</span>
                <span>Customize Views...</span>
              </button>

              <button
                type="button"
                className={`${menuStyles.menuItem} ${menuStyles.submenuTrigger}`}
                onMouseEnter={() => setIsExportSubmenuOpen(true)}
                onClick={() => setIsExportSubmenuOpen((v) => !v)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span>📥</span>
                  <span>Export</span>
                </span>
                <span className={menuStyles.submenuArrow}>▸</span>
              </button>

              <button
                type="button"
                className={menuStyles.menuItem}
                onMouseEnter={() => setIsExportSubmenuOpen(false)}
                onClick={async () => {
                  setIsMenuOpen(false);
                  if (project.status === 'archived') {
                    await updateProject(project.id, { status: 'active' });
                  } else {
                    await archiveProject(project.id);
                  }
                }}
              >
                <span>📦</span>
                <span>{project.status === 'archived' ? 'Unarchive Project' : 'Archive Project'}</span>
              </button>

              <div className={menuStyles.separator} />

              <button
                type="button"
                className={`${menuStyles.menuItem} ${menuStyles.menuItemDanger}`}
                onMouseEnter={() => setIsExportSubmenuOpen(false)}
                onClick={async () => {
                  setIsMenuOpen(false);
                  if (window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                    await deleteProject(project.id);
                    setActiveListId('smart_my_day');
                  }
                }}
              >
                <span>🗑️</span>
                <span>Delete Project</span>
              </button>
            </div>

            {/* Export Submenu */}
            {isExportSubmenuOpen && (
              <div
                className={menuStyles.menu}
                style={{
                  left: exportSubmenuPosX,
                  top: exportSubmenuPosY,
                  minWidth: exportSubmenuWidth,
                  zIndex: 1002,
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => setIsExportSubmenuOpen(true)}
              >
                <button
                  type="button"
                  className={menuStyles.menuItem}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsExportSubmenuOpen(false);
                    exportProjectToCsv(project, sections, tasks);
                  }}
                >
                  <span>📊</span>
                  <span>CSV Spreadsheet</span>
                </button>
                <button
                  type="button"
                  className={menuStyles.menuItem}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsExportSubmenuOpen(false);
                    exportProjectToMarkdown(project, sections, tasks, milestones);
                  }}
                >
                  <span>📝</span>
                  <span>Markdown Outline</span>
                </button>
                <button
                  type="button"
                  className={menuStyles.menuItem}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsExportSubmenuOpen(false);
                    exportProjectToPdf();
                  }}
                >
                  <span>🖨️</span>
                  <span>Print to PDF</span>
                </button>
              </div>
            )}
          </div>,
          document.getElementById('radix-portal') || document.body
        )}

      <div className={styles.bottomRow}>
        <ViewSwitcher
          currentView={currentView}
          availableViews={project.views}
          onViewChange={onViewChange}
          onUpdateViews={onUpdateViews}
          isCustomizeOpen={isCustomizeViewsOpen}
          onCustomizeOpenChange={setIsCustomizeViewsOpen}
        />
      </div>
    </header>
  );
}

export default ProjectHeader;
