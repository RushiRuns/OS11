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
import { useTaskStore } from './stores/taskStore.js';
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
import { ipc, invoke } from './services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Task } from '../shared/types/task.js';
import { schedulerCollisionDetection } from './features/lists/scheduler/schedulerCollision.js';
import { TimeBlockDragOverlay } from './features/lists/scheduler/TimeBlockDragOverlay.js';
import { yToMinutes, snapToGrid, defaultDuration, placeBlock, type BlockInterval } from '@shared/utils/schedulerMath.js';
import { HOUR_HEIGHT } from './features/lists/scheduler/useSchedulerLayout.js';
import { toISODate } from '@shared/utils/date.js';

// Lazy views — loaded on-demand per PERFORMANCE.md §5 & vite.config.ts manualChunks
const Dashboard = lazy(() => import('./features/dashboard/Dashboard.js'));
const Agenda = lazy(() => import('./features/agenda/Agenda.js'));
const SchedulerPanel = lazy(() => import('./features/lists/scheduler/SchedulerPanel.js'));
const Projects = lazy(() => import('./features/projects/Projects.js'));
const AreaView = lazy(() => import('./features/areas/AreaView.js'));
const Settings = lazy(() => import('./features/settings/Settings.js'));
const Pomodoro = lazy(() => import('./features/pomodoro/PomodoroView.js'));

