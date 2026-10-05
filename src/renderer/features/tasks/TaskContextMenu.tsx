import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAreaStore } from '../../stores/areaStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useUndoRedoStore } from '../../hooks/useUndoRedo.js';
import { useModuleStore } from '../../stores/moduleStore.js';
import { DatePicker } from '../../components/DatePicker/DatePicker.js';
import type { Task } from '@shared/types/task.js';
import { showPrompt } from '../../components/PromptDialog/PromptDialog.js';
import styles from './TaskContextMenu.module.css';

export interface TaskContextMenuPosition {
  x: number;
  y: number;
}

export interface TaskContextMenuProps {
  task: Task | null;
  position: TaskContextMenuPosition | null;
  onClose: () => void;
  onToggleComplete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onSetPriority?: (id: string, priority: number) => void;
  onSetDueDate?: (id: string, date: string | null, time: string | null, allDay: boolean) => void;
  onToggleMyDay?: (id: string) => void;
  onMoveToList?: (id: string, listId: string) => void;
  onMoveTo?: (id: string, destination: { area_id: string | null; project_id: string | null }) => void;
  onDuplicate?: (id: string) => void;
  onCreateSubtask?: (parentId: string) => void;
  onOpenDetail?: (task: Task) => void;
  onDelete?: (id: string) => void;
}

