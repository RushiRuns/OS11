import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Project, Section, Task } from '@shared/types/index.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import styles from './ProjectTableView.module.css';
import menuStyles from '../lists/ListContextMenu.module.css';

interface ProjectTableViewProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string | null;
}

type ColumnKey =
  | 'status'
  | 'title'
  | 'due_date'
  | 'priority'
  | 'tags'
  | 'estimated_minutes'
  | 'section'
  | 'assignee';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultWidth: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'status', label: 'Status', defaultWidth: 60 },
  { key: 'title', label: 'Title', defaultWidth: 280 },
  { key: 'due_date', label: 'Due Date', defaultWidth: 130 },
  { key: 'priority', label: 'Priority', defaultWidth: 110 },
  { key: 'tags', label: 'Tags', defaultWidth: 150 },
  { key: 'estimated_minutes', label: 'Est. Time', defaultWidth: 90 },
  { key: 'section', label: 'Section', defaultWidth: 130 },
  { key: 'assignee', label: 'Assignee', defaultWidth: 110 },
];

function formatDueDate(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  const parts = dueDate.split('T')[0].split('-');
  if (parts.length === 3) {
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[month - 1] || parts[1];
    return `${monthName} ${day}`;
  }
  return dueDate;
}

function isDateOverdue(dueDate?: string | null, isCompleted?: number): boolean {
  if (!dueDate || isCompleted === 1) return false;
  const d = new Date(dueDate.split('T')[0] + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function ProjectTableView({
  project,
  sections,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectTableViewProps): React.ReactElement {
  const {
    createTask,
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    duplicateTask,
    makeSubtask,
  } = useTaskStore();
  const { getTagsForTask, loadTagsForTask } = useTagStore();

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    status: true,
    title: true,
    due_date: true,
    priority: true,
    tags: true,
    estimated_minutes: true,
    section: true,
    assignee: true,
  });

  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>({
    status: 60,
    title: 280,
    due_date: 130,
    priority: 110,
    tags: 150,
    estimated_minutes: 90,
    section: 130,
    assignee: 110,
  });

  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [activeResizingKey, setActiveResizingKey] = useState<ColumnKey | null>(null);

  // Quick add row state
  const [newRowTitle, setNewRowTitle] = useState('');
  const addRowInputRef = useRef<HTMLInputElement>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const pickerDropdownRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);

  // Load tags for active tasks
  useEffect(() => {
    for (const t of tasks) {
      loadTagsForTask(t.id);
    }
  }, [tasks, loadTagsForTask]);

  // Column picker click-outside and Escape listener
  useEffect(() => {
    if (!isColumnPickerOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pickerDropdownRef.current?.contains(target) ||
        pickerBtnRef.current?.contains(target)
      ) {
        return;
      }
      setIsColumnPickerOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColumnPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isColumnPickerOpen]);

  // Column picker toggle
  const handleToggleColumnPicker = () => {
    if (isColumnPickerOpen) {
      setIsColumnPickerOpen(false);
      return;
    }

    if (pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const width = 170;
      const x = Math.min(rect.right - width, window.innerWidth - width - 8);
      const y = rect.bottom + 4;
      setPickerPos({ x: Math.max(8, x), y });
      setIsColumnPickerOpen(true);
    }
  };

  // Column resizing handler
  const handleResizeStart = (e: React.MouseEvent, key: ColumnKey) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveResizingKey(key);
    const startX = e.clientX;
    const startWidth = columnWidths[key];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(50, startWidth + delta),
      }));
    };

    const handleMouseUp = () => {
      setActiveResizingKey(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Sort click
  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    const list = tasks.filter((t) => t.is_trashed === 0);
    if (!sortKey) return list;

    return [...list].sort((a, b) => {
      let res = 0;
      if (sortKey === 'title') {
        res = a.title.localeCompare(b.title);
      } else if (sortKey === 'due_date') {
        res = (a.due_date || '').localeCompare(b.due_date || '');
      } else if (sortKey === 'priority') {
        res = a.priority - b.priority;
      } else if (sortKey === 'status') {
        res = a.is_completed - b.is_completed;
      } else if (sortKey === 'estimated_minutes') {
        res = (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
      } else if (sortKey === 'section') {
        const sA = a.section_id ? (sectionMap.get(a.section_id) || '') : '';
        const sB = b.section_id ? (sectionMap.get(b.section_id) || '') : '';
        res = sA.localeCompare(sB);
      }
      return sortOrder === 'asc' ? res : -res;
    });
  }, [tasks, sortKey, sortOrder, sectionMap]);

  // Handle fast row creation
  const handleNewRowKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const title = newRowTitle.trim();
      if (!title) return;

      await createTask({
        title,
        project_id: project.id,
        list_id: 'smart_all',
        section_id: sections[0]?.id ?? null,
      });
      setNewRowTitle('');
    } else if (e.key === 'Escape') {
      setNewRowTitle('');
      (e.target as HTMLInputElement).blur();
    }
  };

  // Visible column count for colSpan
  const visibleColCount = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns[c.key]).length,
    [visibleColumns]
  );

  const completedCount = useMemo(
    () => tasks.filter((t) => t.is_completed === 1 && t.is_trashed === 0).length,
    [tasks]
  );

  return (
    <div className={styles.tableContainer}>
      {/* Table Toolbar */}
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.metricsBadge} aria-label="Task summary metrics">
            <span className={styles.metricsDot} />
            <span>
              {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'}
            </span>
            <span>•</span>
            <span>{completedCount} completed</span>
          </div>
        </div>

        <div className={styles.toolbarActions}>
          <button
            ref={pickerBtnRef}
            type="button"
            className={styles.toolbarBtn}
            onClick={handleToggleColumnPicker}
            aria-label="Customize columns"
          >
            <span>⚙</span>
            <span>Columns ({visibleColCount})</span>
          </button>

          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() => addRowInputRef.current?.focus()}
            aria-label="Add new task row"
          >
            <span>＋</span>
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Column Picker Portal */}
      {isColumnPickerOpen &&
        pickerPos &&
        ReactDOM.createPortal(
          <>
            <div
              className={menuStyles.overlay}
              onClick={() => setIsColumnPickerOpen(false)}
            />
            <div
              ref={pickerDropdownRef}
              className={styles.columnPickerPopover}
              style={{
                left: pickerPos.x,
                top: pickerPos.y,
              }}
              role="dialog"
              aria-label="Column visibility settings"
            >
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className={styles.columnPickerItem}>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [col.key]: e.target.checked,
                      }))
                    }
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </>,
          document.body
        )}

      {/* Table Scroll Wrapper */}
      <div className={styles.scrollWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {ALL_COLUMNS.map((col) => {
                if (!visibleColumns[col.key]) return null;
                const isSorted = sortKey === col.key;

                return (
                  <th
                    key={col.key}
                    className={styles.th}
                    style={{ width: columnWidths[col.key] }}
                  >
                    <div
                      className={styles.thContent}
                      onClick={() => handleSort(col.key)}
                      title={`Sort by ${col.label}`}
                    >
                      <span>{col.label}</span>
                      {isSorted && (
                        <span className={styles.sortArrow}>
                          {sortOrder === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    <div
                      className={`${styles.resizer} ${
                        activeResizingKey === col.key ? styles.resizerActive : ''
                      }`}
                      onMouseDown={(e) => handleResizeStart(e, col.key)}
                      title="Drag to resize column"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const isCompleted = task.is_completed === 1;
              const tags = getTagsForTask(task.id);
              const overdue = isDateOverdue(task.due_date, task.is_completed);

              return (
                <tr
                  key={task.id}
                  className={`${styles.tr} ${isSelected ? styles.trSelected : ''} ${
                    isCompleted ? styles.trCompleted : ''
                  }`}
                  onClick={() => onSelectTask(task)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuTask(task);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectTask(task);
                  }}
                >
                  {/* Status Checkbox */}
                  {visibleColumns.status && (
                    <td
                      className={styles.tdCenter}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.checkboxWrap}>
                        <Checkbox
                          checked={isCompleted}
                          onChange={() => toggleComplete(task.id)}
                        />
                      </div>
                    </td>
                  )}

                  {/* Title (inline editable) */}
                  {visibleColumns.title && (
                    <td className={styles.td}>
                      <input
                        type="text"
                        className={`${styles.inlineInput} ${
                          isCompleted ? styles.titleCompleted : ''
                        }`}
                        defaultValue={task.title}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val && val !== task.title) {
                            updateTask({ id: task.id, title: val });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}

                  {/* Due Date */}
                  {visibleColumns.due_date && (
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        className={`${styles.datePickerInput} ${
                          overdue ? styles.overdueChip : ''
                        }`}
                        value={task.due_date ?? ''}
                        onChange={(e) =>
                          updateTask({ id: task.id, due_date: e.target.value || null })
                        }
                        title={
                          overdue
                            ? `Overdue (${formatDueDate(task.due_date)})`
                            : formatDueDate(task.due_date) || 'Set due date'
                        }
                      />
                    </td>
                  )}

                  {/* Priority Pill Select */}
                  {visibleColumns.priority && (
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      <div
                        className={`${styles.priorityPill} ${
                          task.priority > 0 ? styles[`priorityPill${task.priority}`] : ''
                        }`}
                        title="Change priority"
                      >
                        {task.priority > 0 && <span className={styles.priorityDot} />}
                        <select
                          className={styles.prioritySelect}
                          value={task.priority}
                          onChange={(e) =>
                            updateTask({ id: task.id, priority: Number(e.target.value) })
                          }
                          aria-label="Task priority"
                        >
                          <option value="0">— None</option>
                          <option value="1">Low</option>
                          <option value="2">Med</option>
                          <option value="3">High</option>
                          <option value="4">Critical</option>
                        </select>
                      </div>
                    </td>
                  )}

                  {/* Tags */}
                  {visibleColumns.tags && (
                    <td className={styles.td}>
                      <div className={styles.tagsWrap}>
                        {tags.length > 0 ? (
                          tags.map((tg) => (
                            <span key={tg.id} className={styles.tagPill} title={tg.name}>
                              {tg.color && (
                                <span
                                  className={styles.tagDot}
                                  style={{ backgroundColor: tg.color }}
                                />
                              )}
                              #{tg.name}
                            </span>
                          ))
                        ) : (
                          <span className={styles.emptyPill}>—</span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Estimated Minutes */}
                  {visibleColumns.estimated_minutes && (
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="0"
                        className={styles.numberInput}
                        defaultValue={task.estimated_minutes ?? ''}
                        placeholder="—"
                        title="Estimated minutes"
                        onBlur={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          if (val !== task.estimated_minutes) {
                            updateTask({ id: task.id, estimated_minutes: val });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>
                  )}

                  {/* Section */}
                  {visibleColumns.section && (
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      <select
                        className={styles.sectionSelect}
                        value={task.section_id ?? ''}
                        onChange={(e) =>
                          updateTask({ id: task.id, section_id: e.target.value || null })
                        }
                        aria-label="Task section"
                      >
                        <option value="">(None)</option>
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}

                  {/* Assignee */}
                  {visibleColumns.assignee && (
                    <td className={styles.td}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        {task.assignee_device_id ? `Device ${task.assignee_device_id}` : 'Local'}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Persistent Inline Add Row */}
            <tr className={styles.addRow}>
              <td className={styles.tdCenter}>
                <span className={styles.addIcon} aria-hidden="true">
                  ＋
                </span>
              </td>
              <td colSpan={Math.max(1, visibleColCount - 1)}>
                <input
                  ref={addRowInputRef}
                  type="text"
                  className={styles.addRowInput}
                  placeholder="＋ New task... (Press Enter to save)"
                  aria-label="Create new task in table"
                  value={newRowTitle}
                  onChange={(e) => setNewRowTitle(e.target.value)}
                  onKeyDown={handleNewRowKeyDown}
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Empty state when 0 tasks exist in project */}
        {sortedTasks.length === 0 && (
          <div className={styles.emptyStateContainer}>
            <EmptyState
              title="No tasks in this table yet"
              description="Type a task name in the row above and press Enter to quickly add your first task."
            />
          </div>
        )}
      </div>

      {/* Task Context Menu */}
      <TaskContextMenu
        task={contextMenuTask}
        position={contextMenuPos}
        onClose={() => {
          setContextMenuTask(null);
          setContextMenuPos(null);
        }}
        onToggleComplete={toggleComplete}
        onToggleStar={toggleStar}
        onSetPriority={(id, priority) => updateTask({ id, priority })}
        onSetDueDate={(id, date, time, allDay) =>
          updateTask({
            id,
            due_date: date,
            due_time: time,
            all_day: allDay ? 1 : 0,
          })
        }
        onToggleMyDay={(id) => {
          const today = new Date().toISOString().split('T')[0];
          const target = tasks.find((t) => t.id === id);
          if (target?.my_day_date === today) {
            useTaskStore.getState().removeFromMyDay(id).catch(console.error);
          } else {
            useTaskStore.getState().addToMyDay(id, today).catch(console.error);
          }
        }}
        onMoveToList={(id, listId) => updateTask({ id, list_id: listId })}
        onDuplicate={duplicateTask}
        onCreateSubtask={(parentId) => makeSubtask(`task-${Date.now()}`, parentId)}
        onOpenDetail={(t) => onSelectTask(t)}
        onDelete={(id) => deleteTask(id)}
      />
    </div>
  );
}

export default ProjectTableView;
