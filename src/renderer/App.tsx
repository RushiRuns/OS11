import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { Titlebar } from './components/Titlebar/Titlebar.js';

// Critical path — always in initial bundle (PERFORMANCE.md §5)
import { Sidebar } from './features/sidebar/Sidebar.js';
import { TaskList } from './features/tasks/TaskList.js';
import { DetailPanel } from './features/tasks/DetailPanel.js';
import { MyDayView } from './features/lists/MyDayView.js';
import { RolloverPrompt } from './features/lists/RolloverPrompt.js';
import { OmnibarView } from './features/omnibar/OmnibarView.js';
import { MiniTimerView } from './features/pomodoro/MiniTimerView.js';
import { CommandPalette } from './features/command-palette/CommandPalette.js';
import { TagView } from './features/tags/TagView.js';
import { NotificationCenter } from './features/notifications/NotificationCenter.js';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow.js';
import { FocusModeView } from './features/focus/FocusModeView.js';
import { ReviewManager } from './features/review/ReviewManager.js';
import { useTaskStore } from './stores/taskStore.js';
import { usePomodoroStore } from './stores/pomodoroStore.js';
import { useAttachmentStore } from './stores/attachmentStore.js';
import { ipc, invoke } from './services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '../shared/types/task.js';

// Lazy views — loaded on-demand per PERFORMANCE.md §5 & vite.config.ts manualChunks
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.js'));
const Agenda = lazy(() => import('./features/agenda/Agenda.js'));
const Projects = lazy(() => import('./features/projects/Projects.js'));
const Settings = lazy(() => import('./features/settings/Settings.js'));
const Pomodoro = lazy(() => import('./features/pomodoro/PomodoroView.js'));

