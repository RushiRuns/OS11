import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useAppStore } from './stores/app-store.js';
import { Titlebar } from './components/Titlebar/Titlebar.js';

// Critical path — always in initial bundle (PERFORMANCE.md §5)
import { Sidebar } from './features/sidebar/Sidebar.js';
import { TaskList } from './features/tasks/TaskList.js';
import { DetailPanel } from './features/tasks/DetailPanel.js';
import { MyDayView } from './features/lists/MyDayView.js';
import { PlannedView } from './features/lists/PlannedView.js';
import { useUndoRedoStore } from './hooks/useUndoRedo.js';
import { formatForDisplay, toISODateOnly } from '@shared/utils/date.js';
import { resolvePlannedDrop, type PlannedDropData } from './hooks/usePlannedGroups.js';
import { SuggestionsSidebar } from './features/lists/SuggestionsSidebar.js';
import { RolloverPrompt } from './features/lists/RolloverPrompt.js';
import { OmnibarView } from './features/omnibar/OmnibarView.js';
import { MiniTimerView } from './features/pomodoro/MiniTimerView.js';
import { FloatingQuickAddModal } from './features/quickadd/FloatingQuickAddModal.js';
import { CommandPalette } from './features/command-palette/CommandPalette.js';
import { TagView } from './features/tags/TagView.js';
import { NotificationCenter } from './features/notifications/NotificationCenter.js';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow.js';
import { FocusModeView } from './features/focus/FocusModeView.js';
import { ReviewManager } from './features/review/ReviewManager.js';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskStore } from './stores/taskStore.js';
import { useSchedulerUiStore } from './stores/schedulerUiStore.js';
import { SchedulerSkeleton } from './features/lists/scheduler/SchedulerSkeleton.js';
import { usePomodoroStore } from './stores/pomodoroStore.js';
import { useAttachmentStore } from './stores/attachmentStore.js';
import { useTagStore } from './stores/tagStore.js';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { RowPointerSensor, BlockPointerSensor } from './utils/dndSensors.js';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { schedulerCollisionDetection } from './features/lists/scheduler/schedulerCollision.js';
import { TimeBlockDragOverlay } from './features/lists/scheduler/TimeBlockDragOverlay.js';
import { TaskRowDragOverlay } from './features/tasks/TaskRowDragOverlay.js';
import { HOUR_HEIGHT } from './features/lists/scheduler/useSchedulerLayout.js';
import { toISODate } from '../shared/utils/date.js';
import {
  placeBlock,
  snapToGrid,
  yToMinutes,
  defaultDuration,
  type BlockInterval,
} from '../shared/utils/schedulerMath.js';
import { ipc, invoke } from './services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '../shared/types/task.js';

