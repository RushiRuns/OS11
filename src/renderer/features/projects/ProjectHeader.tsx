import React, { useState } from 'react';
import type { Project, Section, Milestone, Task } from '@shared/types/index.js';
import { ViewSwitcher, type ProjectViewMode } from './ViewSwitcher.js';
import { exportProjectToCsv, exportProjectToMarkdown, exportProjectToPdf } from './projectExport.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './ProjectHeader.module.css';

interface ProjectHeaderProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  milestones: Milestone[];
  currentView: ProjectViewMode;
  onViewChange: (view: ProjectViewMode) => void;
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
  onOpenMilestones,
  onOpenTemplates,
}: ProjectHeaderProps): React.ReactElement {
  const { archiveProject, deleteProject } = useProjectStore();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

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

  return (
    <header className={styles.headerContainer} aria-label="Project Details Header">
      <div className={styles.topRow}>
        <div className={styles.titleArea}>
          <span className={styles.projectIcon}>{project.icon || '📁'}</span>
          <div className={styles.titleText}>
            <h1 className={styles.titleHeading}>
              {project.name}
              {project.status === 'archived' && (
                <span className={`${styles.statusBadge} ${styles.statusArchived}`}>Archived</span>
              )}
            </h1>
            {project.description && <p className={styles.description}>{project.description}</p>}
          </div>
        </div>

        <div className={styles.statsAndActions}>
          {/* Progress Ring Overview */}
          <div className={styles.progressRingWrapper} title={`${percentage}% Completed`}>
            <svg className={styles.ringSvg} viewBox="0 0 44 44">
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
            <div className={styles.statsText}>
              <span className={styles.percentage}>{percentage}%</span>
              <div className={styles.counts}>
                <span>{completedTasks}/{totalTasks} done</span>
                {overdueTasks > 0 && (
                  <span className={styles.overdueCount}>• {overdueTasks} overdue</span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.actionsGroup}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onOpenMilestones}
              title="View & manage project milestones"
            >
              <span>◆</span>
              <span>Milestones ({milestones.length})</span>
            </button>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={onOpenTemplates}
              title="Export as reusable template or import"
            >
              <span>📑</span>
              <span>Template</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                title="Export project data"
              >
                <span>📥</span>
                <span>Export ▾</span>
              </button>

              {isExportMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'var(--surface-overlay)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 20,
                    minWidth: '140px',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    className={styles.actionBtn}
                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => {
                      exportProjectToCsv(project, sections, tasks);
                      setIsExportMenuOpen(false);
                    }}
                  >
                    CSV Spreadsheet
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => {
                      exportProjectToMarkdown(project, sections, tasks, milestones);
                      setIsExportMenuOpen(false);
                    }}
                  >
                    Markdown Outline
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}
                    onClick={() => {
                      exportProjectToPdf();
                      setIsExportMenuOpen(false);
                    }}
                  >
                    Print to PDF
                  </button>
                </div>
              )}
            </div>

            {project.status !== 'archived' ? (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => archiveProject(project.id)}
                title="Archive this project"
              >
                📦 Archive
              </button>
            ) : null}

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                  deleteProject(project.id);
                }
              }}
              title="Delete project"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <ViewSwitcher currentView={currentView} onViewChange={onViewChange} />
      </div>
    </header>
  );
}

export default ProjectHeader;
