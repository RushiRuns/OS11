import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { useActiveList } from './stores/listStore.js';
import { Titlebar } from './components/Titlebar/Titlebar.js';

// Critical path — always in initial bundle (PERFORMANCE.md §5)
import { Sidebar } from './features/sidebar/Sidebar.js';
import { TaskList } from './features/tasks/TaskList.js';
import { DetailPanel } from './features/tasks/DetailPanel.js';
import { MyDayView } from './features/lists/MyDayView.js';
import { RolloverPrompt } from './features/lists/RolloverPrompt.js';
import { OmnibarView } from './features/omnibar/OmnibarView.js';
import { CommandPalette } from './features/command-palette/CommandPalette.js';
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
  const activeList = useActiveList();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    fetchSystemInfo();

    const unsubFocus = ipc.on(IPC.APP.FOCUS_QUICK_ADD, () => {
      const quickAddInput = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
      quickAddInput?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubFocus?.();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchSystemInfo]);

  if (isOmnibar) {
    return <OmnibarView />;
  }

  const renderMainContent = () => {
    switch (activeListId) {
      case 'smart_my_day':
        return (
          <MyDayView
            onSelectTask={(task) => setSelectedTask(task)}
            selectedTaskId={selectedTask?.id}
          />
        );
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
            onSelectTask={(task) => setSelectedTask(task)}
            selectedTaskId={selectedTask?.id}
          />
        );
    }
  };

  const isDetailVisible = !activeListId.startsWith('view_') && Boolean(selectedTask);

  // Per-list background theming
  const mainStyle: React.CSSProperties = {};
  if (activeList?.background_type === 'solid' && activeList.background_value) {
    mainStyle.backgroundColor = activeList.background_value;
  } else if (activeList?.background_type === 'gradient' && activeList.background_value) {
    mainStyle.background = activeList.background_value;
  } else if (activeList?.background_type === 'image' && activeList.background_value) {
    mainStyle.backgroundImage = `url(${activeList.background_value})`;
    mainStyle.backgroundSize = 'cover';
    mainStyle.backgroundPosition = 'center';
    mainStyle.backdropFilter = 'blur(10px)';
  }

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
        data-sidebar={isFocusMode ? 'hidden' : 'visible'}
        data-detail={isFocusMode || !isDetailVisible ? 'hidden' : 'visible'}
        data-focus={isFocusMode ? 'active' : 'inactive'}
      >
        {/* Column 1: Sidebar (Critical path) */}
        <div className={layoutStyles.sidebarCol}>
          <Sidebar />
        </div>

        {/* Column 2: Center Main Content (TaskList, MyDayView, or Lazy View) */}
        <main className={layoutStyles.mainCol} style={mainStyle}>
          {renderMainContent()}
        </main>

        {/* Column 3: Detail Panel (Critical path) */}
        <div className={layoutStyles.detailCol}>
          <DetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
        </div>
      </div>

      {/* Rollover Prompt on day change for incomplete yesterday tasks */}
      <RolloverPrompt />

      {/* Command Palette Spotlight modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
      />
    </div>
  );
}

export default App;
