import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Project, Section, Task } from '@shared/types/index.js';
import { between } from '@shared/utils/fractional-index.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { EmptyState } from '../../components/EmptyState/EmptyState.js';
import { useTaskStore } from '../../stores/taskStore.js';
import styles from './ProjectListView.module.css';

interface ProjectListViewProps {
  project: Project;
  sections?: Section[];
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

export function ProjectListView({
  project,
  tasks,
  onSelectTask,
  selectedTaskId,
}: ProjectListViewProps): React.ReactElement {
  const {
    createTask,
    updateTask,
    toggleComplete,
    toggleStar,
    deleteTask,
    duplicateTask,
    makeSubtask,
    reorderTask,
  } = useTaskStore();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Filter tasks into active and completed
  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => t.is_completed === 0 && t.is_trashed === 0)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.is_completed === 1 && t.is_trashed === 0)
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '') || a.sort_order - b.sort_order);
  }, [tasks]);

  const allActiveTaskIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const allCompletedTaskIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const title = newTaskTitle.trim();
      if (!title) return;

      await createTask({
        title,
        project_id: project.id,
        list_id: 'smart_all',
      });
      setNewTaskTitle('');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeTasks.findIndex((t) => t.id === active.id);
    const newIndex = activeTasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(activeTasks, oldIndex, newIndex);
    const prevSibling = newIndex > 0 ? reordered[newIndex - 1] : null;
    const nextSibling = newIndex < reordered.length - 1 ? reordered[newIndex + 1] : null;

    const newSortOrder = between(prevSibling?.sort_order ?? null, nextSibling?.sort_order ?? null);
    await reorderTask(String(active.id), newSortOrder);
  };

  return (
    <div className={styles.listContainer}>
      {/* Quick Add Input Bar */}
      <div className={styles.quickAddRow}>
        <span className={styles.quickAddIcon} aria-hidden="true">
          +
        </span>
        <input
          type="text"
          className={styles.quickAddInput}
          placeholder={`Add a task to ${project.name}... (Press Enter)`}
          aria-label="Add a task to project"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {/* Active Tasks Reorderable Stream */}
      {activeTasks.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allActiveTaskIds} strategy={verticalListSortingStrategy}>
            <div className={styles.tasksList} role="list" aria-label="Active tasks">
              {activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                  allTaskIds={allActiveTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                    onSelectTask(t);
                  }}
                  onOpenDetail={(t) => onSelectTask(t)}
                  onToggleComplete={toggleComplete}
                  onToggleStar={toggleStar}
                  onUpdateTitle={(id, title) => updateTask({ id, title })}
                  onDelete={(id) => deleteTask(id)}
                  onDuplicate={duplicateTask}
                  onContextMenu={(e, t) => {
                    e.preventDefault();
                    setContextMenuTask(t);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : completedTasks.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title="No tasks in this project"
            description="Type a task name in the input above and press Enter to get started."
          />
        </div>
      ) : null}

      {/* Collapsible Completed Section */}
      {completedTasks.length > 0 && (
        <div className={styles.completedSection}>
          <div
            className={styles.completedHeader}
            role="button"
            tabIndex={0}
            aria-expanded={isCompletedOpen}
            aria-label={`Completed tasks (${completedTasks.length})`}
            onClick={() => setIsCompletedOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsCompletedOpen((prev) => !prev);
              }
            }}
          >
            <span
              className={`${styles.completedCaret} ${
                isCompletedOpen ? styles.completedCaretOpen : ''
              }`}
              aria-hidden="true"
            >
              ▶
            </span>
            <span>Completed ({completedTasks.length})</span>
          </div>

          {isCompletedOpen && (
            <div className={styles.completedList} role="list" aria-label="Completed tasks">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isSelected={selectedTaskId === task.id || focusedTaskId === task.id}
                  allTaskIds={allCompletedTaskIds}
                  onSelect={(t) => {
                    setFocusedTaskId(t.id);
                    onSelectTask(t);
                  }}
                  onOpenDetail={(t) => onSelectTask(t)}
                  onToggleComplete={toggleComplete}
                  onToggleStar={toggleStar}
                  onUpdateTitle={(id, title) => updateTask({ id, title })}
                  onDelete={(id) => deleteTask(id)}
                  onDuplicate={duplicateTask}
                  onContextMenu={(e, t) => {
                    e.preventDefault();
                    setContextMenuTask(t);
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

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

export default ProjectListView;
