import React, { memo, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  isSelected?: boolean;
  allTaskIds?: string[];
  isSubtaskTarget?: boolean;
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
  isSelected = false,
  allTaskIds,
  isSubtaskTarget = false,
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

  useEffect(() => {
    loadTagsForTask(task.id);
  }, [task.id, loadTagsForTask]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const sortableStyle: React.CSSProperties = {
    transform: transform
      ? `${CSS.Transform.toString(transform)}${isDragging ? ' scale(0.98)' : ''}`
      : undefined,
    transition,
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
      className={`${styles.taskCard} ${getPriorityClass(task.priority)} ${
        isSelected ? styles.taskCardSelected : ''
      }`}
      data-multiselect={isMultiSelectActive || isMultiSelected ? 'active' : 'inactive'}
      data-dragging={isDragging ? 'true' : 'false'}
      data-droptarget={isSubtaskTarget ? 'true' : 'false'}
      data-filedrop={fileOver ? 'true' : 'false'}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, task);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={() => setFileOver(false)}
      onDrop={async (e) => {
        setFileOver(false);
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

          {/* Row 3: Tags (if present) - styled with lighter notes color */}
          {taskTags.length > 0 && (
            <div className={styles.tagsRow}>
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
        {task.due_date && (
          <span
            className={`${styles.dueDateChip} ${
              isOverdueAndCritical
                ? styles.dueDateOverdueCritical
                : isOverdue
                ? styles.dueDateOverdue
                : ''
            }`}
          >
            {task.due_date}
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
