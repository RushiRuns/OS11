# OS11 — Reusable Utilities & Components Index

> **Rule:** Check this index before creating any new hook, component, domain function, or repository method.
> If an item is already listed here, consume it.
> If you build something reusable, you **must** register it here at the end of your session before committing.

---

## 1. Shared Hooks

*Check here before writing a new React hook.*

| Hook | File Path | Description | Scope / Notes |
|---|---|---|---|
| `useAppStore` | `src/renderer/stores/app-store.ts` | Global application UI state (theme, active view, active list, sidebar state) | Renderer global |
| `useTaskStore` | `src/renderer/stores/taskStore.ts` | Normalized Zustand task store (`tasksById: Record<string, Task>`) with optimistic mutations, rollback, and pagination | Renderer global |
| `useListStore` | `src/renderer/stores/listStore.ts` | Normalized Zustand list store (`listsById: Record<string, List>`) with smart list protection and folder grouping | Renderer global |
| `useModuleStore` | `src/renderer/stores/moduleStore.ts` | Feature module toggle store (`isEnabled(name)`) controlling view visibility | Renderer global |
| `useTask` | `src/renderer/stores/taskStore.ts` | Single task selector by ID for fine-grained subscription and zero-re-render cards | Component scope |
| `useTasksByList` | `src/renderer/stores/taskStore.ts` | Filtered, sorted task selector by list ID | Component scope |
| `useUndoRedo` | `src/renderer/hooks/useUndoRedo.ts` | Global undo/redo action stack (100 entries) with `Ctrl+Z` / `Ctrl+Y` and toast triggers | Renderer global |
| `useFilteredTasks` | `src/renderer/hooks/useFilteredTasks.ts` | Memoized task filtering (tags, priority, dates) and sorting (due date, priority, alphabetical, manual) | Component scope |
| `useKeyboardShortcuts` | `src/renderer/hooks/useKeyboardShortcuts.ts` | Global keydown listener wiring Feature Spec §5.2 hotkeys, Focus Mode, and Command Palette | Renderer global |
| `useVimMode` | `src/renderer/hooks/useVimMode.ts` | Modal navigation (`j/k`, `gg/G`, `dd`, `cc`, `ss`, `o`) gated by `vim_keybindings` module | Component scope |
| `useSearchStore` | `src/renderer/stores/searchStore.ts` | Zustand store for full-text search state, debounced queries, and results | Renderer global |
| `useSelectionStore` | `src/renderer/stores/selectionStore.ts` | Multi-select and contiguous range selection store (`selectedIds: Set<string>`) | Renderer global |
| `useTagStore` | `src/renderer/stores/tagStore.ts` | Normalized tag store (`tagsById: Record<string, Tag>`) with task associations, tree parser, and palette | Renderer global |
| `useNotificationStore` | `src/renderer/stores/notificationStore.ts` | In-app notification center store tracking history items, unread count, and drawer visibility | Renderer global |
| `useProjectStore` | `src/renderer/stores/projectStore.ts` | Normalized project management store (`projectsById`, `sectionsById`, `milestonesById`, `dependenciesByTaskId`) | Renderer global |
| `usePomodoroStore` | `src/renderer/stores/pomodoroStore.ts` | Zustand store for active focus session countdown, cycle progression, sound alerts, and tray/window sync | Renderer global |
| `useGoalStore` | `src/renderer/stores/goalStore.ts` | Normalized Zustand goal store (`goalsById`, `linksByGoalId`) with progress tracking and task-goal link management | Renderer global |
| `useAttachmentStore` | `src/renderer/stores/attachmentStore.ts` | Attachment counts and global attachment index store for task cards and command palette search | Renderer global |

---

## 2. Shared Components

*Check here before writing a new UI component. All components consume `tokens.css` CSS variables exclusively.*

