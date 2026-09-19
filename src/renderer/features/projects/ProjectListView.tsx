import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Project, Section, Task } from '@shared/types/index.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './ProjectListView.module.css';

interface ProjectListViewProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
}

export function ProjectListView({
  project,
  sections,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectListViewProps): React.ReactElement {
  const { createTask, updateTask } = useTaskStore();
  const { createSection, updateSection, deleteSection, activityFeed } = useProjectStore();

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [inlineTitles, setInlineTitles] = useState<Record<string, string>>({});
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState<string>('');

  const handleSaveSectionName = async (sectionId: string) => {
    const trimmed = editingSectionName.trim();
    if (trimmed) {
      await updateSection(sectionId, { name: trimmed });
    }
    setEditingSectionId(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const toggleCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleInlineKeyDown = async (e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter') {
      const val = inlineTitles[sectionId]?.trim();
      if (!val) return;

      await createTask({
        title: val,
        project_id: project.id,
        section_id: sectionId,
        list_id: 'smart_all',
      });

      setInlineTitles((prev) => ({ ...prev, [sectionId]: '' }));
    }
  };

  const handleAddSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    await createSection({
      project_id: project.id,
      name: newSectionName.trim(),
      sort_order: sections.length,
    });
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // If dropped onto a section block or a task in another section
    let targetSectionId: string | null = null;
    if (overId.startsWith('sec_drop_')) {
      targetSectionId = overId.replace('sec_drop_', '');
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetSectionId = overTask.section_id ?? null;
      }
    }

    if (targetSectionId !== null) {
      const activeTask = tasks.find((t) => t.id === taskId);
      if (activeTask && activeTask.section_id !== targetSectionId) {
        await updateTask({
          id: taskId,
          section_id: targetSectionId,
        });
      }
    }
  };

  // Group tasks by section
  const tasksBySection = new Map<string, Task[]>();
  for (const s of sections) {
    tasksBySection.set(s.id, []);
  }
  const unsectionedTasks: Task[] = [];

  for (const t of tasks) {
    if (t.section_id && tasksBySection.has(t.section_id)) {
      tasksBySection.get(t.section_id)!.push(t);
    } else {
      unsectionedTasks.push(t);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={styles.listContainer}>
        <div className={styles.sectionsList}>
          {sections.map((sec) => {
            const secTasks = tasksBySection.get(sec.id) ?? [];
            const completedCount = secTasks.filter((t) => t.is_completed === 1).length;
            const isCollapsed = Boolean(collapsedSections[sec.id]);

            return (
              <div key={sec.id} className={styles.sectionBlock} id={`sec_drop_${sec.id}`}>
                {/* Collapsible Section Header */}
                <div
                  className={styles.sectionHeader}
                  onClick={() => toggleCollapse(sec.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.sectionHeaderLeft}>
                    <span
                      className={`${styles.collapseArrow} ${
                        isCollapsed ? styles.collapseArrowCollapsed : ''
                      }`}
                    >
                      ▼
                    </span>
                    {editingSectionId === sec.id ? (
                      <input
                        type="text"
                        className={styles.inlineRenameInput}
                        value={editingSectionName}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSectionName(sec.id);
                          } else if (e.key === 'Escape') {
                            setEditingSectionId(null);
                          }
                        }}
                        onBlur={() => handleSaveSectionName(sec.id)}
                      />
                    ) : (
                      <span className={styles.sectionTitle}>{sec.name}</span>
                    )}
                    <span className={styles.taskCountBadge}>
                      {completedCount}/{secTasks.length}
                    </span>
                  </div>

                  <div className={styles.sectionActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={styles.sectionActionBtn}
                      onClick={() => {
                        setEditingSectionId(sec.id);
                        setEditingSectionName(sec.name);
                      }}
                      title="Rename section"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className={styles.sectionActionBtn}
                      onClick={() => {
                        if (window.confirm(`Delete section "${sec.name}"? Tasks will become unsectioned.`)) {
                          deleteSection(sec.id);
                        }
                      }}
                      title="Delete section"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Tasks Body */}
                {!isCollapsed && (
                  <div className={styles.tasksBody}>
                    {secTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        variant="project"
                        isSelected={selectedTaskId === task.id}
                        onSelect={() => onSelectTask(task)}
                      />
                    ))}

                    {/* Inline Task Add */}
                    <div className={styles.inlineAddRow}>
                      <input
                        type="text"
                        className={styles.inlineAddInput}
                        placeholder={`+ Add task to ${sec.name} (Press Enter)...`}
                        value={inlineTitles[sec.id] ?? ''}
                        onChange={(e) =>
                          setInlineTitles((prev) => ({ ...prev, [sec.id]: e.target.value }))
                        }
                        onKeyDown={(e) => handleInlineKeyDown(e, sec.id)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unsectioned Tasks (if any) */}
          {unsectionedTasks.length > 0 && (
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.sectionTitle}>General Tasks</span>
                  <span className={styles.taskCountBadge}>{unsectionedTasks.length}</span>
                </div>
              </div>
              <div className={styles.tasksBody}>
                {unsectionedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="project"
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add Section Button / Form */}
          {isAddingSection ? (
            <form onSubmit={handleAddSectionSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                autoFocus
                className={styles.inlineAddInput}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-base)',
                }}
                placeholder="Section name (e.g. Backlog, Review)..."
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 'var(--weight-medium)',
                }}
              >
                Add Section
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
                onClick={() => setIsAddingSection(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.addSectionBtn}
              onClick={() => setIsAddingSection(true)}
            >
              <span>+</span>
              <span>Add Section</span>
            </button>
          )}
        </div>

        {/* Activity Feed */}
        <div className={styles.activitySection}>
          <div className={styles.activityHeading}>
            <span>🕒</span>
            <span>Project Activity Log</span>
          </div>

          <div className={styles.activityList}>
            {activityFeed.length === 0 ? (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                No recorded activity events yet.
              </span>
            ) : (
              activityFeed.map((item) => (
                <div key={item.id} className={styles.activityItem}>
                  <div>
                    <span className={styles.activityItemTitle}>{item.title}</span>
                    {item.body && <span className={styles.activityItemBody}>— {item.body}</span>}
                  </div>
                  <span className={styles.activityItemDate}>
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

export default ProjectListView;
