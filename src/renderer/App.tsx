import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskStore } from './stores/task-store.js';
import { useAppStore } from './stores/app-store.js';
import { settingsServiceAdapter } from './services/settings-service-adapter.js';
import styles from './styles/app.module.css';

export function App(): React.ReactElement {
  const { tasks, loading, fetchTasks, createTask, toggleComplete, deleteTask } = useTaskStore();
  const { activeListId, setActiveListId, systemInfo, fetchSystemInfo } = useAppStore();
  const [quickAddTitle, setQuickAddTitle] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchSystemInfo();
  }, [fetchTasks, fetchSystemInfo]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    await createTask({
      title: quickAddTitle.trim(),
      list_id: activeListId.startsWith('smart_') ? 'list_inbox' : activeListId,
    });
    setQuickAddTitle('');
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

  return (
    <div className={styles.container}>
      {/* OS Titlebar */}
      <header className={styles.titlebar}>
        <div className={styles.titlebarTitle}>
          OS11 {systemInfo?.version ? `v${systemInfo.version}` : ''}
        </div>
        <div className={styles.windowControls}>
          <button
            type="button"
            className={styles.windowButton}
            onClick={() => settingsServiceAdapter.minimize()}
            aria-label="Minimize"
          >
            —
          </button>
          <button
            type="button"
            className={styles.windowButton}
            onClick={() => settingsServiceAdapter.maximize()}
            aria-label="Maximize"
          >
            ▢
          </button>
          <button
            type="button"
            className={styles.windowButton}
            onClick={() => settingsServiceAdapter.close()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Main App Layout */}
      <div className={styles.mainContent}>
        {/* Navigation Sidebar */}
        <nav className={styles.sidebar} aria-label="Lists Navigation">
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
        </nav>

        {/* Task Area */}
        <main className={styles.contentArea}>
          <div className={styles.header}>
            <h1 className={styles.heading}>{activeTitle}</h1>
          </div>

          {/* Quick-Add Input */}
          <form onSubmit={handleCreateTask} className={styles.quickAddRow}>
            <input
              type="text"
              className={styles.input}
              placeholder="Add a task (e.g. 'Submit project plan tomorrow at 5pm')..."
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
            />
            <button type="submit" className={styles.addButton}>
              Add Task
            </button>
          </form>

          {/* Task List with Framer Motion */}
          <div className={styles.taskList}>
            {loading && tasks.length === 0 ? (
              <div className={styles.emptyState}>Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className={styles.emptyState}>No tasks yet. Add one above!</div>
            ) : (
              <AnimatePresence>
                {tasks.map((task) => {
                  const isCompleted = task.is_completed === 1;
                  return (
                    <motion.div
                      key={task.id}
                      className={styles.taskCard}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className={styles.taskLeft}>
                        <button
                          type="button"
                          className={styles.checkbox}
                          onClick={() => toggleComplete(task.id)}
                          aria-label={isCompleted ? 'Mark uncompleted' : 'Mark completed'}
                        >
                          {isCompleted ? '✓' : ''}
                        </button>
                        <span
                          className={`${styles.taskTitle} ${
                            isCompleted ? styles.taskTitleCompleted : ''
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => deleteTask(task.id)}
                        aria-label="Delete task"
                      >
                        ✕
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