import {
  applyTheme,
  applyAccentColor,
  applyDensity,
  applyFontSize,
  applyFontFamily,
} from './utils/theme.js';
import { AppLockScreen } from './features/settings/AppLockScreen.js';

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
  const isMiniTimer = typeof window !== 'undefined' && window.location.hash.includes('mini-timer');

  const { activeListId, systemInfo, fetchSystemInfo } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const isPomodoroFocus = usePomodoroStore((state) => state.isFocusMode);
  const togglePomodoroFocus = usePomodoroStore((state) => state.toggleFocusMode);
  const effectiveFocusMode = isFocusMode || isPomodoroFocus;

  useEffect(() => {
    fetchSystemInfo();
    useAttachmentStore.getState().loadCounts();

    // Check lock status
    invoke<{ isEnabled: boolean; isLocked: boolean }>(IPC.SECURITY.GET_STATUS)
      .then((status) => {
        if (status?.isLocked) {
          setIsLocked(true);
        }
      })
      .catch(() => {});

    // Load initial settings and apply tokens
    invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL)
      .then((settings) => {
        if (settings) {
          if (settings.onboarding_completed === false || settings.onboarding_completed === undefined) {
            setIsOnboardingOpen(true);
          }
          if (settings.theme) applyTheme(settings.theme as 'auto');
          if (settings.accent_color) applyAccentColor(String(settings.accent_color));
          if (settings.density) applyDensity(settings.density as 'comfortable');
          if (settings.font_size) applyFontSize(String(settings.font_size));
          if (settings.font_family) applyFontFamily(String(settings.font_family));
        }
      })
      .catch(() => {});

    // Listen to theme and accent IPC events
    const unsubTheme = ipc.on(IPC.APP.SET_THEME, (data: unknown) => {
      const payload = data as { theme?: 'auto' | 'dark' | 'light'; effectiveTheme?: 'dark' | 'light' };
      if (payload) {
        applyTheme(payload.theme ?? 'auto', payload.effectiveTheme);
      }
    });

    const unsubAccent = ipc.on(IPC.APP.SET_ACCENT_COLOR, (data: unknown) => {
      const payload = data as { hex?: string };
      if (payload?.hex) {
        applyAccentColor(payload.hex);
      }
    });

    const unsubSettingsTheme = ipc.on(IPC.SETTINGS.THEME_CHANGED, (theme: unknown) => {
      if (typeof theme === 'string') {
        applyTheme(theme as 'light' | 'dark');
      }
    });

    const unsubSettingsAccent = ipc.on(IPC.SETTINGS.ACCENT_COLOR_CHANGED, (hex: unknown) => {
      if (typeof hex === 'string') {
        applyAccentColor(hex);
      }
    });

    const unsubFocus = ipc.on(IPC.APP.FOCUS_QUICK_ADD, () => {
      const quickAddInput = document.querySelector('input[placeholder*="Add a task"]') as HTMLInputElement;
      quickAddInput?.focus();
    });

    const handleReplayOnboarding = () => {
      setIsOnboardingOpen(true);
    };
    window.addEventListener('os11:replay-onboarding', handleReplayOnboarding);

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape' && (isFocusMode || isPomodoroFocus)) {
        e.preventDefault();
        setIsFocusMode(false);
        if (isPomodoroFocus) togglePomodoroFocus();
      } else if (modKey && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
        togglePomodoroFocus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubFocus?.();
      unsubTheme?.();
      unsubAccent?.();
      unsubSettingsTheme?.();
      unsubSettingsAccent?.();
      window.removeEventListener('os11:replay-onboarding', handleReplayOnboarding);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchSystemInfo, togglePomodoroFocus, isFocusMode, isPomodoroFocus]);

  if (isOmnibar) {
    return <OmnibarView />;
  }

  if (isMiniTimer) {
    return <MiniTimerView />;
  }

  const handleFocusTask = async (taskId: string) => {
    let task = useTaskStore.getState().tasksById[taskId];
    if (!task) {
      try {
        task = await ipc.invoke<Task>(IPC.TASKS.GET_BY_ID, taskId);
      } catch {
        // Best effort lookup
      }
    }
    if (task) {
      setSelectedTask(task);
      if (task.list_id) {
        useAppStore.getState().setActiveListId(task.list_id);
      } else {
        useAppStore.getState().setActiveListId('smart_all');
      }
    }
  };

  const renderMainContent = () => {
    if (activeListId.startsWith('tag:')) {
      const tagId = activeListId.slice(4);
      return (
        <TagView
          tagId={tagId}
          onSelectTask={(task) => setSelectedTask(task)}
          selectedTaskId={selectedTask?.id}
        />
      );
    }

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

  return (
    <div className={layoutStyles.container}>
      {/* App Lock Protection Overlay */}
      {isLocked && <AppLockScreen onUnlock={() => setIsLocked(false)} />}

      {/* Onboarding Flow for First Launch or Replay */}
      {isOnboardingOpen && (
        <OnboardingFlow onComplete={() => setIsOnboardingOpen(false)} />
      )}

      {/* Recurring Review Manager */}
      <ReviewManager />

      {/* Custom Frameless Titlebar */}
      <Titlebar
        title="OS11"
        version={systemInfo?.version}
        onToggleAlwaysOnTop={(pinned) => {
          ipc.invoke(IPC.APP.SET_ALWAYS_ON_TOP, { pinned }).catch(console.error);
        }}
      />

      {/* Full-Screen Focus Mode View or Three-Column Grid */}
      {effectiveFocusMode ? (
        <FocusModeView
          task={selectedTask}
          onClose={() => {
            setIsFocusMode(false);
            if (isPomodoroFocus) togglePomodoroFocus();
          }}
          onSelectTask={(task) => setSelectedTask(task)}
        />
      ) : (
        <div
          className={layoutStyles.shellGrid}
          data-sidebar={effectiveFocusMode ? 'hidden' : 'visible'}
          data-detail={effectiveFocusMode || !isDetailVisible ? 'hidden' : 'visible'}
          data-focus={effectiveFocusMode ? 'active' : 'inactive'}
        >
          {/* Column 1: Sidebar (Critical path) */}
          <div className={layoutStyles.sidebarCol}>
            <Sidebar />
          </div>

          {/* Column 2: Center Main Content (TaskList, MyDayView, or Lazy View) */}
          <main className={layoutStyles.mainCol}>
            {renderMainContent()}
          </main>

          {/* Column 3: Detail Panel (Critical path) */}
          <div className={layoutStyles.detailCol}>
            <DetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
          </div>
        </div>
      )}

      {/* Rollover Prompt on day change for incomplete yesterday tasks */}
      <RolloverPrompt />

      {/* Command Palette Spotlight modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleFocusMode={() => {
          setIsFocusMode((prev) => !prev);
          togglePomodoroFocus();
        }}
      />

      {/* Slide-In In-App Notification Center Drawer */}
      <NotificationCenter onFocusTask={handleFocusTask} />
    </div>
  );
}

export default App;
