import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { motion, useReducedMotion } from 'framer-motion';
import type { Project, Section, Task } from '@shared/types/index.js';
import { Checkbox } from '../../components/Checkbox/Checkbox.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './ProjectBoardView.module.css';

interface ProjectBoardViewProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string;
}

export function ProjectBoardView({
  project,
  sections,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectBoardViewProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const { createTask, updateTask, toggleComplete } = useTaskStore();
  const { createSection, deleteSection } = useProjectStore();

  const [columnAddInput, setColumnAddInput] = useState<Record<string, string>>({});
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    let targetSectionId: string | null = null;
    if (overId.startsWith('col_drop_')) {
      targetSectionId = overId.replace('col_drop_', '');
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

  const handleCreateCard = async (e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter') {
      const text = columnAddInput[sectionId]?.trim();
      if (!text) return;

      await createTask({
        title: text,
        project_id: project.id,
        section_id: sectionId,
        list_id: 'smart_all',
      });
      setColumnAddInput((prev) => ({ ...prev, [sectionId]: '' }));
    }
  };

  const handleAddColumnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    await createSection({
      project_id: project.id,
      name: newColumnName.trim(),
      sort_order: sections.length,
    });
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const priorityColors = [
    'transparent',
    'var(--priority-low)',
    'var(--priority-medium)',
    'var(--priority-high)',
    'var(--priority-critical)',
  ];

  const today = new Date().toISOString().split('T')[0];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className={styles.boardContainer}>
        {sections.map((section) => {
          const colTasks = tasks.filter((t) => t.section_id === section.id);
          const completedCount = colTasks.filter((t) => t.is_completed === 1).length;
          const totalCount = colTasks.length;
          const colPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          // Column ring SVG math
          const colRadius = 8;
          const colCircumference = 2 * Math.PI * colRadius;
          const colOffset = colCircumference - (colPercent / 100) * colCircumference;

          return (
            <div
              key={section.id}
              className={styles.column}
              id={`col_drop_${section.id}`}
            >
              {/* Column Header */}
              <div className={styles.columnHeader}>
                <div className={styles.columnHeaderLeft}>
                  <svg className={styles.columnRingSvg} viewBox="0 0 22 22">
                    <circle className={styles.columnRingBg} cx="11" cy="11" r={colRadius} />
                    <circle
                      className={styles.columnRingProg}
                      cx="11"
                      cy="11"
                      r={colRadius}
                      style={{
                        strokeDasharray: colCircumference,
                        strokeDashoffset: colOffset,
                      }}
                    />
                  </svg>
                  <span className={styles.columnTitle} title={section.name}>
                    {section.name}
                  </span>
                  <span className={styles.columnCountBadge}>{totalCount}</span>
                </div>

                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    fontSize: '11px',
                  }}
                  onClick={() => {
                    if (window.confirm(`Delete column "${section.name}"?`)) {
                      deleteSection(section.id);
                    }
                  }}
                  title="Delete column"
                >
                  ✕
                </button>
              </div>

              {/* Cards Container */}
              <div className={styles.columnBody}>
                {colTasks.map((task) => {
                  const isDone = task.is_completed === 1;
                  const isOverdue = !isDone && task.due_date && task.due_date < today;

                  return (
                    <motion.div
                      key={task.id}
                      className={`${styles.boardCard} ${selectedTaskId === task.id ? styles.boardCardSelected : ''}`}
                      id={task.id}
                      onClick={() => onSelectTask(task)}
                      style={{
                        borderLeft: `3px solid ${priorityColors[task.priority] ?? 'transparent'}`,
                      }}
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.16 }} // Framer Motion Site #7 (landing animation)
                    >
                      <div className={styles.cardHeader}>
                        <Checkbox
                          checked={isDone}
                          onChange={() => toggleComplete(task.id)}
                        />
                        <span
                          className={`${styles.cardTitle} ${isDone ? styles.cardTitleCompleted : ''}`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className={styles.cardFooter}>
                        {task.due_date && (
                          <span
                            className={`${styles.dueChip} ${isOverdue ? styles.overdueChip : ''}`}
                          >
                            📅 {task.due_date}
                          </span>
                        )}
                        {task.estimated_minutes ? (
                          <span className={styles.dueChip}>
                            ⏱ {task.estimated_minutes}m
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Add Card to Column */}
              <div className={styles.inlineAddCard}>
                <input
                  type="text"
                  className={styles.inlineInput}
                  placeholder={`+ Add card to ${section.name}...`}
                  value={columnAddInput[section.id] ?? ''}
                  onChange={(e) =>
                    setColumnAddInput((prev) => ({ ...prev, [section.id]: e.target.value }))
                  }
                  onKeyDown={(e) => handleCreateCard(e, section.id)}
                />
              </div>
            </div>
          );
        })}

        {/* Add Column Button / Form */}
        {isAddingColumn ? (
          <form
            onSubmit={handleAddColumnSubmit}
            className={styles.column}
            style={{ padding: 'var(--space-3)' }}
          >
            <input
              type="text"
              autoFocus
              className={styles.inlineInput}
              style={{
                padding: '8px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--surface-base)',
                marginBottom: '8px',
              }}
              placeholder="Column name (e.g. In Review)..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Add Column
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
                onClick={() => setIsAddingColumn(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={styles.addColumnBtn}
            onClick={() => setIsAddingColumn(true)}
          >
            <span>+</span>
            <span>Add Column</span>
          </button>
        )}
      </div>
    </DndContext>
  );
}

export default ProjectBoardView;