// Lazy views — loaded on-demand per PERFORMANCE.md §5 & vite.config.ts manualChunks
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.js'));
const Goals = lazy(() => import('./features/goals/GoalsView.js'));
const Projects = lazy(() => import('./features/projects/Projects.js'));
const AreaView = lazy(() => import('./features/areas/AreaView.js'));
const Settings = lazy(() => import('./features/settings/Settings.js'));
const Pomodoro = lazy(() => import('./features/pomodoro/PomodoroView.js'));
const SchedulerPanel = lazy(() => import('./features/lists/scheduler/SchedulerPanel.js'));

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
  const isQuickAddModal =
    typeof window !== 'undefined' && window.location.hash.includes('quickadd-modal');

  const { activeListId, systemInfo, fetchSystemInfo, isSidebarVisible, setSidebarVisible } =
    useAppStore();

  const selectedTaskId = useTaskStore(s => s.selectedTaskId);
  const rightSlotActive = useTaskStore(s => s.rightSlotActive);
  const toggleRightSlotPeer = useTaskStore(s => s.toggleRightSlotPeer);
  const openDetail = useTaskStore(s => s.openDetail);
  const closeDetail = useTaskStore(s => s.closeDetail);
  const schedulerPanelWidth = useSchedulerUiStore(s => s.panelWidth);

  // Derive live task directly from Zustand store to ensure changes reflect instantly in sidebar
  const liveSelectedTask = useTaskStore(state =>
    selectedTaskId ? (state.tasksById[selectedTaskId] ?? null) : null
  );

  const handleSelectTask = (task: Task | null) => {
    if (task) {
      openDetail(task.id);
    } else {
      closeDetail();
    }
  };

  // Auto-close detail sidebar if task is deleted or trashed
  useEffect(() => {
    if (selectedTaskId && (!liveSelectedTask || liveSelectedTask.is_trashed === 1)) {
      closeDetail();
    }
  }, [selectedTaskId, liveSelectedTask, closeDetail]);

  useEffect(() => {
    const handleToggleScheduler = () => {
      toggleRightSlotPeer('scheduler');
    };
    window.addEventListener('os11:toggle-scheduler', handleToggleScheduler);
    return () => window.removeEventListener('os11:toggle-scheduler', handleToggleScheduler);
  }, [toggleRightSlotPeer]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const isPomodoroFocus = usePomodoroStore(state => state.isFocusMode);
  const togglePomodoroFocus = usePomodoroStore(state => state.toggleFocusMode);
  const effectiveFocusMode = isFocusMode || isPomodoroFocus;

  useEffect(() => {
    fetchSystemInfo();
    useAttachmentStore.getState().loadCounts();

    // Check lock status
    invoke<{ isEnabled: boolean; isLocked: boolean }>(IPC.SECURITY.GET_STATUS)
      .then(status => {
        if (status?.isLocked) {
          setIsLocked(true);
        }
      })
      .catch(() => {});

    // Load initial settings and apply tokens
    invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL)
      .then(settings => {
        if (settings) {
          if (
            settings.onboarding_completed === false ||
            settings.onboarding_completed === undefined
          ) {
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
      const payload = data as {
        theme?: 'auto' | 'dark' | 'light';
        effectiveTheme?: 'dark' | 'light';
      };
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

    const unsubFocus = ipc.on(IPC.APP.FOCUS_QUICK_ADD, (_event: unknown, payload?: unknown) => {
      const data = payload as { navigateToInbox?: boolean } | undefined;
      if (data?.navigateToInbox) {
        useAppStore.getState().setActiveListId('list_inbox');
      }
      setTimeout(() => {
        const quickAddInput = document.querySelector(
          'input[placeholder*="Add a task"], textarea[placeholder*="Add a task"]'
        ) as HTMLInputElement | HTMLTextAreaElement | null;
        quickAddInput?.focus();
        quickAddInput?.select();
      }, 50);
    });

    const handleReplayOnboarding = () => {
      setIsOnboardingOpen(true);
    };
    window.addEventListener('os11:replay-onboarding', handleReplayOnboarding);

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac =
        typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (
        e.key === 'F12' ||
        (isMac
          ? modKey && e.altKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c')
          : modKey && e.shiftKey && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'c'))
      ) {
        e.preventDefault();
        ipc.invoke(IPC.APP.TOGGLE_DEV_TOOLS).catch(() => {});
        return;
      }

      if (e.key === 'Escape' && (isFocusMode || isPomodoroFocus)) {
        e.preventDefault();
        setIsFocusMode(false);
        if (isPomodoroFocus) togglePomodoroFocus();
      } else if (modKey && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      } else if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFocusMode(prev => !prev);
        togglePomodoroFocus();
      }
    };

    const unsubTasksChanged = ipc.on(IPC.TASKS.CHANGED, () => {
      useTaskStore.getState().loadTasks();
    });

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubTasksChanged?.();
      unsubFocus?.();
      unsubTheme?.();
      unsubAccent?.();
      unsubSettingsTheme?.();
      unsubSettingsAccent?.();
      window.removeEventListener('os11:replay-onboarding', handleReplayOnboarding);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fetchSystemInfo, togglePomodoroFocus, isFocusMode, isPomodoroFocus]);

  const dndSensors = useSensors(
    useSensor(RowPointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    useSensor(BlockPointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isOmnibar) {
    return <OmnibarView />;
  }

  if (isMiniTimer) {
    return <MiniTimerView />;
  }

  if (isQuickAddModal) {
    return <FloatingQuickAddModal />;
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
      handleSelectTask(task);
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
          onSelectTask={handleSelectTask}
          selectedTaskId={liveSelectedTask?.id}
        />
      );
    }

    if (activeListId.startsWith('area:')) {
      const areaId = activeListId.slice(5);
      return (
        <Suspense fallback={<ViewSkeleton />}>
          <AreaView
            areaId={areaId}
            onSelectTask={handleSelectTask}
            selectedTaskId={liveSelectedTask?.id}
          />
        </Suspense>
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
            onSelectTask={handleSelectTask}
            selectedTaskId={liveSelectedTask?.id}
            isSuggestionsOpen={rightSlotActive === 'suggestions'}
            onToggleSuggestions={() => toggleRightSlotPeer('suggestions')}
            isSchedulerOpen={rightSlotActive === 'scheduler'}
            onToggleScheduler={() => toggleRightSlotPeer('scheduler')}
          />
        );
      case 'smart_planned':
        return (
          <PlannedView onSelectTask={handleSelectTask} selectedTaskId={liveSelectedTask?.id} />
        );
      case 'view_dashboard':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Dashboard />
          </Suspense>
        );
      case 'view_agenda':
      case 'view_goals':
        return (
          <Suspense fallback={<ViewSkeleton />}>
            <Goals />
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
        return <TaskList onSelectTask={handleSelectTask} selectedTaskId={liveSelectedTask?.id} />;
    }
  };

  const isRightSlotVisible =
    !activeListId.startsWith('view_') &&
    !activeListId.startsWith('project:') &&
    ((activeListId === 'smart_my_day' &&
      (rightSlotActive === 'scheduler' || rightSlotActive === 'suggestions')) ||
      (rightSlotActive === 'detail' && Boolean(liveSelectedTask)));

  const rightSlotWidth = React.useMemo(() => {
    if (activeListId === 'smart_my_day') {
      if (rightSlotActive === 'scheduler') return `${schedulerPanelWidth}px`;
      if (rightSlotActive === 'suggestions') return 'var(--detail-panel-width, 360px)';
    }
    if (rightSlotActive === 'detail' && liveSelectedTask) {
      return 'var(--detail-panel-width, 360px)';
    }
    return '0px';
  }, [activeListId, rightSlotActive, schedulerPanelWidth, liveSelectedTask]);

  const [activeDragItem, setActiveDragItem] = useState<{
    type: 'time-block' | 'task-row';
    task?: Task;
    subtaskCount?: { completed: number; total: number };
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const handleAppDragStart = (event: DragStartEvent) => {
    useSchedulerUiStore.getState().setIsDragging(true);
    const activeData = event.active.data?.current;
    if (activeData?.type === 'time-block') {
      setActiveDragItem({
        type: 'time-block',
        task: activeData.task as Task,
      });
    } else if (activeData?.type === 'task-row' && activeData.task) {
      setActiveDragItem({
        type: 'task-row',
        task: activeData.task as Task,
        subtaskCount: activeData.subtaskCount,
      });
    } else {
      const task = useTaskStore.getState().tasksById[String(event.active.id)];
      if (task) {
        setActiveDragItem({
          type: 'task-row',
          task,
        });
      } else {
        setActiveDragItem(null);
      }
    }
  };

  const handleAppDragOver = (event: DragOverEvent) => {
    const { active, over, delta } = event;
    const overIdStr = over ? String(over.id) : null;
    setDragOverTarget(overIdStr);

    const isTimeBlock = active.data?.current?.type === 'time-block';

    if (overIdStr === 'scheduler-grid') {
      const activeTop =
        active.rect.current.translated?.top ??
        (active.rect.current.initial ? active.rect.current.initial.top + delta.y : null);
      const gridTop = over?.rect?.top ?? 0;

      if (activeTop !== null && over?.rect) {
        const relativeY = activeTop - gridTop;
        const desiredStart = snapToGrid(yToMinutes(relativeY, HOUR_HEIGHT));

        let duration = 30;
        let taskId = '';
        let task: Task | undefined;
        let allowShrink = false;

        if (isTimeBlock) {
          task = active.data?.current?.task as Task;
          taskId = task?.id ?? String(active.id).replace(/^block:/, '');
          duration = task?.scheduled_duration_min ?? 30;
          allowShrink = false;
        } else {
          taskId = String(active.id);
          task = useTaskStore.getState().tasksById[taskId];
          if (task) {
            // Guard: completed tasks cannot be newly dragged in; subtasks cannot be dragged in v1
            if (task.is_completed === 1 || task.parent_task_id !== null) {
              useSchedulerUiStore.getState().setDragPreviewMinutes(null);
              return;
            }
            duration = defaultDuration(task);
            allowShrink = true;
          }
        }

        if (task) {
          const today = task.my_day_date ?? toISODate(new Date());
          const others: BlockInterval[] = Object.values(useTaskStore.getState().tasksById)
            .filter(
              (t): t is Task =>
                t.id !== taskId &&
                t.my_day_date === today &&
                t.is_trashed === 0 &&
                typeof t.scheduled_start_min === 'number' &&
                typeof t.scheduled_duration_min === 'number'
            )
            .map((t) => ({
              id: t.id,
              start: t.scheduled_start_min!,
              duration: t.scheduled_duration_min!,
            }));

          const placed = placeBlock(others, desiredStart, duration, { allowShrink });
          if (placed) {
            useSchedulerUiStore.getState().setDragPreviewMinutes({
              startMin: placed.start,
              durationMin: placed.duration,
              isValid: true,
            });
          } else {
            useSchedulerUiStore.getState().setDragPreviewMinutes({
              startMin: Math.max(0, desiredStart),
              durationMin: duration,
              isValid: false,
            });
          }
        }
      }
    } else {
      useSchedulerUiStore.getState().setDragPreviewMinutes(null);
    }

    if (isTimeBlock) {
      if (overIdStr === 'scheduler-grid' || overIdStr === 'my-day-list-drop-zone') {
        document.body.classList.remove('dnd-cursor-not-allowed');
      } else {
        document.body.classList.add('dnd-cursor-not-allowed');
      }
    } else {
      const overData = over?.data?.current as PlannedDropData | undefined;
      if (overData?.type === 'planned-group' && overData.kind === 'overdue') {
        document.body.classList.add('dnd-cursor-not-allowed');
      } else {
        document.body.classList.remove('dnd-cursor-not-allowed');
      }
    }
  };

  const handleAppDragEnd = async (event: DragEndEvent) => {
    document.body.classList.remove('dnd-cursor-not-allowed');
    useSchedulerUiStore.getState().setIsDragging(false);
    useSchedulerUiStore.getState().setDragPreviewMinutes(null);
    setActiveDragItem(null);
    setDragOverTarget(null);

    const { active, over, delta } = event;
    if (!over) return;

    const overIdStr = String(over.id);
    const isTimeBlock = active.data?.current?.type === 'time-block';
    const rawActiveId = String(active.id);
    const activeTaskId = isTimeBlock ? rawActiveId.replace(/^block:/, '') : rawActiveId;
    const task = useTaskStore.getState().tasksById[activeTaskId];
    if (!task) return;

    if (overIdStr === 'scheduler-grid') {
      const activeTop =
        active.rect.current.translated?.top ??
        (active.rect.current.initial ? active.rect.current.initial.top + delta.y : null);
      const gridTop = over.rect?.top ?? 0;
      if (activeTop === null || !over.rect) return;

      const relativeY = activeTop - gridTop;
      const desiredStart = snapToGrid(yToMinutes(relativeY, HOUR_HEIGHT));

      const today = task.my_day_date ?? toISODate(new Date());
      const others: BlockInterval[] = Object.values(useTaskStore.getState().tasksById)
        .filter(
          (t): t is Task =>
            t.id !== activeTaskId &&
            t.my_day_date === today &&
            t.is_trashed === 0 &&
            typeof t.scheduled_start_min === 'number' &&
            typeof t.scheduled_duration_min === 'number'
        )
        .map((t) => ({
          id: t.id,
          start: t.scheduled_start_min!,
          duration: t.scheduled_duration_min!,
        }));

      if (isTimeBlock) {
        const prevStart = task.scheduled_start_min;
        const prevDuration = task.scheduled_duration_min;
        const duration = prevDuration ?? 30;
        const placed = placeBlock(others, desiredStart, duration, { allowShrink: false });
        if (!placed) return;

        if (placed.start !== prevStart || placed.duration !== prevDuration) {
          await useTaskStore.getState().updateTimeBlock(activeTaskId, placed.start, placed.duration);
          if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
            useUndoRedoStore.getState().pushAction({
              description: `Moved "${task.title}"`,
              undoFn: async () => {
                await useTaskStore.getState().updateTimeBlock(activeTaskId, prevStart, prevDuration);
              },
              redoFn: async () => {
                await useTaskStore.getState().updateTimeBlock(activeTaskId, placed.start, placed.duration);
              },
            });
          }
        }
      } else {
        // Guard: completed tasks cannot be newly dragged in; subtasks cannot be dragged in v1
        if (task.is_completed === 1 || task.parent_task_id !== null) return;

        const duration = defaultDuration(task);
        const placed = placeBlock(others, desiredStart, duration, { allowShrink: true });
        if (!placed) return;

        await useTaskStore.getState().scheduleTask(activeTaskId, placed.start, placed.duration);
        useUndoRedoStore.getState().pushAction({
          description: `Scheduled "${task.title}"`,
          undoFn: async () => {
            await useTaskStore.getState().unscheduleTask(activeTaskId);
          },
          redoFn: async () => {
            await useTaskStore.getState().scheduleTask(activeTaskId, placed.start, placed.duration);
          },
        });
      }
      return;
    }

    if (overIdStr === 'my-day-list-drop-zone') {
      if (isTimeBlock) {
        const prevStart = task.scheduled_start_min;
        const prevDuration = task.scheduled_duration_min;
        await useTaskStore.getState().unscheduleTask(activeTaskId);
        if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
          useUndoRedoStore.getState().pushAction({
            description: `Unscheduled "${task.title}"`,
            undoFn: async () => {
              await useTaskStore.getState().updateTimeBlock(activeTaskId, prevStart, prevDuration);
            },
            redoFn: async () => {
              await useTaskStore.getState().unscheduleTask(activeTaskId);
            },
          });
        }
      }
      return;
    }

    if (isTimeBlock) {
      // Drop time-block anywhere else is cancelled
      return;
    }

    if (overIdStr.startsWith('list:')) {
      const targetListId = overIdStr.slice(5);
      await useTaskStore.getState().updateTask({ id: activeTaskId, list_id: targetListId });
      return;
    }

    if (overIdStr.startsWith('project:')) {
      const targetProjectId = overIdStr.slice(8);
      await useTaskStore.getState().updateTask({ id: activeTaskId, project_id: targetProjectId });
      return;
    }

    if (overIdStr.startsWith('tag:')) {
      const targetTagId = overIdStr.slice(4);
      await useTagStore.getState().addTagToTask(activeTaskId, targetTagId);
      return;
    }

    const overData = over.data?.current as PlannedDropData | undefined;

    if (overData?.type === 'planned-group') {
      const target = useTaskStore.getState().tasksById[activeTaskId];
      if (!target) return;

      const todayStr = toISODateOnly(new Date());
      const resolvedTargetDate = resolvePlannedDrop(target, overData, todayStr);
      if (!resolvedTargetDate) {
        return;
      }

      const prevDueDate = target.due_date;
      await useTaskStore.getState().updateTask({ id: activeTaskId, due_date: resolvedTargetDate });

      const displayDate = formatForDisplay(resolvedTargetDate);
      useUndoRedoStore.getState().pushAction({
        description: `Moved to ${displayDate}`,
        undoFn: async () => {
          await useTaskStore.getState().updateTask({ id: activeTaskId, due_date: prevDueDate });
        },
        redoFn: async () => {
          await useTaskStore.getState().updateTask({ id: activeTaskId, due_date: resolvedTargetDate });
        },
      });
      return;
    }
  };

  return (
    <div className={layoutStyles.container}>
      {/* App Lock Protection Overlay */}
      {isLocked && <AppLockScreen onUnlock={() => setIsLocked(false)} />}

      {/* Onboarding Flow for First Launch or Replay */}
      {isOnboardingOpen && <OnboardingFlow onComplete={() => setIsOnboardingOpen(false)} />}

      {/* Recurring Review Manager */}
      <ReviewManager />

      {/* Custom Frameless Titlebar */}
      <Titlebar
        title="OS11"
        version={systemInfo?.version}
        onToggleAlwaysOnTop={pinned => {
          ipc.invoke(IPC.APP.SET_ALWAYS_ON_TOP, { pinned }).catch(console.error);
        }}
      />

      {/* Full-Screen Focus Mode View or Three-Column Grid */}
      {effectiveFocusMode ? (
        <FocusModeView
          task={liveSelectedTask}
          onClose={() => {
            setIsFocusMode(false);
            if (isPomodoroFocus) togglePomodoroFocus();
          }}
          onSelectTask={handleSelectTask}
        />
      ) : (
        <DndContext
          sensors={dndSensors}
          collisionDetection={schedulerCollisionDetection}
          onDragStart={handleAppDragStart}
          onDragOver={handleAppDragOver}
          onDragEnd={handleAppDragEnd}
        >
          <div
            className={layoutStyles.shellGrid}
            style={{ '--right-slot-width': rightSlotWidth } as React.CSSProperties}
            data-sidebar={effectiveFocusMode || !isSidebarVisible ? 'hidden' : 'visible'}
            data-detail={effectiveFocusMode || !isRightSlotVisible ? 'hidden' : 'visible'}
            data-focus={effectiveFocusMode ? 'active' : 'inactive'}
            data-dragging={Boolean(activeDragItem) ? 'true' : 'false'}
          >
            {/* Column 1: Sidebar (Critical path) */}
            <div className={layoutStyles.sidebarCol}>
              <Sidebar />
            </div>

            {/* Column 2: Center Main Content (TaskList, MyDayView, or Lazy View) */}
            <main
              className={`${layoutStyles.mainCol} ${!isSidebarVisible ? layoutStyles.mainColSidebarHidden : ''}`}
            >
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

            {/* Column 3: Right Slot (Detail Panel / Suggestions / Scheduler) */}
            <div className={layoutStyles.detailCol}>
              <AnimatePresence mode="wait">
                {activeListId === 'smart_my_day' && rightSlotActive === 'scheduler' ? (
                  <motion.div
                    key="scheduler"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <Suspense fallback={<SchedulerSkeleton />}>
                      <SchedulerPanel />
                    </Suspense>
                  </motion.div>
                ) : activeListId === 'smart_my_day' && rightSlotActive === 'suggestions' ? (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <SuggestionsSidebar onClose={() => toggleRightSlotPeer('suggestions')} />
                  </motion.div>
                ) : rightSlotActive === 'detail' && liveSelectedTask ? (
                  <motion.div
                    key={`detail-${liveSelectedTask.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <DetailPanel
                      task={liveSelectedTask}
                      onClose={closeDetail}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Centralized Floating Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeDragItem?.type === 'time-block' && activeDragItem.task ? (
              <TimeBlockDragOverlay
                task={activeDragItem.task}
                isOverGrid={dragOverTarget === 'scheduler-grid'}
                isOverList={dragOverTarget === 'my-day-list-drop-zone'}
                isOutside={
                  dragOverTarget !== 'scheduler-grid' &&
                  dragOverTarget !== 'my-day-list-drop-zone'
                }
              />
            ) : activeDragItem?.type === 'task-row' && activeDragItem.task ? (
              <TaskRowDragOverlay
                task={activeDragItem.task}
                subtaskCount={activeDragItem.subtaskCount}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Rollover Prompt on day change for incomplete yesterday tasks */}
      <RolloverPrompt />

      {/* Command Palette Spotlight modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleFocusMode={() => {
          setIsFocusMode(prev => !prev);
          togglePomodoroFocus();
        }}
      />

      {/* Slide-In In-App Notification Center Drawer */}
      <NotificationCenter onFocusTask={handleFocusTask} />
    </div>
  );
}

export default App;