| Component | File Path | Radix Primitive Wrapped? | Framer Motion Site? | Description |
|---|---|---|---|---|
| `Titlebar` | `src/renderer/components/Titlebar/Titlebar.tsx` | No | No (CSS transitions) | Custom frameless window titlebar with drag zone, window controls, and Always on Top pin |
| `Checkbox` | `src/renderer/components/Checkbox/Checkbox.tsx` | No | **Site #1 (Spring completion)** | Accessible task completion checkbox with 180ms spring bounce |
| `Button` | `src/renderer/components/Button/Button.tsx` | No | No (CSS transitions) | Base button with 3 semantic variants (`primary`, `ghost`, `danger`) and `sm` / `md` sizes |
| `Input` | `src/renderer/components/Input/Input.tsx` | No | No (CSS transitions) | Styled text input with error state, accent border, and focus ring |
| `Popover` | `src/renderer/components/Popover/Popover.tsx` | **Yes (`@radix-ui/react-popover`)** | No (CSS `opacity` + `scaleY`) | Floating picker overlay container with focus trap |
| `Toast` | `src/renderer/components/Toast/Toast.tsx` | No | No (CSS slide-up/down) | In-app notification toast with auto-dismiss and inline "Undo" action |
| `EmptyState` | `src/renderer/components/EmptyState/EmptyState.tsx` | No | No (Static) | Universal empty state with calm typography and optional CTA button |
| `LoadingSpinner` | `src/renderer/components/LoadingSpinner/LoadingSpinner.tsx` | No | No (CSS spin, reduced-motion static) | Accent-colored CSS spinner with reduced-motion static mode |
| `Tooltip` | `src/renderer/components/Tooltip/Tooltip.tsx` | **Yes (`@radix-ui/react-tooltip`)** | No (CSS fade-in) | Keyboard-shortcut hint tooltip with kbd badge |
| `QuickAdd` | `src/renderer/components/QuickAdd/QuickAdd.tsx` | No | **Site #4 (Scale & opacity)** | Instant task entry bar with spring scale/opacity appear/dismiss |
| `Sidebar` | `src/renderer/features/sidebar/Sidebar.tsx` | Uses native scroll | No (CSS transitions) | Fluid resizable navigation sidebar (180px–280px) with smart lists, user lists, and module filtering (critical initial bundle) |
| `ListItem` | `src/renderer/features/sidebar/ListItem.tsx` | No | No (CSS transitions) | `React.memo` sidebar list item with icon/color, zero-count suppressed badge, and context menu |
| `SmartListGroup` | `src/renderer/features/sidebar/SmartListGroup.tsx` | No | No (CSS transitions) | Collapsible smart lists drawer grouping My Day, Important, Planned, All Tasks, Completed |
| `TaskList` | `src/renderer/features/tasks/TaskList.tsx` | Uses `@tanstack/react-virtual` | **Site #3 (Reorder layoutId)** | Primary task stream with virtual scroll, keyboard navigation, and collapsible completed tasks (critical initial bundle) |
| `TaskListHeader` | `src/renderer/features/tasks/TaskListHeader.tsx` | No | No (CSS transitions) | Dynamic task list header with active task count and expandable filter/sort drawer |
| `TaskCard` | `src/renderer/features/tasks/TaskCard.tsx` | Uses `Checkbox` | **Site #1 (Spring completion)** | `React.memo` task card with 3 layers of progressive disclosure, priority pulse, and inline title editing |
| `DetailPanel` | `src/renderer/features/tasks/DetailPanel.tsx` | Uses `@tiptap/react` | **Site #2 (Spring slide-in)** | Task metadata/notes editor with DOMPurify sanitization, subtasks, and spring slide-in from right (critical initial bundle) |
| `MyDayView` | `src/renderer/features/lists/MyDayView.tsx` | Uses `TaskList` | No (CSS transitions) | My Day specialized view with formatted date header and intelligent "Add to My Day" suggestions |
| `RolloverPrompt` | `src/renderer/features/lists/RolloverPrompt.tsx` | No | Uses `framer-motion` | Morning rollover banner offering cherry-picking and bulk rollover of unfinished tasks |
| `CreateListModal` | `src/renderer/features/lists/CreateListModal.tsx` | **Yes (`@radix-ui/react-dialog`)** | No (CSS transitions) | Modal for creating and editing lists with emoji presets, color swatches, and background theming |
| `ListGroupModal` | `src/renderer/features/lists/ListGroupModal.tsx` | **Yes (`@radix-ui/react-dialog`)** | No (CSS transitions) | Modal for managing sidebar folder groups |
| `ListContextMenu` | `src/renderer/features/lists/ListContextMenu.tsx` | No | No (CSS transitions) | Floating context menu for renaming, duplicating, exporting, and deleting lists |
| `QuickAddBar` | `src/renderer/features/quickadd/QuickAddBar.tsx` | No | No (CSS transitions) | 52px height quick-add bar with 16px radius, `Ctrl+N` keyboard focus, and live NLP preview chip |
| `ParsePreviewChip` | `src/renderer/features/quickadd/ParsePreviewChip.tsx` | No | No (CSS transitions) | Badge chip row previewing extracted tags, list, priority, due date, pomodoro, recurrence |
| `OmnibarView` | `src/renderer/features/omnibar/OmnibarView.tsx` | No | No (CSS transitions) | Multi-mode Omnibar with Tab switching (Add Task, Search Tasks, Open List, Start Pomodoro) |
| `CommandPalette` | `src/renderer/features/command-palette/CommandPalette.tsx` | No | No (CSS transitions <150ms) | Spotlight overlay (`Ctrl+K`) with fuzzy filtering across Actions, Lists, Tasks, and Settings |
| `SearchView` | `src/renderer/features/search/SearchView.tsx` | No | No (CSS transitions) | Inline FTS5 search view with mark highlighted snippets and keyboard navigation |
| `TaskContextMenu` | `src/renderer/features/tasks/TaskContextMenu.tsx` | No | No (CSS transitions) | Floating context menu for tasks with complete, star, due date, priority, subtasks, duplication, and delete actions |
| `BulkActionBar` | `src/renderer/features/tasks/BulkActionBar.tsx` | No | **Site #4 (Scale & opacity slide-up)** | Floating toolbar for bulk completing, deleting, moving, priority setting, and My Day assignment |
| `DatePicker` | `src/renderer/components/DatePicker/DatePicker.tsx` | No | No (CSS transitions) | Compact inline date picker popover with natural language input, calendar grid, and time selectors |
| `TagPicker` | `src/renderer/features/tags/TagPicker.tsx` | No | No (CSS transitions) | Inline tag picker popover with fuzzy search, nested hierarchy tree, and 12-color token palette |
| `TagView` | `src/renderer/features/tags/TagView.tsx` | No | No (CSS transitions) | Cross-list tag filter view with colored header dot and active task count |
| `TagManager` | `src/renderer/features/tags/TagManager.tsx` | No | No (CSS transitions) | Settings management panel for editing, recoloring, merging tags, and configuring auto-tag rules |
| `NotificationCenter` | `src/renderer/features/notifications/NotificationCenter.tsx` | No | **Site #5 (Slide-in drawer from right)** | Slide-in notification center drawer grouped by date (Today, Yesterday, Earlier) with mark read and task focus |
| `ViewSwitcher` | `src/renderer/features/projects/ViewSwitcher.tsx` | No | **Site #6 (View crossfade < 200ms)** | Segmented switcher for toggling among List, Board, Timeline, Calendar, Table views |
| `ProjectListView` | `src/renderer/features/projects/ProjectListView.tsx` | No | No (CSS transitions) | Sectioned task list view with collapsible section blocks, inline add, and project activity feed |
| `ProjectBoardView` | `src/renderer/features/projects/ProjectBoardView.tsx` | No | **Site #7 (Kanban landing animation)** | Kanban board view with section columns, completion rings, and card drag-and-drop |
| `ProjectTimelineView` | `src/renderer/features/projects/ProjectTimelineView.tsx` | No | No (CSS transitions) | Gantt timeline view with zoom levels, dependency curves, diamond milestones, and drag reschedule |
| `ProjectCalendarView` | `src/renderer/features/projects/ProjectCalendarView.tsx` | No | No (CSS transitions) | Monthly calendar grid plotting tasks by due date with drag reschedule |
| `ProjectTableView` | `src/renderer/features/projects/ProjectTableView.tsx` | No | No (CSS transitions) | Spreadsheet table view with inline editing, resizable columns, column show/hide, and sorting |
| `RecurrencePicker` | `src/renderer/features/tasks/RecurrencePicker.tsx` | No | No (CSS transitions) | Recurrence rule modal with presets, custom interval/frequency builder, natural language preview, after-completion toggle, and skip occurrence |
| `ReminderEditor` | `src/renderer/features/tasks/ReminderEditor.tsx` | No | No (CSS transitions) | Multi-reminder editor in DetailPanel with presets (at due, 1h before, 1d before), custom picker, and delete controls |
| `ProgressBar` | `src/renderer/components/ProgressBar/ProgressBar.tsx` | No | No (CSS transitions) | Dynamic progress bar with `thin` (4px) and `standard` (8px) heights and semantic tokenized fills (`primary`, `success`, `warning`) |
| `Agenda` | `src/renderer/features/agenda/Agenda.tsx` | No | No (CSS transitions) | Lazy-loaded top-level view with 4-tab segmented switcher (`Daily Agenda`, `Weekly Agenda`, `Goals`, `Habits`) |
| `DailyAgenda` | `src/renderer/features/agenda/DailyAgenda.tsx` | No | No (CSS transitions) | Daily timeline view (8 AM – 9 PM) with overdue task pinning, time-block slots, drag rescheduling, and load balancing indicator |
| `WeeklyAgenda` | `src/renderer/features/agenda/WeeklyAgenda.tsx` | No | No (CSS transitions) | 7-day horizontal scrollable column view with calendar event overlays, load balancing, and cross-day drag-rescheduling |
| `GoalsView` | `src/renderer/features/agenda/GoalsView.tsx` | Uses `ProgressBar` | No (CSS transitions) | Goals dashboard with type categorization (Habit, Milestone, Outcome), progress bars, streak flame counters, and Friday check-in banner |
| `HabitTracker` | `src/renderer/features/agenda/HabitTracker.tsx` | No | No (CSS transitions) | 52-week × 7-day GitHub-style completion heatmap with 5 tokenized intensity levels and interactive habit chain check-off cards |
| `Dashboard` | `src/renderer/features/dashboard/Dashboard.tsx` | No | No (CSS transitions) | Performance metrics dashboard with 4 hero cards, date range selector, PDF/CSV exports, and 5 Recharts visualizations |
| `CompletionBarChart` | `src/renderer/features/dashboard/charts/CompletionBarChart.tsx` | No | No (CSS transitions) | Recharts bar chart showing daily task completions across date range |
| `TaskDistributionPie` | `src/renderer/features/dashboard/charts/TaskDistributionPie.tsx` | No | No (CSS transitions) | Recharts donut chart with segmented switcher for list, tag, and priority breakdowns |
| `CompletionTrend` | `src/renderer/features/dashboard/charts/CompletionTrend.tsx` | No | No (CSS transitions) | Recharts line chart showing daily and overall on-time completion rates with 100% target reference line |
| `ActivityHeatmap` | `src/renderer/features/dashboard/charts/ActivityHeatmap.tsx` | No | No (CSS transitions) | 52-week full-year GitHub-style activity grid with interactive completion hover tooltips |
| `ProjectBurndown` | `src/renderer/features/dashboard/charts/ProjectBurndown.tsx` | No | No (CSS transitions) | Project velocity metrics and remaining vs ideal burndown trajectory chart |
| `AttachmentStrip` | `src/renderer/features/attachments/AttachmentStrip.tsx` | No | No (CSS transitions) | Horizontal attachment strip with image viewer lightbox, PDF/link click-to-open, file picker, and drag & drop |

