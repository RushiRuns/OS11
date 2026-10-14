import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Project, Section, Milestone, Task, CustomGroup } from '@shared/types/index.js';
import { ViewSwitcher, type ProjectViewMode } from './ViewSwitcher.js';
import { exportProjectToCsv, exportProjectToMarkdown, exportProjectToPdf } from './projectExport.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { useViewGroupStore, GROUP_BY_LABELS, type GroupByOption } from '../../stores/viewGroupStore.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { DropdownMenu, type DropdownMenuItemConfig } from '../../components/primitives/DropdownMenu/DropdownMenu.js';
import { CustomGroupPickerModal } from './CustomGroupPickerModal.js';
import { CustomGroupEditorModal } from './CustomGroupEditorModal.js';
import { isStalled } from '@shared/utils/project-health.js';
import { ViewSearch } from '../search/ViewSearch.js';
import type { ViewSearchState } from '../search/ViewSearchContext.js';
import styles from './ProjectHeader.module.css';
import menuStyles from '../lists/ListContextMenu.module.css';

const PROJECT_GROUP_BY_OPTIONS: GroupByOption[] = [
  'none',
  'custom',
  'time',
  'date',
  'tag',
  'priority',
];

interface ProjectHeaderProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  milestones: Milestone[];
  currentView: ProjectViewMode;
  searchState?: ViewSearchState;
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
  searchState,
  onViewChange,
  onUpdateViews,
  onOpenMilestones,
  onOpenTemplates,
}: ProjectHeaderProps): React.ReactElement {
  const { archiveProject, updateProject, deleteProject } = useProjectStore();
  const setActiveListId = useAppStore((state) => state.setActiveListId);
  const isSomedayEnabled = useModuleStore((state) => state.isEnabled('someday'));
  const stalled = isStalled(project, tasks);

  const viewId = `project:${project.id}`;
  const groupBy = useViewGroupStore((state) => state.getGroupBy(viewId));
  const isGroupByVisible = useViewGroupStore((state) => state.isVisible(viewId));
  const activeCustomGroupId = useViewGroupStore((state) => state.getActiveCustomGroup(viewId));
  const isHideEmpty = useViewGroupStore((state) => state.isHideEmpty(viewId));
  const { setGroupBy, toggleVisible, setHideEmpty } = useViewGroupStore.getState();

  const customGroups = useCustomGroupStore((state) => state.groups);
  const activeCustomGroup = customGroups.find((g) => g.id === activeCustomGroupId);

  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [isCustomEditorOpen, setIsCustomEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomGroup | null>(null);

  const customTriggerLabel =
    groupBy === 'custom'
      ? activeCustomGroup
        ? `Custom: ${activeCustomGroup.name}`
        : 'Custom'
      : GROUP_BY_LABELS[groupBy ?? 'none'];

  const groupByMenuItems: DropdownMenuItemConfig[] = React.useMemo(
    () =>
      PROJECT_GROUP_BY_OPTIONS.map((opt) => {
        let label = GROUP_BY_LABELS[opt];
        if (opt === 'custom' && activeCustomGroup) {
          label = `Custom: ${activeCustomGroup.name}`;
        }
        return {
          id: `groupby-${opt}`,
          label: `${label}${groupBy === opt ? ' ✓' : ''}`,
          onClick: () => {
            if (opt === 'custom') {
              setIsCustomPickerOpen(true);
            } else {
              setGroupBy(viewId, opt);
            }
          },
        };
      }),
    [groupBy, viewId, setGroupBy, activeCustomGroup]
  );

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExportSubmenuOpen, setIsExportSubmenuOpen] = useState(false);

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

  // Menu positioning
  const triggerRect = menuTriggerRef.current?.getBoundingClientRect();
  const menuWidth = 190;
  const menuHeight = 220;
  const posX = triggerRect
    ? Math.max(8, Math.min(triggerRect.right - menuWidth, window.innerWidth - menuWidth - 8))
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
            {project.status === 'archived' && (
              <span className={`${styles.statusBadge} ${styles.statusArchived}`}>Archived</span>
            )}
            {project.status === 'completed' && (
              <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>Completed</span>
            )}
            {project.is_someday === 1 && (
              <span className={styles.somedayBadge} title="Parked in Someday / Maybe">
                📦 Someday / Maybe
              </span>
            )}
            {stalled && (
              <span
                className={styles.stalledBadge}
                title="No incomplete active tasks scheduled. Add a next action or park it in Someday."
              >
                 ⚠️ Stalled: no next action
              </span>
            )}
          </div>
          {project.description && <p className={styles.description}>{project.description}</p>}
        </div>

        {/* Header Controls: View Cycle Button to the left of the Three-Dot Menu */}
        <div className={styles.headerControls}>
          {currentView === 'list' && isGroupByVisible && (
            <div className={styles.groupByControl}>
              <label className={styles.groupByLabel}>Group by:</label>
              {groupBy === 'custom' ? (
                <div className={styles.groupTriggerGroup}>
                  <button
                    type="button"
                    className={styles.groupTriggerBtn}
                    aria-label={`Group by: ${customTriggerLabel}`}
                    onClick={() => setIsCustomPickerOpen(true)}
                  >
                    <span>{customTriggerLabel}</span>
                  </button>
                  <DropdownMenu
                    trigger={
                      <button
                        type="button"
                        className={styles.groupTriggerChevronBtn}
                        aria-label="More grouping options"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    }
                    items={groupByMenuItems}
                    align="end"
                    compact
                  />
                </div>
              ) : (
                <DropdownMenu
                  trigger={
                    <button
                      type="button"
                      className={styles.groupTriggerBtn}
                      aria-label={`Group by: ${customTriggerLabel}`}
                    >
                      <span>{customTriggerLabel}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  }
                  items={groupByMenuItems}
                  align="end"
                  compact
                />
              )}
            </div>
          )}

          <ViewSearch searchState={searchState} />

          <ViewSwitcher
            currentView={currentView}
            availableViews={project.views}
            onViewChange={onViewChange}
            onUpdateViews={onUpdateViews}
          />

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
              {currentView === 'list' && (
                <>
                  <button
                    type="button"
                    className={menuStyles.menuItem}
                    onMouseEnter={() => setIsExportSubmenuOpen(false)}
                    onClick={() => {
                      setIsMenuOpen(false);
                      toggleVisible(viewId);
                    }}
                  >
                    <span>🗂️</span>
                    <span>Group by</span>
                  </button>
                  {groupBy === 'custom' && (
                    <button
                      type="button"
                      className={menuStyles.menuItem}
                      onMouseEnter={() => setIsExportSubmenuOpen(false)}
                      onClick={() => {
                        setIsMenuOpen(false);
                        setHideEmpty(viewId, !isHideEmpty);
                      }}
                    >
                      <span>{isHideEmpty ? '☑' : '☐'}</span>
                      <span>Hide empty sections</span>
                    </button>
                  )}
                  <div className={menuStyles.separator} />
                </>
              )}

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

              {isSomedayEnabled && (
                <button
                  type="button"
                  className={menuStyles.menuItem}
                  onMouseEnter={() => setIsExportSubmenuOpen(false)}
                  onClick={async () => {
                    setIsMenuOpen(false);
                    if (project.is_someday === 1 || project.status === 'parked') {
                      await updateProject(project.id, { is_someday: 0, status: 'active' });
                    } else {
                      await updateProject(project.id, { is_someday: 1, status: 'parked' });
                    }
                  }}
                >
                  <span>{project.is_someday === 1 ? '🚀' : '📦'}</span>
                  <span>{project.is_someday === 1 ? 'Unpark Project' : 'Park in Someday'}</span>
                </button>
              )}

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

      {/* Custom Group Modals */}
      {isCustomPickerOpen && (
        <CustomGroupPickerModal
          projectId={project.id}
          isOpen={isCustomPickerOpen}
          onClose={() => setIsCustomPickerOpen(false)}
          onOpenEditor={(g) => {
            setEditingGroup(g ?? null);
            setIsCustomEditorOpen(true);
          }}
        />
      )}

      {isCustomEditorOpen && (
        <CustomGroupEditorModal
          group={editingGroup}
          isOpen={isCustomEditorOpen}
          currentProjectId={project.id}
          onClose={() => {
            setIsCustomEditorOpen(false);
            setEditingGroup(null);
          }}
          onSaved={(savedGroup) => {
            if (!editingGroup) {
              useViewGroupStore.getState().setActiveCustomGroup(viewId, savedGroup.id);
              useViewGroupStore.getState().setGroupBy(viewId, 'custom');
              useCustomGroupStore.getState().setActiveProjectAndGroup(project.id, savedGroup.id);
            }
          }}
        />
      )}
    </header>
  );
}

export default ProjectHeader;
