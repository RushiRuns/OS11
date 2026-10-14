import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectionStore } from '../../stores/selectionStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { useUndoRedo } from '../../hooks/useUndoRedo.js';
import styles from './BulkActionBar.module.css';

export function BulkActionBar(): React.ReactElement {
  const storeSelection = useSelectionStore();
  const { selectedIds, isMultiSelectActive, clearSelection } =
    typeof window === 'undefined' ? useSelectionStore.getState() : storeSelection;

  const storeTasks = useTaskStore();
  const { tasksById, updateTask, deleteTask, restoreTask } =
    typeof window === 'undefined' ? useTaskStore.getState() : storeTasks;
  const areas = useAreaStore((state) => state.orderedAreaIds.map((id) => state.areasById[id]).filter(Boolean));
  const projects = useProjectStore((state) => Object.values(state.projectsById).filter((p) => p.status !== 'archived'));
  const { pushAction } = useUndoRedo();

  const [showPriorityPopover, setShowPriorityPopover] = useState(false);
  const [showMovePopover, setShowMovePopover] = useState(false);
  const [showSectionPopover, setShowSectionPopover] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiSelectActive) {
        e.preventDefault();
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiSelectActive, clearSelection]);

  const count = selectedIds.size;
  const idsArray = Array.from(selectedIds);

  const activeProjectIds = new Set(
    idsArray.map((id) => tasksById[id]?.project_id).filter(Boolean)
  );
  const commonProjectId = activeProjectIds.size === 1 ? Array.from(activeProjectIds)[0] : null;
  const hookActiveGroupId = commonProjectId
    ? useViewGroupStore((state) => state.getActiveCustomGroup(`project:${commonProjectId}`))
    : null;
  const activeGroupId = typeof window === 'undefined'
    ? (commonProjectId ? useViewGroupStore.getState().getActiveCustomGroup(`project:${commonProjectId}`) : null)
    : hookActiveGroupId;

  const hookCustomGroups = useCustomGroupStore((state) => state.groups);
  const customGroups = typeof window === 'undefined' ? useCustomGroupStore.getState().groups : hookCustomGroups;
  const activeCustomGroup = commonProjectId && activeGroupId
    ? customGroups.find((g) => g.id === activeGroupId)
    : null;
  const hookCustomOverrides = useCustomGroupStore((state) => state.overrides);
  const customOverrides = typeof window === 'undefined' ? useCustomGroupStore.getState().overrides : hookCustomOverrides;

  const handleBulkMoveToSection = async (sectionId: string | null) => {
    await useCustomGroupStore.getState().moveTasks(idsArray, sectionId);
    setShowSectionPopover(false);
    clearSelection();
  };

  const handleBulkComplete = async () => {
    const now = new Date().toISOString();
    for (const id of idsArray) {
      await updateTask({ id, is_completed: 1, completed_at: now });
    }
    clearSelection();
  };

  const handleBulkDelete = async () => {
    const targets = idsArray.map((id) => tasksById[id]).filter(Boolean);
    for (const id of idsArray) {
      await deleteTask(id);
    }

    pushAction({
      description: `Deleted ${count} tasks`,
      undoFn: async () => {
        for (const t of targets) {
          await restoreTask(t.id);
        }
      },
      redoFn: async () => {
        for (const t of targets) {
          await deleteTask(t.id);
        }
      },
    });

    clearSelection();
  };

  const handleBulkMove = async (target: { area_id: string | null; project_id: string | null }) => {
    for (const id of idsArray) {
      await updateTask({
        id,
        area_id: target.area_id,
        project_id: target.project_id,
        list_id: target.project_id,
      });
    }
    setShowMovePopover(false);
    clearSelection();
  };

  const handleBulkPriority = async (priority: number) => {
    for (const id of idsArray) {
      await updateTask({ id, priority });
    }
    setShowPriorityPopover(false);
    clearSelection();
  };

  const handleBulkMyDay = async () => {
    const today = new Date().toISOString().split('T')[0];
    for (const id of idsArray) {
      await updateTask({ id, my_day_date: today });
    }
    clearSelection();
  };

  return (
    <AnimatePresence>
      {isMultiSelectActive && count > 0 && (
        <motion.div
          className={styles.barContainer}
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="toolbar"
          aria-label="Bulk actions toolbar"
        >
          <span className={styles.countBadge}>{count} selected</span>

          <div className={styles.actionsGroup}>
            {/* Complete */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleBulkComplete}
              title="Complete all selected tasks"
            >
              <span>✓</span>
              <span>Complete</span>
            </button>

            {/* My Day */}
            <button
              type="button"
              className={styles.actionBtn}
              onClick={handleBulkMyDay}
              title="Add all to My Day"
            >
              <span>☀️</span>
              <span>My Day</span>
            </button>

            {/* Section Popover Toggle */}
            {activeCustomGroup && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => {
                    setShowSectionPopover(!showSectionPopover);
                    setShowPriorityPopover(false);
                    setShowMovePopover(false);
                  }}
                  title="Move all to section"
                >
                  <span>🗂️</span>
                  <span>Section</span>
                </button>

                {showSectionPopover && (
                  <div className={styles.moveListPopover} style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <button
                      type="button"
                      className={styles.moveListItem}
                      onClick={() => handleBulkMoveToSection(null)}
                    >
                      <span>Unsorted</span>
                    </button>

                    {(activeCustomGroup.sections ?? [])
                      .filter((s) => !customOverrides.some((o) => o.section_id === s.id && o.is_hidden === 1))
                      .map((sec) => {
                        const override = customOverrides.find((o) => o.section_id === sec.id);
                        const secName = override?.name_override ?? sec.name;

                        return (
                          <button
                            key={sec.id}
                            type="button"
                            className={styles.moveListItem}
                            onClick={() => handleBulkMoveToSection(sec.id)}
                          >
                            <span>{secName}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Priority Popover Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setShowPriorityPopover(!showPriorityPopover);
                  setShowMovePopover(false);
                  setShowSectionPopover(false);
                }}
                title="Set priority for all"
              >
                <span>!</span>
                <span>Priority</span>
              </button>

              {showPriorityPopover && (
                <div className={styles.priorityPopover}>
                  {[
                    { val: 0, label: 'None' },
                    { val: 1, label: '!Low' },
                    { val: 2, label: '!Med' },
                    { val: 3, label: '!High' },
                    { val: 4, label: '!Crit' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleBulkPriority(p.val)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Move to List Toggle */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  setShowMovePopover(!showMovePopover);
                  setShowPriorityPopover(false);
                  setShowSectionPopover(false);
                }}
                title="Move all to list"
              >
                <span>📋</span>
                <span>Move</span>
              </button>

              {showMovePopover && (
                <div className={styles.moveListPopover} style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {/* Inbox */}
                  <button
                    type="button"
                    className={styles.moveListItem}
                    onClick={() => handleBulkMove({ area_id: null, project_id: null })}
                  >
                    <span>📥</span>
                    <span>Inbox</span>
                  </button>

                  {/* Areas & Projects */}
                  {areas.map((area) => {
                    const areaProjects = projects.filter((p) => p.area_id === area.id);
                    return (
                      <React.Fragment key={area.id}>
                        <button
                          type="button"
                          className={styles.moveListItem}
                          onClick={() => handleBulkMove({ area_id: area.id, project_id: null })}
                        >
                          <span>{area.icon || '📁'}</span>
                          <span>{area.name} (Loose)</span>
                        </button>
                        {areaProjects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={styles.moveListItem}
                            style={{ paddingLeft: '24px' }}
                            onClick={() => handleBulkMove({ area_id: p.area_id ?? area.id, project_id: p.id })}
                          >
                            <span>{p.icon || '📁'}</span>
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.divider} />

            {/* Delete */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={handleBulkDelete}
              title="Delete all selected tasks"
            >
              <span>✕</span>
              <span>Delete</span>
            </button>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={clearSelection}
            title="Deselect all (Esc)"
            aria-label="Exit multi-select mode"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BulkActionBar;