import { SchedulerSkeleton } from './features/lists/scheduler/SchedulerSkeleton.js';
import { useSchedulerUiStore } from './stores/schedulerUiStore.js';
import { useModuleStore } from './stores/moduleStore.js';

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
  const rightSlotActive = useTaskStore(state => state.rightSlotActive);
  const selectedTaskId = useTaskStore(state => state.selectedTaskId);
  const liveSelectedTask = useTaskStore(state =>
    selectedTaskId ? state.tasksById[selectedTaskId] ?? null : null
  );
  const schedulerWidth = useSchedulerUiStore(state => state.panelWidth);
  const isSchedulerDragging = useSchedulerUiStore(state => state.isDragging);

  // Auto-close detail sidebar if task is deleted or trashed
  useEffect(() => {
    if (selectedTaskId && (!liveSelectedTask || liveSelectedTask.is_trashed === 1)) {
      useTaskStore.getState().closeDetail();
    }
  }, [selectedTaskId, liveSelectedTask]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState<{ id: string; type?: string; task?: Task } | null>(null);
  const [isOverGrid, setIsOverGrid] = useState(false);
  const [isOverList, setIsOverList] = useState(false);
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
      } else if (modKey && e.shiftKey && e.key.toLowerCase() === 's') {
        const activeListId = useAppStore.getState().activeListId;
        if (activeListId === 'smart_my_day' && useModuleStore.getState().isEnabled('agenda')) {
          e.preventDefault();
          useTaskStore.getState().toggleScheduler();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Day Rollover Lifecycle Hooks
    useTaskStore.getState().ensureDayRollover().catch(console.error);

    const handleWindowFocus = () => {
      useTaskStore.getState().ensureDayRollover().catch(console.error);
    };
    window.addEventListener('focus', handleWindowFocus);

    const unsubRollover = ipc.on(IPC.TASKS.ENSURE_DAY_ROLLOVER, () => {
      useTaskStore.getState().ensureDayRollover().catch(console.error);
    });

    let rolloverTimerId: ReturnType<typeof setTimeout> | null = null;
    const scheduleNextRollover = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      const delayMs = Math.max(1000, tomorrow.getTime() - now.getTime());
      rolloverTimerId = setTimeout(async () => {
        await useTaskStore.getState().ensureDayRollover().catch(console.error);
        scheduleNextRollover();
      }, delayMs);
    };
    scheduleNextRollover();

    return () => {
      if (rolloverTimerId) clearTimeout(rolloverTimerId);
      window.removeEventListener('focus', handleWindowFocus);
      unsubRollover?.();
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

  const handleSelectTask = (task: Task | null) => {
    if (task) {
      useTaskStore.getState().openDetail(task.id);
    } else {
      useTaskStore.getState().closeDetail();
    }
  };

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
            onToggleSuggestions={() => useTaskStore.getState().toggleSuggestions()}
            isSchedulerOpen={rightSlotActive === 'scheduler'}
            onToggleScheduler={() => useTaskStore.getState().toggleScheduler()}
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
        return <TaskList onSelectTask={handleSelectTask} selectedTaskId={liveSelectedTask?.id} />;
    }
  };

  const isMyDay = activeListId === 'smart_my_day';
  const isDetailVisible =
    !activeListId.startsWith('view_') &&
    !activeListId.startsWith('project:') &&
    ((rightSlotActive === 'detail' && Boolean(liveSelectedTask)) ||
      (isMyDay && (rightSlotActive === 'scheduler' || rightSlotActive === 'suggestions')));

  let rightSlotWidth = 'var(--detail-panel-width, 360px)';
  if (isMyDay && rightSlotActive === 'scheduler') {
    rightSlotWidth = `${schedulerWidth}px`;
  }

  const handleAppDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data?.current?.type as string | undefined;
    let task = active.data?.current?.task as Task | undefined;
    if (!task) {
      task = useTaskStore.getState().tasksById[String(active.id)];
    }
    setActiveDragItem({ id: String(active.id), type, task });
    if (type === 'time-block') {
      useSchedulerUiStore.getState().setIsDragging(true);
    }
  };

  const handleAppDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const isTimeBlock = active.data?.current?.type === 'time-block';
    const overId = over ? String(over.id) : null;

    setIsOverGrid(overId === 'scheduler-grid');
    setIsOverList(overId === 'my-day-list-drop-zone');

    if (isTimeBlock) {
      if (overId === 'scheduler-grid' || overId === 'my-day-list-drop-zone') {
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

    if (overId === 'scheduler-grid') {
      const gridEl = document.querySelector('[data-drop-target="scheduler-grid"]') as HTMLElement | null;
      if (gridEl) {
        const scrollContainer = gridEl.parentElement;
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const gridRect = gridEl.getBoundingClientRect();

        const activeRect = active.rect.current.translated ?? active.rect.current.initial;
        const pointerY = activeRect ? activeRect.top : 0;
        const yInGrid = Math.max(0, pointerY - gridRect.top + scrollTop);
        const rawMin = yToMinutes(yInGrid, HOUR_HEIGHT);
        const snappedMin = snapToGrid(rawMin);

        let taskId: string;
        let durationMin: number;
        if (isTimeBlock) {
          taskId = String(active.data.current?.taskId ?? active.id);
          const task = (active.data.current?.task as Task | undefined) ?? useTaskStore.getState().tasksById[taskId];
          durationMin = task?.scheduled_duration_min ?? 30;
        } else {
          taskId = String(active.id);
          const task = useTaskStore.getState().tasksById[taskId];
          durationMin = defaultDuration(task);
        }

        const today = toISODate(new Date());
        const occupied: BlockInterval[] = Object.values(useTaskStore.getState().tasksById)
          .filter(
            (t) =>
              t.id !== taskId &&
              t.my_day_date === today &&
              t.is_trashed === 0 &&
              typeof t.scheduled_start_min === 'number' &&
              typeof t.scheduled_duration_min === 'number'
          )
          .map((t) => ({
            start: t.scheduled_start_min!,
            duration: t.scheduled_duration_min!,
          }));

        const placed = placeBlock(occupied, snappedMin, durationMin, { allowShrink: !isTimeBlock });
        if (placed) {
          useSchedulerUiStore.getState().setDragPreviewMinutes({
            startMin: placed.start,
            durationMin: placed.duration,
          });
        } else {
          useSchedulerUiStore.getState().setDragPreviewMinutes(null);
        }
      }
    } else {
      useSchedulerUiStore.getState().setDragPreviewMinutes(null);
    }
  };

  const handleAppDragEnd = async (event: DragEndEvent) => {
    document.body.classList.remove('dnd-cursor-not-allowed');
    setActiveDragItem(null);
    setIsOverGrid(false);
    setIsOverList(false);
    useSchedulerUiStore.getState().setIsDragging(false);

    const { active, over } = event;
    const dragPreview = useSchedulerUiStore.getState().dragPreviewMinutes;
    useSchedulerUiStore.getState().setDragPreviewMinutes(null);

    if (!over) return;

    const overIdStr = String(over.id);
    const isTimeBlock = active.data?.current?.type === 'time-block';
    const activeTaskId = isTimeBlock
      ? String(active.data.current?.taskId ?? active.id)
      : String(active.id);

    // 1. Drop on scheduler-grid
    if (overIdStr === 'scheduler-grid') {
      const task = useTaskStore.getState().tasksById[activeTaskId];
      if (!task) return;

      // Spec §2 Decisions 19 & 20:
      // Subtasks cannot be scheduled in v1; Completed tasks cannot be newly dragged in
      if (!isTimeBlock) {
        if (task.parent_task_id !== null || task.is_completed === 1) {
          return;
        }
      }

      if (dragPreview) {
        if (isTimeBlock) {
          const prevStart = task.scheduled_start_min;
          const prevDuration = task.scheduled_duration_min;
          await useTaskStore.getState().updateTimeBlock(activeTaskId, dragPreview.startMin, dragPreview.durationMin);
          if (prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
            useUndoRedoStore.getState().pushAction({
              description: `Rescheduled "${task.title}"`,
              undoFn: async () => {
                await useTaskStore.getState().updateTimeBlock(activeTaskId, prevStart, prevDuration);
              },
              redoFn: async () => {
                await useTaskStore.getState().updateTimeBlock(activeTaskId, dragPreview.startMin, dragPreview.durationMin);
              },
            });
          }
        } else {
          await useTaskStore.getState().scheduleTask(activeTaskId, dragPreview.startMin, dragPreview.durationMin);
          useUndoRedoStore.getState().pushAction({
            description: `Scheduled "${task.title}"`,
            undoFn: async () => {
              await useTaskStore.getState().unscheduleTask(activeTaskId);
            },
            redoFn: async () => {
              await useTaskStore.getState().scheduleTask(activeTaskId, dragPreview.startMin, dragPreview.durationMin);
            },
          });
        }
      }
      return;
    }

    // 2. Drop on my-day-list-drop-zone (unschedule)
    if (overIdStr === 'my-day-list-drop-zone') {
      if (isTimeBlock) {
        const task = useTaskStore.getState().tasksById[activeTaskId];
        const prevStart = task?.scheduled_start_min;
        const prevDuration = task?.scheduled_duration_min;
        await useTaskStore.getState().unscheduleTask(activeTaskId);
        if (task && prevStart !== null && prevDuration !== null && prevStart !== undefined && prevDuration !== undefined) {
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

    // Dropping a time block anywhere outside returns to where it was (no-op)
    if (isTimeBlock) {
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
        // No-op: same group, same date, or invalid/overdue drop target
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
          onSelectTask={task => handleSelectTask(task)}
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
            data-detail={effectiveFocusMode || !isDetailVisible ? 'hidden' : 'visible'}
            data-dragging={isSchedulerDragging ? 'true' : 'false'}
            data-focus={effectiveFocusMode ? 'active' : 'inactive'}
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
              {isDetailVisible && (
                <div key={rightSlotActive} className={layoutStyles.rightSlotFade}>
                  {rightSlotActive === 'scheduler' && isMyDay && (
                    <Suspense fallback={<SchedulerSkeleton />}>
                      <SchedulerPanel />
                    </Suspense>
                  )}
                  {rightSlotActive === 'suggestions' && isMyDay && (
                    <SuggestionsSidebar
                      onClose={() => useTaskStore.getState().toggleSuggestions()}
                    />
                  )}
                  {rightSlotActive === 'detail' && liveSelectedTask && (
                    <DetailPanel
                      key={liveSelectedTask.id}
                      task={liveSelectedTask}
                      onClose={() => useTaskStore.getState().closeDetail()}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          {activeDragItem?.type === 'time-block' && activeDragItem.task && (
            <DragOverlay dropAnimation={null}>
              <TimeBlockDragOverlay
                task={activeDragItem.task}
                isOverGrid={isOverGrid}
                isInvalidDrop={!isOverGrid && !isOverList}
              />
            </DragOverlay>
          )}
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
