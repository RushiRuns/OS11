import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Project, Section, Task } from '@shared/types/index.js';
import { between } from '@shared/utils/fractional-index.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { BoardColumn } from './BoardColumn.js';
import { BoardCard } from './BoardCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import styles from './ProjectBoardView.module.css';

interface ProjectBoardViewProps {
  project: Project;
  sections: Section[];
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  selectedTaskId?: string | null;
}

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  const [removed] = newArray.splice(from, 1);
  newArray.splice(to, 0, removed);
  return newArray;
}

export function ProjectBoardView({
  project,
  sections,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectBoardViewProps): React.ReactElement {
  const {
    createTask,
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    duplicateTask,
    makeSubtask,
  } = useTaskStore();
  const { createSection, deleteSection, updateSection } = useProjectStore();

  // Local optimistic task list for smooth cross-column dragging
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Column creation state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  // Sync localTasks when tasks prop changes and no drag is active
  useEffect(() => {
    if (!activeTaskId) {
      setLocalTasks(tasks);
    }
  }, [tasks, activeTaskId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Non-trashed tasks
  const activeTasks = useMemo(() => {
    return localTasks
      .filter((t) => t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [localTasks]);

  // Tasks without a valid section
  const unassignedTasks = useMemo(() => {
    const sectionIds = new Set(sections.map((s) => s.id));
    return activeTasks.filter((t) => !t.section_id || !sectionIds.has(t.section_id));
  }, [activeTasks, sections]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTask = localTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    let targetSectionId: string | null = null;
    if (overId.startsWith('col_')) {
      targetSectionId = overId.replace('col_', '');
    } else {
      const overTask = localTasks.find((t) => t.id === overId);
      if (overTask) {
        targetSectionId = overTask.section_id ?? null;
      }
    }

    if (!targetSectionId) return;

    // Moving across columns optimistically
    if (activeTask.section_id !== targetSectionId) {
      setLocalTasks((prev) => {
        const activeIndex = prev.findIndex((t) => t.id === activeId);
        if (activeIndex === -1) return prev;

        const updated = { ...prev[activeIndex], section_id: targetSectionId };
        const next = [...prev];
        next.splice(activeIndex, 1);

        if (!overId.startsWith('col_')) {
          const overIndex = next.findIndex((t) => t.id === overId);
          if (overIndex !== -1) {
            next.splice(overIndex, 0, updated);
            return next;
          }
        }

        next.push(updated);
        return next;
      });
    } else if (!overId.startsWith('col_')) {
      // Reordering within the same column
      const overTask = localTasks.find((t) => t.id === overId);
      if (overTask && overTask.section_id === activeTask.section_id) {
        const activeIndex = localTasks.findIndex((t) => t.id === activeId);
        const overIndex = localTasks.findIndex((t) => t.id === overId);
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          setLocalTasks(arrayMove(localTasks, activeIndex, overIndex));
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);
    setActiveTaskId(null);

    if (!over) {
      setLocalTasks(tasks);
      return;
    }

    const currentTask = localTasks.find((t) => t.id === activeId);
    if (!currentTask) {
      setLocalTasks(tasks);
      return;
    }

    const finalSectionId = currentTask.section_id ?? null;
    const columnTasks = localTasks.filter(
      (t) => (t.section_id ?? null) === finalSectionId && t.is_trashed === 0
    );

    const taskIndex = columnTasks.findIndex((t) => t.id === activeId);
    if (taskIndex === -1) return;

    const prevTask = taskIndex > 0 ? columnTasks[taskIndex - 1] : null;
    const nextTask = taskIndex < columnTasks.length - 1 ? columnTasks[taskIndex + 1] : null;

    const newSortOrder = between(
      prevTask?.sort_order ?? null,
      nextTask?.sort_order ?? null
    );

    await updateTask({
      id: activeId,
      section_id: finalSectionId === '__unassigned__' ? null : finalSectionId,
      sort_order: newSortOrder,
    });
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
    setLocalTasks(tasks);
  };

  // Card creation in column
  const handleAddCard = async (sectionId: string, title: string) => {
    const targetSectionId = sectionId === '__unassigned__' ? null : sectionId;
    await createTask({
      title,
      project_id: project.id,
      section_id: targetSectionId,
      list_id: 'smart_all',
    });
  };

  // Section actions
  const handleRenameSection = async (sectionId: string, newName: string) => {
    await updateSection(sectionId, { name: newName });
  };

  const handleDeleteSection = async (sectionId: string) => {
    await deleteSection(sectionId);
  };

  // Column creation submit
  const handleAddColumnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newColumnName.trim();
    if (!name) return;

    await createSection({
      project_id: project.id,
      name,
      sort_order: sections.length,
    });
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  // Active task for DragOverlay
  const activeDragTask = useMemo(() => {
    if (!activeTaskId) return null;
    return localTasks.find((t) => t.id === activeTaskId) ?? null;
  }, [localTasks, activeTaskId]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={styles.boardContainer}>
        {/* Unassigned column if any tasks lack section */}
        {unassignedTasks.length > 0 && (
          <BoardColumn
            key="__unassigned__"
            section={{
              id: '__unassigned__',
              project_id: project.id,
              name: 'No Section',
              sort_order: -1,
              is_collapsed: 0,
              created_at: '',
            }}
            tasks={unassignedTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onToggleComplete={toggleComplete}
            onTaskContextMenu={(e, t) => {
              setContextMenuTask(t);
              setContextMenuPos({ x: e.clientX, y: e.clientY });
            }}
            onAddCard={handleAddCard}
            onRenameSection={() => {}}
            onDeleteSection={() => {}}
          />
        )}

        {/* Regular Sections */}
        {sections.map((section) => {
          const colTasks = activeTasks.filter((t) => t.section_id === section.id);

          return (
            <BoardColumn
              key={section.id}
              section={section}
              tasks={colTasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              onToggleComplete={toggleComplete}
              onTaskContextMenu={(e, t) => {
                setContextMenuTask(t);
                setContextMenuPos({ x: e.clientX, y: e.clientY });
              }}
              onAddCard={handleAddCard}
              onRenameSection={handleRenameSection}
              onDeleteSection={handleDeleteSection}
            />
          );
        })}

        {/* Add Column Column */}
        <div className={styles.addColumnColumn}>
          {isAddingColumn ? (
            <form onSubmit={handleAddColumnSubmit} className={styles.addColumnForm}>
              <input
                type="text"
                autoFocus
                className={styles.columnInput}
                placeholder="Column name (e.g. In Review)..."
                aria-label="New column name"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
              />
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitBtn}>
                  Add Column
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    setIsAddingColumn(false);
                    setNewColumnName('');
                  }}
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
              aria-label="Add new column"
            >
              <span>+</span>
              <span>Add Column</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeDragTask ? <BoardCard task={activeDragTask} isOverlay /> : null}
      </DragOverlay>

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
    </DndContext>
  );
}

export default ProjectBoardView;