### Permitted Framer Motion Sites (Strict ADR-0009 Rule)
1. **Checkbox completion:** `scale(1) → scale(1.2) → scale(1)` in 180ms via `--ease-spring`.
2. **Detail panel open/close:** Spring slide-in from right (`x: 40 → 0`).
3. **Task list reorder:** `layoutId` layout animation during drag-and-drop.
4. **Quick-add bar appear/dismiss:** Scale (`0.96 → 1`) and opacity (`0 → 1`).
5. **Notification center drawer:** Slide-in from right (`x: 360 → 0`) in < 180ms.
6. **Project view crossfade:** Crossfade transition between the 5 project views in < 200ms.
7. **Project Kanban card landing:** Subtle scale/fade landing animation on dropped Kanban cards.
*All other UI animations and transitions use pure CSS.*

---

## 3. Domain Functions (Pure Functions — No I/O, No IPC, No DB)

*Check here before writing new business logic. All domain logic is pure and deterministic.*

| Function | File Path | Description |
|---|---|---|
| `validateCreate` / `validateUpdate` | `src/main/domain/task-validation.ts` | Validates task creation/update payloads (title required, max 500 chars, priority 0-4, valid dates/RRULE) |
| `buildNewTask` | `src/main/domain/task.ts` | Factory for default task entity with UUID and timestamp generation |
| `isValidRRule` | `src/main/domain/recurrence.ts` | Validates RFC 5545 recurrence rule strings |
| `nextOccurrence` | `src/main/domain/recurrence.ts` | Calculates next Date after reference date using `rrule` |
| `humanReadableRRule` | `src/main/domain/recurrence.ts` | Converts RRULE string to human-friendly text (e.g., "every day") |
| `expandOccurrences` | `src/main/domain/recurrence.ts` | Expands all occurrences between two dates for calendar/agenda |
| `parseQuickAdd` | `src/main/domain/nlp.ts` | Chrono + regex NLP parser: extracts clean title, `#tag`, `@list`, `!priority`, `🍅`, and natural date/time |
| `between` / `atStart` / `atEnd` | `src/main/domain/fractional-index.ts` | Fractional indexing math for reordering items |
| `wouldCreateCycle` | `src/main/domain/dependency-check.ts` | Graph cycle detection preventing cyclic task dependencies |

