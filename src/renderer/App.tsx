import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { Titlebar } from './components/Titlebar/Titlebar.js';

// Critical path — always in initial bundle (PERFORMANCE.md §5)
import { Sidebar } from './features/sidebar/Sidebar.js';
import { TaskList } from './features/tasks/TaskList.js';
import { DetailPanel } from './features/tasks/DetailPanel.js';
import { OmnibarView } from './features/omnibar/OmnibarView.js';
import { ipc } from './services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '../shared/types/task.js';

// Lazy views — loaded on-demand per PERFORMANCE.md §5 & vite.config.ts manualChunks
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.js'));
const Agenda = lazy(() => import('./features/agenda/Agenda.js'));
const Projects = lazy(() => import('./features/projects/Projects.js'));
const Settings = lazy(() => import('./features/settings/Settings.js'));
const Pomodoro = lazy(() => import('./features/pomodoro/PomodoroView.js'));

import layoutStyles from './styles/layout.module.css';

function ViewSkeleton(): React.ReactElement {
  return (
    <div className={layoutStyles.skeletonLayout} aria-label="Loading view content">
      <div className={layoutStyles.skeletonHeader} />
      <div className={layoutStyles.skeletonBar} />
      <div className={layoutStyles.skeletonRows}>
        <div className={layoutStyles.skeletonRow} />
        <div className={layoutStyles.skeletonRow} />
        <div className={layoutStyles.skeletonRow} />
        <div className={layoutStyles.skeletonRow} />
      </div>
    </div>
  );
}

export function App(): React.ReactElement {
  const isOmnibar = typeof window !== 'undefined' && window.location.hash.includes('omnibar');

  const { activeListId, systemInfo, fetchSystemInfo } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchSystemInfo();

    const unsubFocus = ipc.on(IPC.APP.FOCUS_QUICK_ADD, () => {
      const quickAddInput = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
      quickAddInput?.focus();
    });

    return () => {
      unsubFocus?.();
    };
  }, [fetchSystemInfo]);

  if (isOmnibar) {
    return <OmnibarView />;
  }

  const renderMainContent = () => {
    switch (activeListId) {
      case 'view_dashboard':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Dashboard />
          </Suspense>
        );
      case 'view_agenda':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Agenda />
          </Suspense>
        );
      case 'view_projects':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Projects />
          </Suspense>
        );
      case 'view_settings':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Settings />
          </Suspense>
        );
      case 'view_pomodoro':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Pomodoro />
          </Suspense>
        );
      default:
        return (
          <TaskList
            onSelectTask={task => setSelectedTask(task)}
            selectedTaskId={selectedTask?.id}
          />
        );
    }
  };

  const isDetailVisible = !activeListId.startsWith('view_') && Boolean(selectedTask);

  return (
    <div className={layoutStyles.container}>
      {/* Custom Frameless Titlebar */}
      <Titlebar
        title="OS11"
        version={systemInfo?.version}
        onToggleAlwaysOnTop={(pinned) => {
          ipc.invoke(IPC.APP.SET_ALWAYS_ON_TOP, { pinned }).catch(console.error);
        }}
      />

      {/* Three-Column CSS Grid Shell */}
      <div
        className={layoutStyles.shellGrid}
        data-detail={isDetailVisible ? 'visible' : 'hidden'}
      >
        {/* Column 1: Sidebar (Critical path) */}
        <div className={layoutStyles.sidebarCol}>
          <Sidebar />
        </div>

        {/* Column 2: Center Main Content (TaskList or Lazy View) */}
        <main className={layoutStyles.mainCol}>{renderMainContent()}</main>

        {/* Column 3: Detail Panel (Critical path) */}
        <div className={layoutStyles.detailCol}>
          <DetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
        </div>
      </div>
    </div>
  );
}

export default App;