/* --- SVG Icons --- */
function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MoveArrowIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className={styles.itemChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className={styles.itemIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FlagIcon({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <svg className={styles.flagIcon} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

const PRIORITIES = [
  { val: 0, title: 'Priority: None', color: 'var(--text-tertiary)' },
  { val: 1, title: 'Priority: Low', color: 'var(--priority-low, #3b82f6)' },
  { val: 2, title: 'Priority: Medium', color: 'var(--priority-medium, #eab308)' },
  { val: 3, title: 'Priority: High', color: 'var(--priority-high, #f97316)' },
  { val: 4, title: 'Priority: Critical', color: 'var(--priority-critical, #ef4444)' },
];

export function TaskContextMenu({
  task,
  position,
  onClose,
  onToggleStar,
  onSetPriority,
  onSetDueDate,
  onToggleMyDay,
  onMoveTo,
  onDelete,
}: TaskContextMenuProps): React.ReactElement | null {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoveSubMenu, setShowMoveSubMenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [subMenuCoords, setSubMenuCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const menuRef = useRef<HTMLDivElement>(null);
  const moveToItemRef = useRef<HTMLButtonElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const areas = useAreaStore((state) => state.orderedAreaIds.map((id) => state.areasById[id]).filter(Boolean));
  const projects = useProjectStore((state) => Object.values(state.projectsById).filter((p) => p.status !== 'archived'));
  const updateTask = useTaskStore((state) => state.updateTask);
  const isEnabled = useModuleStore((state) => state.isEnabled);
  const setBucket = useTaskStore((state) => state.setBucket);
  const setWaiting = useTaskStore((state) => state.setWaiting);
  const clearWaiting = useTaskStore((state) => state.clearWaiting);

  useEffect(() => {
    setShowDatePicker(false);
    setShowMoveSubMenu(false);
  }, [task, position]);

  // Viewport-aware positioning for main menu
  useLayoutEffect(() => {
    if (!position) return;

    const estimatedWidth = 220;
    const estimatedHeight = 270;
    const padding = 10;

    let posX = position.x;
    let posY = position.y;

    // Boundary detection & flipping
    if (posX + estimatedWidth > window.innerWidth - padding) {
      posX = Math.max(padding, posX - estimatedWidth);
    }
    if (posY + estimatedHeight > window.innerHeight - padding) {
      posY = Math.max(padding, posY - estimatedHeight);
    }

    setMenuCoords({ x: Math.max(padding, posX), y: Math.max(padding, posY) });
  }, [position]);

  // Viewport-aware positioning for floating sub-menu
  const calculateSubMenuPosition = () => {
    if (!moveToItemRef.current) return;
    const itemRect = moveToItemRef.current.getBoundingClientRect();
    const subMenuWidth = 210;
    const subMenuHeight = 260;
    const padding = 10;

    // Horizontal: prefer right side, flip to left if overflowing
    let subX = itemRect.right + 4;
    if (subX + subMenuWidth > window.innerWidth - padding) {
      subX = itemRect.left - subMenuWidth - 4;
    }

    // Vertical: align with item top, clamp or flip upwards if overflowing
    let subY = itemRect.top - 4;
    if (subY + subMenuHeight > window.innerHeight - padding) {
      subY = Math.max(padding, window.innerHeight - subMenuHeight - padding);
    }

    setSubMenuCoords({ x: Math.max(padding, subX), y: Math.max(padding, subY) });
  };

  const handleMoveToMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    calculateSubMenuPosition();
    setShowMoveSubMenu(true);
  };

  const handleMoveToMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowMoveSubMenu(false);
    }, 150);
  };

  const handleSubMenuMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleSubMenuMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowMoveSubMenu(false);
    }, 150);
  };

  // Close on Escape or outside interactions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, [onClose]);

  if (!task || !position) return null;

  const isStarred = task.is_starred === 1;
  const today = new Date().toISOString().split('T')[0];
  const isInMyDay = task.my_day_date === today;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        {/* Main Context Menu */}
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ top: `${menuCoords.y}px`, left: `${menuCoords.x}px` }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {/* Star / Unstar */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onToggleStar?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>
              <StarIcon filled={isStarred} />
            </span>
            <span className={styles.itemLabel}>{isStarred ? 'Remove Star' : 'Star Task'}</span>
          </button>

          {/* My Day */}
          <button
            type="button"
            className={styles.item}
            onClick={() => {
              onToggleMyDay?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>
              <SunIcon />
            </span>
            <span className={styles.itemLabel}>{isInMyDay ? 'Remove from My Day' : 'Add to My Day'}</span>
          </button>

          {/* Unschedule Time Block */}
          {typeof task.scheduled_start_min === 'number' && (
            <button
              type="button"
              className={styles.item}
              onClick={async () => {
                const prevStart = task.scheduled_start_min;
                const prevDuration = task.scheduled_duration_min;
                await useTaskStore.getState().unscheduleTask(task.id);
                if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
                  useUndoRedoStore.getState().pushAction({
                    description: `Unscheduled "${task.title}"`,
                    undoFn: async () => {
                      await useTaskStore.getState().updateTimeBlock(task.id, prevStart, prevDuration);
                    },
                    redoFn: async () => {
                      await useTaskStore.getState().unscheduleTask(task.id);
                    },
                  });
                }
                onClose();
              }}
            >
              <span className={styles.itemIcon}>
                <ClockIcon />
              </span>
              <span className={styles.itemLabel}>Unschedule</span>
            </button>
          )}

          {/* Set Due Date */}
          <button
            type="button"
            className={styles.item}
            onClick={() => setShowDatePicker(true)}
          >
            <span className={styles.itemIcon}>
              <CalendarIcon />
            </span>
            <span className={styles.itemLabel}>{task.due_date ? `Due: ${task.due_date}` : 'Set Due Date...'}</span>
          </button>

          {/* Move to... (Sub-floating menu trigger) */}
          <button
            ref={moveToItemRef}
            type="button"
            className={styles.item}
            onMouseEnter={handleMoveToMouseEnter}
            onMouseLeave={handleMoveToMouseLeave}
            onClick={() => {
              calculateSubMenuPosition();
              setShowMoveSubMenu((prev) => !prev);
            }}
          >
            <span className={styles.itemIcon}>
              <MoveArrowIcon />
            </span>
            <span className={styles.itemLabel}>Move to...</span>
            <ChevronRightIcon />
          </button>

          <div className={styles.divider} />

          {/* Priority Row (Clean Flags without labels or headers) */}
          <div className={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const isActive = task.priority === p.val;
              return (
                <button
                  key={p.val}
                  type="button"
                  title={p.title}
                  aria-label={p.title}
                  style={{ color: p.color }}
                  className={`${styles.priorityFlagBtn} ${isActive ? styles.priorityFlagBtnActive : ''}`}
                  onClick={() => {
                    onSetPriority?.(task.id, p.val);
                    onClose();
                  }}
                >
                  <FlagIcon color={p.color} filled={isActive} />
                </button>
              );
            })}
          </div>

          <div className={styles.divider} />

          {/* Delete Task */}
          <button
            type="button"
            className={`${styles.item} ${styles.itemDanger}`}
            onClick={() => {
              onDelete?.(task.id);
              onClose();
            }}
          >
            <span className={styles.itemIcon}>
              <TrashIcon />
            </span>
            <span className={styles.itemLabel}>Delete Task</span>
          </button>
        </div>

        {/* Sub-Floating Menu: Move to... */}
        {showMoveSubMenu && (
          <div
            ref={subMenuRef}
            className={styles.subMenu}
            style={{ top: `${subMenuCoords.y}px`, left: `${subMenuCoords.x}px` }}
            onMouseEnter={handleSubMenuMouseEnter}
            onMouseLeave={handleSubMenuMouseLeave}
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            {/* Waiting for */}
            {isEnabled('waiting_for') && (
              <button
                type="button"
                className={styles.item}
                onClick={async () => {
                  onClose();
                  if (task.waiting_on) {
                    await clearWaiting(task.id);
                  } else {
                    const person = await showPrompt({
                      title: 'Waiting For',
                      message: 'Waiting on whom or what?',
                      placeholder: 'e.g. Sarah for approval',
                    });
                    if (person && person.trim()) {
                      await setWaiting({ taskId: task.id, waitingOn: person.trim() });
                    }
                  }
                }}
              >
                <span className={styles.itemIcon}>
                  <HourglassIcon />
                </span>
                <span className={styles.itemLabel}>
                  {task.waiting_on ? `Waiting for: ${task.waiting_on} (Clear)` : 'Waiting for...'}
                </span>
              </button>
            )}

            {/* Anytime */}
            {isEnabled('anytime') && (
              <button
                type="button"
                className={styles.item}
                onClick={async () => {
                  await setBucket(task.id, task.bucket === 'anytime' ? null : 'anytime');
                  onClose();
                }}
              >
                <span className={styles.itemIcon}>
                  <ZapIcon />
                </span>
                <span className={styles.itemLabel}>
                  {task.bucket === 'anytime' ? 'Remove from Anytime' : 'Anytime'}
                </span>
              </button>
            )}

            {/* Someday */}
            {isEnabled('someday') && (
              <button
                type="button"
                className={styles.item}
                onClick={async () => {
                  await setBucket(task.id, task.bucket === 'someday' ? null : 'someday');
                  onClose();
                }}
              >
                <span className={styles.itemIcon}>
                  <BoxIcon />
                </span>
                <span className={styles.itemLabel}>
                  {task.bucket === 'someday' ? 'Remove from Someday' : 'Someday'}
                </span>
              </button>
            )}

            <div className={styles.divider} />

            {/* Inbox */}
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                if (onMoveTo) {
                  onMoveTo(task.id, { area_id: null, project_id: null });
                }
                updateTask({
                  id: task.id,
                  area_id: null,
                  project_id: null,
                  list_id: 'list_inbox',
                  my_day_date: null,
                  due_date: null,
                  due_time: null,
                  bucket: null,
                  waiting_on: null,
                  waiting_since: null,
                  follow_up_date: null,
                });
                onClose();
              }}
            >
              <span className={styles.itemIcon}>
                <InboxIcon />
              </span>
              <span className={styles.itemLabel}>Inbox</span>
            </button>

            {/* Areas & Projects */}
            {areas.map((area) => {
              const areaProjects = projects.filter((p) => p.area_id === area.id);
              return (
                <React.Fragment key={area.id}>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => {
                      if (onMoveTo) {
                        onMoveTo(task.id, { area_id: area.id, project_id: null });
                      } else {
                        updateTask({ id: task.id, area_id: area.id, project_id: null, list_id: null });
                      }
                      onClose();
                    }}
                  >
                    <span className={styles.itemIcon}>
                      <FolderIcon />
                    </span>
                    <span className={styles.itemLabel}>{area.name}</span>
                  </button>
                  {areaProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.item} ${styles.subNestedItem}`}
                      onClick={() => {
                        if (onMoveTo) {
                          onMoveTo(task.id, { area_id: p.area_id ?? null, project_id: p.id });
                        } else {
                          updateTask({ id: task.id, area_id: p.area_id ?? null, project_id: p.id, list_id: p.id });
                        }
                        onClose();
                      }}
                    >
                      <span className={styles.itemIcon}>
                        <FolderIcon />
                      </span>
                      <span className={styles.itemLabel}>{p.name}</span>
                    </button>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline Date Picker modal */}
      {showDatePicker && (
        <DatePicker
          initialDate={task.due_date}
          initialTime={task.due_time}
          initialAllDay={task.all_day === 1}
          initialBucket={task.bucket}
          position={{ x: menuCoords.x + 225, y: menuCoords.y }}
          onSelect={(date, time, allDay) => {
            onSetDueDate?.(task.id, date, time, allDay);
            setShowDatePicker(false);
            onClose();
          }}
          onSelectBucket={(bucket) => {
            setBucket(task.id, bucket);
            setShowDatePicker(false);
            onClose();
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </>
  );
}

export default TaskContextMenu;
