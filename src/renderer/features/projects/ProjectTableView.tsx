import React, { useState, useMemo } from 'react';
import type { Project, Section, Task } from '@shared/types/index.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useTagStore } from '../../stores/tagStore.js';
import styles from './ProjectTableView.module.css';

interface ProjectTableViewProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
}

type ColumnKey = 'status' | 'title' | 'due_date' | 'priority' | 'tags' | 'estimated_minutes' | 'section' | 'assignee';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultWidth: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'status', label: 'Status', defaultWidth: 80 },
  { key: 'title', label: 'Title', defaultWidth: 260 },
  { key: 'due_date', label: 'Due Date', defaultWidth: 120 },
  { key: 'priority', label: 'Priority', defaultWidth: 100 },
  { key: 'tags', label: 'Tags', defaultWidth: 140 },
  { key: 'estimated_minutes', label: 'Est. Time', defaultWidth: 90 },
  { key: 'section', label: 'Section', defaultWidth: 120 },
  { key: 'assignee', label: 'Assignee', defaultWidth: 110 },
];

export function ProjectTableView({
  sections,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectTableViewProps): React.ReactElement {
  const { updateTask, toggleComplete } = useTaskStore();
  const { getTagsForTask } = useTagStore();

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
    status: 80,
    title: 260,
    due_date: 120,
    priority: 100,
    tags: 140,
    estimated_minutes: 90,
    section: 120,
    assignee: 110,
  });

  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);

  // Column resizing handler
  const handleResizeStart = (e: React.MouseEvent, key: ColumnKey) => {
    e.stopPropagation();
    e.preventDefault();
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
    if (!sortKey) return tasks;

    return [...tasks].sort((a, b) => {
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

  return (
    <div className={styles.tableContainer}>
      {/* Table Toolbar */}
      <div className={styles.tableToolbar}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          Showing {sortedTasks.length} tasks • Click headers to sort • Click cells to edit inline
        </span>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.columnPickerBtn}
            onClick={() => setIsColumnPickerOpen((prev) => !prev)}
          >
            ⚙ Columns ({Object.values(visibleColumns).filter(Boolean).length})
          </button>

          {isColumnPickerOpen && (
            <div className={styles.columnPickerPopover}>
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className={styles.columnPickerItem}>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({ ...prev, [col.key]: e.target.checked }))
                    }
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

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
                    <div className={styles.thContent} onClick={() => handleSort(col.key)}>
                      <span>{col.label}</span>
                      {isSorted && <span>{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>}
                    </div>
                    <div
                      className={styles.resizer}
                      onMouseDown={(e) => handleResizeStart(e, col.key)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const tags = getTagsForTask(task.id);

              return (
                <tr
                  key={task.id}
                  className={`${styles.tr} ${isSelected ? styles.trSelected : ''}`}
                  onClick={() => onSelectTask(task)}
                >
                  {/* Status */}
                  {visibleColumns.status && (
                    <td className={styles.td}>
                      <input
                        type="checkbox"
                        checked={task.is_completed === 1}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleComplete(task.id);
                        }}
                      />
                    </td>
                  )}

                  {/* Title (inline editable) */}
                  {visibleColumns.title && (
                    <td className={styles.td}>
                      <input
                        type="text"
                        className={styles.inlineInput}
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

                  {/* Due Date (inline date picker) */}
                  {visibleColumns.due_date && (
                    <td className={styles.td}>
                      <input
                        type="date"
                        className={styles.inlineInput}
                        value={task.due_date ?? ''}
                        onChange={(e) =>
                          updateTask({ id: task.id, due_date: e.target.value || null })
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}

                  {/* Priority (inline select) */}
                  {visibleColumns.priority && (
                    <td className={styles.td}>
                      <select
                        className={styles.selectInput}
                        value={task.priority}
                        onChange={(e) =>
                          updateTask({ id: task.id, priority: Number(e.target.value) })
                        }
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="0">P0 (None)</option>
                        <option value="1">P1 (Low)</option>
                        <option value="2">P2 (Med)</option>
                        <option value="3">P3 (High)</option>
                        <option value="4">P4 (Crit)</option>
                      </select>
                    </td>
                  )}

                  {/* Tags */}
                  {visibleColumns.tags && (
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        {tags.length > 0 ? (
                          tags.map((tg) => (
                            <span
                              key={tg.id}
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '9999px',
                                backgroundColor: 'var(--surface-hover)',
                                border: '1px solid var(--border-subtle)',
                              }}
                            >
                              #{tg.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>—</span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Estimated Minutes */}
                  {visibleColumns.estimated_minutes && (
                    <td className={styles.td}>
                      <input
                        type="number"
                        className={styles.inlineInput}
                        defaultValue={task.estimated_minutes ?? ''}
                        placeholder="mins"
                        onBlur={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          if (val !== task.estimated_minutes) {
                            updateTask({ id: task.id, estimated_minutes: val });
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}

                  {/* Section */}
                  {visibleColumns.section && (
                    <td className={styles.td}>
                      <select
                        className={styles.selectInput}
                        value={task.section_id ?? ''}
                        onChange={(e) =>
                          updateTask({ id: task.id, section_id: e.target.value || null })
                        }
                        onClick={(e) => e.stopPropagation()}
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

                  {/* Assignee (Phase 2 placeholder) */}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectTableView;