---

## 4. Shared Utilities (`src/shared/utils/`)

*Pure utility helpers shared across Main, Worker, and Renderer processes.*

| Function | File Path | Description |
|---|---|---|
| `toISODate` | `src/shared/utils/date.ts` | Formats Date object strictly as `YYYY-MM-DD` |
| `toISODateTime` | `src/shared/utils/date.ts` | Formats Date object as ISO-8601 string |
| `formatForDisplay` | `src/shared/utils/date.ts` | Formats date for display: "Today", "Tomorrow", "Mon, Jan 6", etc. |
| `isOverdue` | `src/shared/utils/date.ts` | Compares date against current timestamp/day boundary |
| `generateUUID` | `src/shared/utils/uuid.ts` | Generates RFC-compliant UUID v4 |
| `isValidUUID` | `src/shared/utils/uuid.ts` | Validates whether string is UUID v4 |
| `clamp` | `src/shared/utils/index.ts` | Clamps number between min and max bounds |
| `isValidIsoDate` | `src/shared/utils/index.ts` | Checks if string is valid ISO timestamp |
| `between` / `atStart` / `atEnd` | `src/shared/utils/fractional-index.ts` | Fractional index math for arbitrary list reordering |
| `isValidRRule` / `humanReadableRRule` | `src/shared/utils/recurrence.ts` | RFC 5545 validation and natural language translation for recurring schedules |
| `buildCustomRRule` | `src/shared/utils/recurrence.ts` | Builds custom recurrence rules from frequency, interval, and weekday array |
| `calculateNextOccurrence` | `src/shared/utils/recurrence.ts` | Calculates next occurrence for fixed (due_date) vs after-completion recurrence basis |

