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
import { useTagStore } from './stores/tagStore.js';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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

  const {
    activeListId,
    systemInfo,
    fetchSystemInfo,
    isSidebarVisible,
    setSidebarVisible,
  } = useAppStore();
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

    if (activeListId.startsWith('project:')) {
      return (
        <Suspense fallback={<ViewSkeleton />}>
          <Projects />
        </Suspense>
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

  const isDetailVisible = !activeListId.startsWith('view_') && !activeListId.startsWith('project:') && Boolean(selectedTask);

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAppDragStart = (event: DragStartEvent) => {
    console.log('[DragDrop] Drag start:', event.active.id);
  };

  const handleAppDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (over) {
      console.log('[DragDrop] Hover target detected:', over.id, 'from active:', active.id);
    }
  };

  const handleAppDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('[DragDrop] Drag end event:', { activeId: active.id, overId: over?.id });
    if (!over || active.id === over.id) return;

    const overIdStr = String(over.id);
    const activeTaskId = String(active.id);

    if (overIdStr.startsWith('list:')) {
      const targetListId = overIdStr.slice(5);
      console.log('[DragDrop] Drop commit on list:', targetListId, 'with payload:', { taskId: activeTaskId, target: overIdStr });
      await useTaskStore.getState().updateTask({ id: activeTaskId, list_id: targetListId });
      return;
    }

    if (overIdStr.startsWith('project:')) {
      const targetProjectId = overIdStr.slice(8);
      console.log('[DragDrop] Drop commit on project:', targetProjectId, 'with payload:', { taskId: activeTaskId, target: overIdStr });
      await useTaskStore.getState().updateTask({ id: activeTaskId, project_id: targetProjectId });
      return;
    }

    if (overIdStr.startsWith('tag:')) {
      const targetTagId = overIdStr.slice(4);
      console.log('[DragDrop] Drop commit on tag:', targetTagId, 'with payload:', { taskId: activeTaskId, target: overIdStr });
      await useTagStore.getState().addTagToTask(activeTaskId, targetTagId);
      return;
    }
  };

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
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragStart={handleAppDragStart}
          onDragOver={handleAppDragOver}
          onDragEnd={handleAppDragEnd}
        >
          <div
            className={layoutStyles.shellGrid}
            data-sidebar={effectiveFocusMode || !isSidebarVisible ? 'hidden' : 'visible'}
            data-detail={effectiveFocusMode || !isDetailVisible ? 'hidden' : 'visible'}
            data-focus={effectiveFocusMode ? 'active' : 'inactive'}
          >
            {/* Column 1: Sidebar (Critical path) */}
            <div className={layoutStyles.sidebarCol}>
              <Sidebar />
            </div>

            {/* Column 2: Center Main Content (TaskList, MyDayView, or Lazy View) */}
            <main className={`${layoutStyles.mainCol} ${!isSidebarVisible ? layoutStyles.mainColSidebarHidden : ''}`}>
              {!isSidebarVisible && !effectiveFocusMode && (
                <button
                  type="button"
                  className={layoutStyles.floatingSidebarToggle}
                  onClick={() => setSidebarVisible(true)}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M9 3v18" />
                  </svg>
                </button>
              )}
              {renderMainContent()}
            </main>

            {/* Column 3: Detail Panel (Critical path) */}
            <div className={layoutStyles.detailCol}>
              <DetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
            </div>
          </div>
        </DndContext>
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
