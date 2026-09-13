import React, { useState, useEffect, useCallback } from 'react';
import { useTagStore } from '../../stores/tagStore.js';
import { useTaskStore } from '../../stores/taskStore.js';
import { TaskCard } from '../tasks/TaskCard.js';
import { TaskContextMenu, type TaskContextMenuPosition } from '../tasks/TaskContextMenu.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '@shared/types/task.js';
import styles from './TagView.module.css';

export interface TagViewProps {
  tagId: string;
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string;
}

export function TagView({
  tagId,
  onSelectTask,
  selectedTaskId,
}: TagViewProps): React.ReactElement {
  const { tagsById, loadTags } = useTagStore();
  const { toggleComplete, toggleStar, updateTask, deleteTask, duplicateTask } = useTaskStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Context menu state
  const [contextMenuTask, setContextMenuTask] = useState<Task | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<TaskContextMenuPosition | null>(null);

  const currentTag = tagsById[tagId];

  const fetchTasksForTag = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await ipc.invoke<Task[]>(IPC.TAGS.GET_TASKS_FOR_TAG, tagId);
      setTasks(result || []);
    } catch (err) {
      console.error('Failed to fetch tasks for tag:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tagId]);

  useEffect(() => {
    loadTags();
    fetchTasksForTag();
  }, [tagId, loadTags, fetchTasksForTag]);

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    setContextMenuTask(task);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleToggleComplete = async (taskId: string) => {
    await toggleComplete(taskId);
    fetchTasksForTag();
  };

  const handleToggleStar = async (taskId: string) => {
    await toggleStar(taskId);
    fetchTasksForTag();
  };

  const handleUpdateTitle = async (taskId: string, newTitle: string) => {
    await updateTask({ id: taskId, title: newTitle });
    fetchTasksForTag();
  };

  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
    fetchTasksForTag();
  };

  const handleDuplicate = async (taskId: string) => {
    await duplicateTask(taskId);
    fetchTasksForTag();
  };

  return (
    <div className={styles.tagViewContainer}>
      <header className={styles.header}>
        <div className={styles.tagBadgeRow}>
          <span
            className={styles.colorDot}
            style={{ background: currentTag?.color ?? 'var(--tag-gray)' }}
          />
          <h1 className={styles.tagName}>
            #{currentTag?.name ?? 'Tag'}
          </h1>
          <span className={styles.taskCount}>
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      </header>

      <div className={styles.scrollArea}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyText}>Loading tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🏷️</span>
            <span className={styles.emptyText}>
              No tasks tagged with #{currentTag?.name ?? 'this tag'}
            </span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              allTaskIds={tasks.map((t) => t.id)}
              onSelect={onSelectTask}
              onToggleComplete={handleToggleComplete}
              onToggleStar={handleToggleStar}
              onUpdateTitle={handleUpdateTitle}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {contextMenuTask && (
        <TaskContextMenu
          task={contextMenuTask}
          position={contextMenuPos}
          onClose={() => {
            setContextMenuTask(null);
            setContextMenuPos(null);
          }}
          onToggleComplete={handleToggleComplete}
          onToggleStar={handleToggleStar}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}
    </div>
  );
}

export default TagView;
