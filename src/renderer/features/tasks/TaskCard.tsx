import React, { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { useSelectionStore } from '../../stores/selectionStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { useAppStore } from '../../stores/app-store.js';
import { TagPicker } from '../tags/TagPicker.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { useAttachmentStore } from '../../stores/attachmentStore.js';
import type { Task } from '@shared/types/task.js';
import { getTagShapeClass } from '@shared/utils/tag-shape.js';
import styles from './TaskCard.module.css';

export interface TaskCardProps {
  task: Task;
  depth?: number;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  subtaskCount?: { completed: number; total: number };
  onToggleExpand?: (taskId: string) => void;
  isSelected?: boolean;
  allTaskIds?: string[];
  variant?: 'standard' | 'project';
  onOpenDetail?: (task: Task) => void;
  onSelect?: (task: Task) => void;
  onToggleComplete?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onUpdateTitle?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onFileDrop?: (taskId: string, files: FileList) => void;
}

export const TaskCard = memo(function TaskCard({
  task,
  depth = 0,
  hasSubtasks = false,
  isExpanded = true,
  subtaskCount,
  onToggleExpand,
  isSelected = false,
  allTaskIds,
  variant = 'standard',
  onOpenDetail,
  onSelect,
  onToggleComplete,
  onToggleStar,
  onUpdateTitle,
  onDelete,
  onDuplicate,
  onContextMenu,
  onFileDrop,
}: TaskCardProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [fileOver, setFileOver] = useState(false);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { selectedIds, isMultiSelectActive, toggleSelect, selectRange } = useSelectionStore();
  const isMultiSelected = selectedIds.has(task.id);

  const taskTags = useTagStore((state) => state.getTagsForTask(task.id));
  const loadTagsForTask = useTagStore((state) => state.loadTagsForTask);
  const attachmentCount = useAttachmentStore((state) => state.countsByTaskId[task.id] ?? 0);

  const formattedDueDate = useMemo(() => {
    if (!task.due_date) return null;
    const parts = task.due_date.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${m}/${d}/${y}`;
    }
    return task.due_date;
  }, [task.due_date]);

  const hasSubtaskBadge = Boolean(hasSubtasks && subtaskCount && subtaskCount.total > 0);
  const hasMetadataRow = Boolean(formattedDueDate || taskTags.length > 0 || hasSubtaskBadge);

  useEffect(() => {
    loadTagsForTask(task.id);
  }, [task.id, loadTagsForTask]);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id: task.id });

  // No transform/transition here on purpose: TaskList now shows a floating
  // DragOverlay preview that follows the pointer plus a separate drop-line
  // indicator, instead of this row sliding around in place. This row just
  // hides itself while it's the one being dragged.
  const sortableStyle: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
    marginLeft: depth > 0 ? `${depth * 28 - 12}px` : undefined,
  };

  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveTitle = () => {
    setIsEditing(false);
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdateTitle?.(task.id, editTitle.trim());
    } else {
      setEditTitle(task.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault();
      e.stopPropagation();
      setIsTagPickerOpen(true);
      return;
    }
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(task.title);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    if (e.shiftKey) {
      e.stopPropagation();
      selectRange(allTaskIds || [], task.id);
      return;
    }
    if (isMultiSelectActive) {
      e.stopPropagation();
      toggleSelect(task.id);
      return;
    }
    onSelect?.(task);
  };

  // Priority border class
  const getPriorityClass = (p: number) => {
    switch (p) {
      case 1:
        return styles.priority1;
      case 2:
        return styles.priority2;
      case 3:
        return styles.priority3;
      case 4:
        return `${styles.priority4} ${styles.priorityCriticalPulse}`;
      default:
        return '';
    }
  };

  // Check if overdue
  const isOverdue =
    Boolean(task.due_date) &&
    task.is_completed === 0 &&
    new Date(task.due_date!).getTime() < new Date().setHours(0, 0, 0, 0);

  const isOverdueAndCritical = isOverdue && task.priority >= 3;

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      {...attributes}
      {...listeners}
      // NOTE: Task reordering + "drop onto a card to nest as a subtask" is handled
      // ENTIRELY by @dnd-kit (via the {...attributes}/{...listeners} above, plus
      // handleDragOver/handleDragEnd in TaskList.tsx). This card is intentionally
      // NOT natively `draggable` and no longer starts a native HTML5 drag for
      // task-to-task moves - that used to run *in parallel* with dnd-kit's pointer
      // based drag and the two systems fought over the same pointerdown, which is
      // why nesting felt broken/inconsistent. The native onDragOver/onDrop below
      // are kept ONLY for dropping real OS files (e.g. from Finder/Explorer) onto
      // a card to attach them - that is a different feature and still needs them.
      className={`${styles.taskCard} ${getPriorityClass(task.priority)} ${
        isSelected ? styles.taskCardSelected : ''
      }`}
      data-multiselect={isMultiSelectActive || isMultiSelected ? 'active' : 'inactive'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-filedrop={fileOver ? 'true' : 'false'}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, task);
      }}
      onDragOver={(e) => {
        // Only react to real OS file drags here. Internal task-card drags are
        // handled by dnd-kit and must never be intercepted by this handler.
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={async (e) => {
        setFileOver(false);
        // Only real OS files are handled here now. Task-to-task nesting is
        // handled by dnd-kit's onDragEnd in TaskList.tsx, not here.
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (onFileDrop) {
            onFileDrop(task.id, e.dataTransfer.files);
          } else {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
              const filePath = (e.dataTransfer.files[i] as unknown as { path?: string }).path;
              if (filePath) {
                try {
                  await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, { taskId: task.id, sourcePath: filePath });
                } catch {
                  // ignore
                }
              }
            }
            useAttachmentStore.getState().incrementCount(task.id, e.dataTransfer.files.length);
          }
        }
      }}
      tabIndex={0}
      role="row"
      aria-selected={isSelected || isMultiSelected}
    >
      {/* Multi-Select Checkbox (only rendered when multi-select is active) */}
      {(isMultiSelectActive || isMultiSelected) && (
        <div
          className={styles.multiSelectCheckboxWrap}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (e.shiftKey) {
              selectRange(allTaskIds || [], task.id);
            } else {
              toggleSelect(task.id);
            }
          }}
        >
          <input
            type="checkbox"
            className={styles.multiSelectInput}
            checked={isMultiSelected}
            onChange={() => {}}
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Subtask Chevron Toggle (Positioned in left gutter; reveals on hover without shifting card) */}
      {hasSubtasks && (
        <button
          type="button"
          className={`${styles.subtaskChevronBtn} ${isExpanded ? styles.subtaskChevronExpanded : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.(task.id);
          }}
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <span className={styles.subtaskChevron}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </button>
      )}

      {/* Checkbox */}
      <div
        className={`${styles.checkboxWrap} ${variant !== 'project' ? styles.circularCheckbox : ''}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(task.id);
        }}
      >
        <Checkbox
          checked={task.is_completed === 1}
          onChange={() => onToggleComplete?.(task.id)}
          ariaLabel={`Mark "${task.title}" as ${task.is_completed === 1 ? 'incomplete' : 'complete'}`}
        />
      </div>

      {variant !== 'project' ? (
        /* Standard View: Multi-Layer Apple Reminders Layout */
        <div className={styles.contentColumn}>
          {/* Row 1: Title */}
          <div className={styles.titleArea}>
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className={styles.titleInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Edit title for ${task.title}`}
              />
            ) : (
              <span
                className={`${styles.titleText} ${
                  task.is_completed === 1 ? styles.completedTitle : ''
                }`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                title={task.title}
              >
                {task.title}
              </span>
            )}
          </div>

          {/* Row 2: Notes (if present) - lighter text */}
          {task.notes && (
            <div className={styles.notesRow} title={task.notes}>
              <span className={styles.notesText}>{task.notes}</span>
            </div>
          )}

          {/* Row 3: Unified Metadata Row: [Due Date] · [Tags] · [Subtask Progress] */}
          {hasMetadataRow && (
            <div className={styles.metadataRow}>
              {formattedDueDate && (
                <span
                  className={`${styles.metaDate} ${
                    isOverdue ? styles.metaDateOverdue : ''
                  }`}
                  title={`Due: ${formattedDueDate}`}
                >
                  {formattedDueDate}
                </span>
              )}

              {formattedDueDate && (taskTags.length > 0 || hasSubtaskBadge) && (
                <span className={styles.metaDot} aria-hidden="true">
                  ·
                </span>
              )}

              {taskTags.length > 0 && (
                <div className={styles.tagsGroup}>
                  {taskTags.map((tag) => (
                    <span
                      key={tag.id}
                      className={styles.inlineTagPill}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setActiveListId(`tag:${tag.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          useAppStore.getState().setActiveListId(`tag:${tag.id}`);
                        }
                      }}
                      title={`Tag: #${tag.name}`}
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}

              {taskTags.length > 0 && hasSubtaskBadge && (
                <span className={styles.metaDot} aria-hidden="true">
                  ·
                </span>
              )}

              {hasSubtaskBadge && subtaskCount && (
                <div
                  className={styles.subtaskCountBadge}
                  title={`${subtaskCount.completed} of ${subtaskCount.total} subtasks completed`}
                >
                  <span className={styles.subtaskCountIcon}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="2" y="2" width="12" height="4" rx="2" />
                      <path d="M4 6v3.5a2 2 0 0 0 2 2h1" />
                      <rect x="7" y="9.5" width="7" height="4" rx="2" />
                    </svg>
                  </span>
                  <span>
                    {subtaskCount.completed}/{subtaskCount.total}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Project View: Compact Single-Line Title */
        <div className={styles.titleArea}>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              className={styles.titleInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Edit title for ${task.title}`}
            />
          ) : (
            <span
              className={`${styles.titleText} ${
                task.is_completed === 1 ? styles.completedTitle : ''
              }`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title={task.title}
            >
              {task.title}
            </span>
          )}
        </div>
      )}

      {/* Layer 2: Metadata Badges (Hover/Focus progressive disclosure) */}
      <div className={styles.metadataWrap}>
        {variant === 'project' && task.due_date && (
          <span
            className={`${styles.dueDateChip} ${
              isOverdueAndCritical
                ? styles.dueDateOverdueCritical
                : isOverdue
                ? styles.dueDateOverdue
                : ''
            }`}
          >
            {formattedDueDate || task.due_date}
          </span>
        )}

        {variant === 'project' &&
          taskTags.map((tag) => (
            <span
              key={tag.id}
              className={styles.tagDotPill}
              role="button"
              tabIndex={0}
              aria-label={`Filter by tag ${tag.name}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                useAppStore.getState().setActiveListId(`tag:${tag.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  useAppStore.getState().setActiveListId(`tag:${tag.id}`);
                }
              }}
              title={`Tag: #${tag.name}`}
            >
              <span
                className={`${styles.tagDot} ${getTagShapeClass(tag.id || tag.name)}`}
                style={{ background: tag.color ?? 'var(--tag-gray)' }}
                aria-hidden="true"
              />
              <span>#{tag.name}</span>
            </span>
          ))}

        {task.pomodoro_count > 0 && (
          <span className={styles.badgePill} title="Completed Pomodoro Sessions">
            🍅 ×{task.pomodoro_count}
          </span>
        )}

        {task.recurrence_rule && (
          <span className={styles.badgePill} title="Recurring Task">
            🔄
          </span>
        )}

        {attachmentCount > 0 && (
          <span className={styles.badgePill} title={`${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}>
            📎 ×{attachmentCount}
          </span>
        )}
      </div>

      {/* Layer 3: Action Buttons (only in project variant; standard views use sidebar icon) */}
      {variant === 'project' && (
        <div
          className={styles.actionsRow}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.iconButton}
            onClick={(e) => {
              e.stopPropagation();
              setIsTagPickerOpen(true);
            }}
            title="Tags (Ctrl+T)"
            aria-label="Manage Tags"
          >
            🏷️
          </button>

          <button
            type="button"
            className={`${styles.iconButton} ${
              task.is_starred === 1 ? styles.starButtonActive : ''
            }`}
            onClick={() => onToggleStar?.(task.id)}
            title={task.is_starred === 1 ? 'Unstar' : 'Star'}
            aria-label="Toggle Star"
          >
            ★
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onDuplicate?.(task.id)}
            title="Duplicate Task"
            aria-label="Duplicate Task"
          >
            ⧉
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onDelete?.(task.id)}
            title="Move to Trash"
            aria-label="Delete Task"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dedicated Hover Sidebar Trigger Icon (standard views) */}
      {variant !== 'project' && (
        <button
          type="button"
          className={styles.sidebarTriggerBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail?.(task);
          }}
          title="Open task details"
          aria-label="Open task details"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>
      )}

      {isTagPickerOpen && (
        <TagPicker
          taskId={task.id}
          selectedTagIds={taskTags.map((t) => t.id)}
          onClose={() => setIsTagPickerOpen(false)}
        />
      )}
    </div>
  );
});

export default TaskCard;
