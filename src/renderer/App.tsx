import React, { useEffect } from 'react';
import { useTaskStore } from './stores/task-store.js';
import { useAppStore } from './stores/app-store.js';
import { Titlebar } from './components/Titlebar/Titlebar.js';
import { Checkbox } from './components/Checkbox/Checkbox.js';
import { QuickAdd } from './components/QuickAdd/QuickAdd.js';
import { ScrollArea } from './components/primitives/ScrollArea/ScrollArea.js';
import styles from './styles/app.module.css';

export function App(): React.ReactElement {
  const { tasks, loading, fetchTasks, createTask, toggleComplete, deleteTask } = useTaskStore();
  const { activeListId, setActiveListId, systemInfo, fetchSystemInfo } = useAppStore();

  useEffect(() => {
    fetchTasks();
    fetchSystemInfo();
  }, [fetchTasks, fetchSystemInfo]);

  const handleCreateTask = async (title: string) => {
    await createTask({
      title,
      list_id: activeListId.startsWith('smart_') ? 'list_inbox' : activeListId,
    });
  };

  const navItems = [
    { id: 'smart_my_day', label: 'My Day', icon: '☀️' },
    { id: 'smart_important', label: 'Important', icon: '⭐' },
    { id: 'smart_planned', label: 'Planned', icon: '📅' },
    { id: 'smart_all', label: 'All Tasks', icon: '📋' },
    { id: 'smart_completed', label: 'Completed', icon: '✅' },
    { id: 'list_inbox', label: 'Tasks', icon: '📥' },
  ];

  const activeTitle = navItems.find((item) => item.id === activeListId)?.label ?? 'Tasks';

  const getPriorityClass = (priority: number): string => {
    switch (priority) {
      case 1:
        return styles.priorityLow;
      case 2:
        return styles.priorityMedium;
      case 3:
        return styles.priorityHigh;
      case 4:
        return `${styles.priorityCritical} ${styles.priorityCriticalPulse}`;
      default:
        return '';
    }
  };

  return (
    <div className={styles.container}>
      {/* Custom Frameless Titlebar */}
      <Titlebar title="OS11" version={systemInfo?.version} />

      {/* Main App Layout */}
      <div className={styles.mainContent}>
        {/* Navigation Sidebar */}
        <nav className={styles.sidebar} aria-label="Lists Navigation">
          <ScrollArea orientation="vertical">
            {navItems.map((item) => {
              const isActive = activeListId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                  onClick={() => setActiveListId(item.id)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </ScrollArea>
        </nav>

        {/* Task Area */}
        <main className={styles.contentArea}>
          <div className={styles.header}>
            <h1 className={styles.heading}>{activeTitle}</h1>
          </div>

          {/* Quick-Add Bar (Framer Motion Site #4) */}
          <QuickAdd onAdd={handleCreateTask} />

          {/* Task List (Overflow via ScrollArea, Transitions via CSS) */}
          <ScrollArea orientation="vertical">
            <div className={styles.taskList}>
              {loading && tasks.length === 0 ? (
                <div className={styles.emptyState}>Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className={styles.emptyState}>No tasks yet. Add one above!</div>
              ) : (
                tasks.map((task) => {
                  const isCompleted = task.is_completed === 1;
                  const isStarred = task.is_starred === 1;
                  const priorityClass = getPriorityClass(task.priority);

                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} ${priorityClass}`}
                    >
                      <div className={styles.taskLeft}>
                        {/* Checkbox (Framer Motion Spring Site #1) */}
                        <Checkbox
                          checked={isCompleted}
                          onChange={() => toggleComplete(task.id)}
                          ariaLabel={isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                        />
                        <span
                          className={`${styles.taskTitle} ${
                            isCompleted ? styles.taskTitleCompleted : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {isStarred && (
                          <span className={styles.starIcon} aria-label="Important">
                            ★
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => deleteTask(task.id)}
                        aria-label="Delete task"
                        title="Delete task"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export default App;