---

## 5. Repository Layer (`src/main/repositories/`)

*All SQLite queries reside exclusively in this directory per ARCHITECTURE.md Rule 2.*

| Repository | File Path | Key Methods |
|---|---|---|
| `BaseRepository` | `src/main/repositories/base-repository.ts` | Base class connecting to singleton `db` or custom test database |
| `TaskRepository` | `src/main/repositories/TaskRepository.ts` | `getByListId`, `getFirst50`, `getByProjectId`, `getById`, `getSubtasks`, `getMyDay`, `getImportant`, `getPlanned`, `getAllTasks`, `getCompleted`, `getTrashed`, `create`, `update`, `complete`, `uncomplete`, `star`, `unstar`, `trash`, `restore`, `permanentDelete`, `addToMyDay`, `removeFromMyDay`, `updateSortOrder` |
| `ListRepository` | `src/main/repositories/ListRepository.ts` | `getAll`, `getById`, `create`, `update`, `delete`, `reorder` |
| `ListGroupRepository` | `src/main/repositories/ListGroupRepository.ts` | `getAll`, `getById`, `create`, `update`, `delete`, `reorder` |
| `ProjectRepository` | `src/main/repositories/ProjectRepository.ts` | `getAll`, `getById`, `create`, `update`, `archive`, `delete` |
| `SectionRepository` | `src/main/repositories/SectionRepository.ts` | `getByProjectId`, `create`, `update`, `delete`, `reorder` |
| `TagRepository` | `src/main/repositories/TagRepository.ts` | `getAll`, `create`, `update`, `delete`, `getTagsForTask`, `addTagToTask`, `removeTagFromTask`, `getTasksForTag` |
| `ReminderRepository` | `src/main/repositories/ReminderRepository.ts` | `getUpcomingAndOverdue`, `getByTaskId`, `create`, `markTriggered`, `snooze`, `deleteByTaskId`, `delete` |
| `AttachmentRepository` | `src/main/repositories/AttachmentRepository.ts` | `getByTaskId`, `getById`, `create`, `delete` |
| `PomodoroRepository` | `src/main/repositories/PomodoroRepository.ts` | `create`, `complete`, `getByTaskId`, `getStats` |
| `GoalRepository` | `src/main/repositories/GoalRepository.ts` | `getAll`, `create`, `update`, `delete`, `addLink`, `removeLink`, `getLinks` |
| `SettingsRepository` | `src/main/repositories/SettingsRepository.ts` | `get(key, default?)`, `set(key, val)`, `getAll()` (JSON encoded) |
| `ModuleRepository` | `src/main/repositories/ModuleRepository.ts` | `getAll`, `isEnabled(name)`, `toggle(name, enabled)` |
| `NotificationRepository` | `src/main/repositories/NotificationRepository.ts` | `add`, `getAll`, `markRead`, `markAllRead` |
| `IdentityRepository` | `src/main/repositories/IdentityRepository.ts` | `get`, `create`, `updateDisplayName` |
| `SearchRepository` | `src/main/repositories/SearchRepository.ts` | `search(query)` via FTS5 full-text virtual table with snippets |

---

## 6. Service Layer (`src/main/services/`)

*All business logic, multi-repository coordination, and cross-cutting concerns reside here per ARCHITECTURE.md Rule 2.*

| Service | File Path | Key Methods / Responsibilities |
|---|---|---|
| `TaskService` | `src/main/services/task/TaskService.ts` | Validates payloads, local identity author tagging, RRULE auto-generation on complete, cycle detection on subtasks, reminder cancellation on trash, fractional indexing |
| `ListService` | `src/main/services/list/ListService.ts` | List CRUD, smart list protection (`is_smart === 1` cannot be deleted), atomic batch reorder |
| `ProjectService` | `src/main/services/project/ProjectService.ts` | Project CRUD, archive status transition |
| `TagService` | `src/main/services/tag/TagService.ts` | Tag CRUD, task-tag associations |
| `ReminderService` | `src/main/services/reminder/ReminderService.ts` | Node.js `setTimeout` scheduler, `processOverdueAtStartup()`, `rescheduleAfterSleep()`, `snooze`, `snoozePreset` (15m, 1h, tomorrow 8am), `getByTaskId`, `delete`, `cancel` |
| `NotificationService` | `src/main/services/notification/NotificationService.ts` | Native desktop `Notification` dispatch with actionable buttons (Complete, Snooze 15m, Snooze 1h, Tomorrow 8am), persistent `notification_history` |
| `CalendarService` | `src/main/services/calendar/CalendarService.ts` | Multi-provider calendar sync (Google OAuth2 local loopback, Apple CalDAV, Outlook Microsoft Graph), two-way sync with tasks (`syncTaskToCalendar`) |
| `PomodoroService` | `src/main/services/pomodoro/PomodoroService.ts` | Session lifecycle management, task pomodoro count incrementing, OS focus mode notifications, and tray/window synchronization |
| `SettingsService` | `src/main/services/settings/SettingsService.ts` | Preference key-value store, `applyTheme`, `applyAccentColor`, `applyLoginItem` |
| `WorkerManager` | `src/main/services/worker-manager.ts` | Manages Node `worker_threads` instance with correlation IDs, timeouts, and seamless main-thread fallback |
| `AnalyticsService` | `src/main/services/analytics/AnalyticsService.ts` | Stats aggregation (completed count, streak, on-time rate %, focus minutes, peak day/hour, burndown velocity), PDF print, and RFC 4180 CSV serialization |
| `AttachmentService` | `src/main/services/attachment/AttachmentService.ts` | Local file uploads, filename sanitization, nativeImage thumbnail generation, cloud storage links, atomic deletion, and batch export |

---

## 7. Client IPC Adapter (`src/renderer/services/`)

*Type-safe bridge between Renderer Zustand stores and Main Process IPC.*

| Module | File Path | Description |
|---|---|---|
| `ipc` | `src/renderer/services/ipc.ts` | `invoke<T>(channel, payload)` (unwraps `{ ok: true, data }` or throws), `invokeRaw<T>`, and `on(channel, handler)` |
| `TaskServiceAdapter` | `src/renderer/services/task-service-adapter.ts` | Typed task operations routed through `ipc.invoke` |
| `SettingsServiceAdapter` | `src/renderer/services/settings-service-adapter.ts` | Typed settings operations routed through `ipc.invoke` |

---

## 8. Window & System Shell Infrastructure (`src/main/window/`, `src/main/tray/`, `src/main/shortcuts.ts`)

*System shell components, window lifecycle managers, and OS-level integration.*

| Module | File Path | Key Functions / Responsibilities |
|---|---|---|
| `MainWindow` | `src/main/window/main-window.ts` | `createMainWindow()`, `showMainWindow()`, `hideMainWindow()`, `toggleMainWindow()`, `setAlwaysOnTop()`, `focusQuickAdd()` — hidden on create, intercepts close event to hide to tray |
| `SplashWindow` | `src/main/window/splash-window.ts` | `createSplashWindow()`, `destroySplashWindow()`, `resolveSplashHtmlPath()` — zero-JS cold start coverage |
| `OmnibarWindow` | `src/main/window/omnibar-window.ts` | `createOmnibarWindow()`, `showOmnibarWindow()`, `hideOmnibarWindow()`, `toggleOmnibarWindow()` — centered, blur-to-hide |
| `TimerWindow` | `src/main/window/timer-window.ts` | `createTimerWindow()`, `showTimerWindow()`, `hideTimerWindow()`, `getTimerWindow()` — floating, always-on-top, draggable mini-timer window |
| `TrayManager` | `src/main/tray/tray.ts` | `initTray()`, `updateTrayBadge(count, pomodoro)`, `updateTrayPomodoroState()`, `destroyTray()` — in-memory SVG badge, countdown text, and dynamic context menu |
| `GlobalShortcuts` | `src/main/shortcuts.ts` | `registerGlobalShortcuts()`, `unregisterGlobalShortcuts()` — OS global hotkeys (`Ctrl+Shift+Space`, `Ctrl+Space`, `Ctrl+N`, `Ctrl+Shift+H`, `Ctrl+Shift+T`) |
| `AutoUpdater` | `src/main/services/updater.ts` | `initAutoUpdater()`, `checkForUpdates()` — background non-blocking updates via `electron-updater` |

---

## 9. Do NOT Create a Duplicate Of

*The following items must exist ONLY ONCE in the codebase:*

1. **Design Tokens:** `src/renderer/styles/tokens.css` (never create alternate token files or hardcoded hex/rgba values).
2. **IPC Channel Registry:** `IPC_CHANNELS.md` and `src/shared/ipc-channels.ts` (never invent ad-hoc string channel names).
3. **Database Connection:** `src/main/repositories/db.ts` / `src/main/database.ts` (only one `better-sqlite3` instance exists in the main process).
4. **Database Migration Runner:** `src/main/migrations/runner.ts` (tracks `PRAGMA user_version` and executes sequentially in transactions).
5. **Main Window Lifecycle Manager:** `src/main/window/main-window.ts` (sole owner of `BrowserWindow` creation, state, and sizing).
6. **Splash Window Lifecycle Manager:** `src/main/window/splash-window.ts` (sole owner of cold-start splash coverage).
7. **Omnibar Window Lifecycle Manager:** `src/main/window/omnibar-window.ts` (sole owner of quick-capture omnibar window).
8. **System Tray Lifecycle Manager:** `src/main/tray/tray.ts` (sole owner of tray icon and badge rendering).
9. **IPC Dispatch Registry:** `src/main/ipc/index.ts` (all `ipcMain.handle` registrations route here).
10. **Portal Root:** `<div id="radix-portal"></div>` in `index.html` (single target for Radix portals).
11. **Preload Script Bridge:** `src/main/window/preload.ts` (exposes only `window.electron.invoke` and `window.electron.on`).
12. **Worker Thread Entry:** `src/worker/worker-main.ts` (handles heavy background jobs off the main loop).
