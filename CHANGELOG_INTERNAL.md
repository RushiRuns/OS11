# OS11 — Internal Engineering Changelog

> **Format:** `[YYYY-MM-DD] — [what was built] — [what changed architecturally]`
> **Rule:** Updated at the end of every coding session before committing.

### [2026-09-14] — Phase 12 complete: Pomodoro timer, mini window, tray countdown, session tracking, distraction blocker
- **What was built:**
  - `src/renderer/stores/pomodoroStore.ts`: Zustand store managing `activeSession`, `sessionCount` in cycle, `settings` (work, break, long break durations, cycle length, sound alerts, autoStart, DND), 1s interval ticker, completion transitions, automatic long break trigger after cycle limit, and bidirectional IPC sync with main process.
  - `src/renderer/features/pomodoro/PomodoroView.tsx` + `PomodoroView.module.css`:
    - Circular SVG progress ring with smooth countdown stroke animations.
    - Linked task display and quick selector; `@dnd-kit` droppable area (`useDroppable`) and HTML5 drag & drop support to link tasks onto the timer.
    - Timer controls: Start, Pause, Resume, Skip, and Reset.
    - Cycle dots showing progress toward long break.
    - Sound alert picker with built-in synthesized audio tones (`chime`, `bell`, `digital`, `calm`, `none`) and preview tester.
    - Full-screen distraction-free Focus Mode toggle and mini window launcher.
    - Today's focus statistics cards (completed intervals, total focus time).
  - `src/renderer/utils/audio.ts`: Offline Web Audio API tone synthesizer generating clean harmonic chimes, bells, and gentle alert tones without requiring external audio assets.
  - `src/main/window/timer-window.ts`: Frameless, always-on-top, draggable floating mini timer window (`220x76`) showing `🍅`, countdown time, and pause/skip/reset controls, accessible via `#mini-timer` window route.
  - `src/renderer/features/pomodoro/MiniTimerView.tsx` + `MiniTimerView.module.css`: Dedicated lightweight view rendered in the floating timer window.
  - `src/main/tray/tray.ts`: Dynamic tray integration updating tooltip and icon with session countdown (`🍅 18:45`), dynamic tray context menu items (Pause, Resume, Skip, Reset), and SVG circular progress ring icon generation.
  - `src/main/services/pomodoro/PomodoroService.ts`: Central orchestration service managing session persistence in SQLite `pomodoro_sessions`, automatic task `pomodoro_count` incrementation on completion, Do Not Disturb focus notification alerts, and tray/window synchronization.
  - `src/main/ipc/pomodoro-handlers.ts`: Full IPC handlers for start, stop, today stats, session history, sync state, show/hide mini window, and remote actions forwarding.
  - Unit and integration test suite `tests/services/pomodoro.test.ts` (23 test files, 130 tests passing).
- **What changed architecturally:**
  - Added Pomodoro IPC channels (`POMODORO.START`, `STOP`, `GET_TODAY_STATS`, `GET_SESSIONS`, `SYNC_STATE`, `SHOW_MINI_WINDOW`, `HIDE_MINI_WINDOW`, `ACTION`) and `TASKS.INCREMENT_POMODORO`.
  - Configured Vite `manualChunks` to bundle Pomodoro view into an independent lazy-loaded chunk (`dist/assets/pomodoro-*.js`).
  - Added `#mini-timer` routing branch in `App.tsx` matching the architecture of `#omnibar`.
  - Bi-directional IPC sync between renderer timer store and main process Tray + Mini Window.

---

### [2026-09-14] — Phase 11 complete: Recurrence fully wired, reminder scheduling with snooze, calendar integration
- **What was built:**
  - `src/shared/utils/recurrence.ts`: Pure recurrence utilities (`isValidRRule`, `nextOccurrence`, `humanReadableRRule`, `expandOccurrences`, `buildCustomRRule`, `calculateNextOccurrence`) shared cleanly across main and renderer without layer boundary violations.
  - `RecurrencePicker.tsx` + `.module.css`: Full recurrence modal with presets (Daily, Weekdays, Weekly, Monthly, Yearly), custom interval + frequency + weekday selector builder, real-time natural language rule preview via `humanReadableRRule()`, "After completion" toggle (`recurrence_basis = 'after_completion'`), and "Skip occurrence" action.
  - `TaskService.complete()`: Enhanced to handle both fixed recurrence (expansion from `due_date`) and after-completion recurrence (calculated from completion date + interval). Copies all parent properties while resetting `is_completed = 0`, `completed_at = null`, `my_day_date = null`, and `pomodoro_count = 0`. Supports `skipRecurrence` option to complete without next instance generation.
  - `ReminderEditor.tsx` + `.module.css`: Multi-reminder management in `DetailPanel.tsx` with quick presets ("At due time", "1 hour before", "1 day before"), custom date and time picker, and list of upcoming scheduled reminders with delete controls.
  - `ReminderService`: Added `getByTaskId`, `delete`, and `snoozePreset` with actionable snooze presets (15m, 1h, tomorrow 8:00 AM). `NotificationService` updated with actionable OS notification buttons for Complete and Snooze.
  - `CalendarService.ts` & `calendar-handlers.ts`: Optional calendar integration module gated by `moduleStore.isEnabled('calendar_integration')`:
    - Google Calendar: OAuth2 local loopback redirect protocol and raw REST API endpoint handler.
    - Apple Calendar: CalDAV protocol handler.
    - Outlook: Microsoft Graph API via local OAuth2 redirect.
    - Two-way sync: `syncTaskToCalendar()` generates external calendar event from task's `due_date` + `due_time` + `estimated_minutes`.
  - `Agenda.tsx` + `.module.css`: Daily chronological hourly timeline view displaying scheduled tasks alongside external calendar events, day navigation, and "Sync to Calendar" action.
  - `Settings.tsx`: Added Calendar Integration module card with toggle and provider connection cards (Google, Apple, Outlook).
  - Unit and integration test suite `tests/services/recurrence-and-reminders.test.ts` (22 test files, 123 tests passing).
- **What changed architecturally:**
  - Pure recurrence engine extracted to `src/shared/utils/recurrence.ts` so renderer UI components can calculate previews without IPC hops or main process dependencies.
  - Re-exported from `src/main/domain/recurrence.ts` for backward compatibility with existing domain tests.
  - IPC contract expanded with `TASKS.COMPLETE`, `REMINDERS.GET_BY_TASK`, `REMINDERS.DELETE`, and `CALENDAR.*` channel group.
  - `calendar_integration` added to `ModuleName` union and `moduleStore` defaults (`false` by default).
  - `Agenda` component split into its own lazy chunk (`dist/assets/agenda-*.js` and CSS).

---

### [2026-09-14] — Phase 10 complete: Full project management — 5 views, dependencies, milestones, templates, export
- **What was built:**
  - `projectStore.ts`: Normalized Zustand store (`projectsById: Record<string, Project>`, `sectionsById: Record<string, Section>`, `milestonesById: Record<string, Milestone>`, `dependenciesByTaskId: Record<string, string[]>`) with optimistic updates, project archiving, section reordering, milestone lifecycle management, dependency tracking, and template import.
  - Five distinct view modes in `src/renderer/features/projects/`:
    - `ProjectListView.tsx` + `.module.css`: Tasks grouped by section with collapsible headers, inline add with Enter, `@dnd-kit` drag-and-drop between sections, and activity feed audit log.
    - `ProjectBoardView.tsx` + `.module.css`: Kanban view with section columns, column completion rings, `@dnd-kit` card drag-and-drop, and Framer Motion landing animation (Site #7).
    - `ProjectTimelineView.tsx` + `.module.css`: Gantt timeline view with Day/Week/Month/Quarter zoom controls, horizontal task bars with drag reschedule, diamond milestone markers, today indicator line, and SVG bezier dependency overlay curves.
    - `ProjectCalendarView.tsx` + `.module.css`: Monthly calendar grid plotting tasks by due date with date navigation, today highlighting, and drag-and-drop date rescheduling.
    - `ProjectTableView.tsx` + `.module.css`: Spreadsheet table view with inline editing for title/date/priority/time/section, column resizing, column show/hide picker, and header click sorting.
  - `ViewSwitcher.tsx` + `.module.css`: Segmented tabs for the 5 views with persistence to `projects.default_view` and Framer Motion crossfade (< 200ms, Site #6).
  - `ProjectHeader.tsx` + `.module.css`: Project metadata, SVG completion progress ring (% tasks completed), task statistics (total, completed, overdue), and quick actions.
  - `MilestonesModal.tsx` + `.module.css`: Modal to create, toggle completion, view, and delete project milestones with diamond badges.
  - `TemplateModal.tsx` + `.module.css`: Project template exporter (extracting structure and placeholder tasks without dates/completion) and template importer.
  - `projectExport.ts`: Multi-format export utilities for CSV (spreadsheet), Markdown (outline), and PDF (`webContents.printToPDF()`).
  - `DetailPanel.tsx` Task Dependencies: Added "Depends on" section with cycle detection preventing circular dependencies via `wouldCreateCycle`.
  - Backend and IPC: `MilestoneRepository`, `DependencyRepository`, `MilestoneService`, `DependencyService` (with cycle checking), and IPC channels for `MILESTONES.*`, `DEPENDENCIES.*`, `PROJECTS.ARCHIVE`, `PROJECTS.GET_ACTIVITY`, `PROJECTS.EXPORT_PDF`.
  - Unit test suite `tests/domain/project-management.test.ts` (21 test files, 109 tests passing).
- **What changed architecturally:**
  - Expanded IPC contract with `MILESTONES` and `DEPENDENCIES` channel groups adhering to layer boundary rules.
  - Circular dependency prevention enforced in `DependencyService` domain layer using BFS graph traversal.
  - Registered Sites #6 (view crossfade) and #7 (Kanban landing) in ADR-0009 permitted Framer Motion sites.
  - Projects isolated into its own lazy chunk (`dist/assets/projects-*.js`) via Vite `manualChunks`.

---

### [2026-09-13] — Phase 9 complete: Full tag system (nested, merge, auto-tag), notification center
- **What was built:**
  - `tagStore.ts`: Normalized Zustand store (`tagsById: Record<string, Tag>`) with task-tag association mappings (`taskTagsByTaskId`), optimistic CRUD, lazy loading, and hierarchical tag tree parser (`buildTagTree`) supporting slash-delimited paths (`work/client/Acme`) and parent IDs.
  - `TagPicker.tsx` + `.module.css`: Compact inline popover with fuzzy tag filtering, nested tree display, inline creation with 12 curated token colors (`--tag-blue` to `--tag-gray`), and keyboard navigation (`Escape`, `ArrowUp/Down`, `Enter`).
  - `TagView.tsx` + `.module.css`: Cross-list tag filter view displaying tag color dot, tag name, task count, and task card collection.
  - `TagManager.tsx` + `.module.css` in Settings: Full management interface with inline renaming, color cycling through the 12-token palette, parent tag selector, tag merge tool, and list-based auto-tag rule configuration.
  - FEEL UI Priority Display: Strictly left border color only (2.5px), pulsing animation for critical priority with `@media (prefers-reduced-motion: reduce)` fallback, and red due date chip (`var(--color-danger)`) for overdue + high/critical tasks.
  - `NotificationCenter.tsx` + `.module.css`: Framer Motion slide-in drawer from the right (<180ms per ADR-0009), date grouping ("Today", "Yesterday", "Earlier"), unread indicator dot, mark read on click with task focus navigation, and "Mark All Read" / "Clear" actions.
  - `Titlebar.tsx` + `.module.css`: Added notification bell button with dynamic unread count pill badge.
  - IPC and backend support: Added channels and handlers for `tags:get-for-task`, `tags:add-to-task`, `tags:remove-from-task`, `tags:get-tasks-for-tag`, `tags:merge`, `notifications:mark-read`, and `notifications:mark-all-read`.
  - Auto-tagging rules: `TaskService.create()` automatically queries `auto_tag_rules` from Settings and attaches configured tags to newly created tasks.
  - Unit test suite `tests/domain/tags-and-notifications.test.ts` (20 test files, 105 tests passing).
- **What changed architecturally:**
  - IPC contract expanded in `src/shared/ipc-channels.ts` and documented in `IPC_CHANNELS.md` without violating renderer/main boundary isolation.
  - Tag merging executes in an atomic SQLite transaction in `TagRepository.ts`, deduplicating task-tag links and cleaning up the source tag.
  - Registered Site #5 in ADR-0009 permitted Framer Motion sites for the Notification Center drawer slide-in.

---

### [2026-09-13] — Phase 8 complete: All drag-and-drop targets, context menu, multi-select, bulk operations, inline date picker
- **What was built:**
  - `@dnd-kit/core` & `@dnd-kit/sortable` integration in `TaskList.tsx` with `PointerSensor` (distance constraint `8px`) and `KeyboardSensor`.
  - Reordering within task lists using `between(prev, next)` fractional indexing math, calling `reorderTask()` with full undo/redo action recording.
  - Sidebar task drop targets: dropping tasks onto sidebar user lists or "My Day" updates list assignment or sets `my_day_date` to today.
  - Native file drag-and-drop on task cards with visual dashed outline highlight.
  - Floating `TaskContextMenu.tsx` + `.module.css`: right-click on any task card provides Complete, Star, Set Due Date, Set Priority (0-4), Add to My Day, Move to List, Duplicate, Create Subtask, Open Details, and Delete with undo toast.
  - Multi-select system:
    - `selectionStore.ts`: tracks `selectedIds: Set<string>`, `isMultiSelectActive: boolean`, `toggleSelect`, `selectRange`, `selectAll`, `clearSelection`.
    - TaskCard multi-select checkboxes: reveal on hover or persist when multi-select is active; support `Ctrl+Click` and `Shift+Click` contiguous range selection; `Ctrl+A` hotkey selects all tasks in the active view.
    - `BulkActionBar.tsx` + `.module.css`: Framer Motion animated floating toolbar with count badge and bulk actions for Complete, Delete (single batched undo toast), Move to List, Set Priority, and Add to My Day; dismisses with `Escape`.
  - Inline compact `DatePicker.tsx` + `.module.css`: popover with natural language input (`chrono-node` parser), quick option chips (Today, Tomorrow, Next Week, No Date), month calendar grid, 15-minute time selector, and immediate close on date selection per FEEL UI principles.
  - Unit tests in `tests/domain/dnd-and-multiselect.test.ts` (19 test files, 100 tests passing).
- **What changed architecturally:**
  - Migrated fractional indexing calculations to `src/shared/utils/fractional-index.ts` so both renderer and main processes can compute midpoint reorder positions without architectural layer boundary violations.
  - `@dnd-kit` manages pointer physics and drag detection exclusively, leaving animation transitions to CSS and Framer Motion per ADR-0009.

---

### [2026-09-13] — Phase 7 complete: Quick Add, Omnibar, NLP parsing, all keyboard shortcuts, command palette, search
- **What was built:**
  - `QuickAddBar.tsx` + `.module.css`: Always-accessible 52px task creation bar with 16px border-radius, `Ctrl+N`/`Cmd+N` focus listener, debounced NLP parsing, and live badge preview chips.
  - `ParsePreviewChip.tsx` + `.module.css`: Dynamic chip renderer visually previewing extracted `@list`, `#tags`, `!priority`, `📅 date/time`, `🔁 recurrence`, and `🍅 Pomodoro` indicators.
  - Enhanced multi-mode `OmnibarView.tsx` + `.module.css`: Warm-start floating bar with Tab-based switching across 4 modes: 'Add Task', 'Search Tasks', 'Open List', and 'Start Pomodoro'.
  - IPC NLP parsing handler (`IPC.NLP.PARSE` in `src/main/ipc/nlp-handlers.ts`) connected to `parseQuickAdd()` in `src/main/domain/nlp.ts` supporting tags, lists, priorities, Pomodoro emoji, natural language dates via Chrono, and recurrence rules.
  - Global in-app keyboard shortcuts (`src/renderer/hooks/useKeyboardShortcuts.ts`): Implemented all bindings from Feature Spec §5.2 (`↑/↓`, `Space`, `Enter/F2`, `Delete`, `Ctrl+I`, `Tab`, `Shift+Tab`, `Ctrl+Shift+M`, `Ctrl+D`, `Ctrl+T`, `Ctrl+F`, `Ctrl+1..9`, `Ctrl+P`, `Ctrl+Shift+D`, `Ctrl+K`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+L`, `Ctrl+Shift+T`, `Ctrl+Shift+F`).
  - Optional Vim mode hook (`src/renderer/hooks/useVimMode.ts`) gated by `moduleStore.isEnabled('vim_keybindings')` (`j/k`, `gg/G`, `dd`, `cc`, `ss`, `o`).
  - Spotlight Command Palette (`src/renderer/features/command-palette/CommandPalette.tsx` + `.module.css`): Centered modal overlay triggered by `Ctrl+K` with fuzzy filtering across Actions, Lists, Tasks, and Settings, and animated transition < 150ms.
  - Full-Text Search integration: `searchStore.ts` and `SearchView.tsx` + `.module.css` triggered via `Ctrl+F` or `/`, querying worker thread SQLite FTS5 table and rendering `<mark>` highlighted snippet matches.
  - Focus Mode (`Ctrl+Shift+F`) layout support in `App.tsx` and `layout.module.css` hiding both sidebar and detail columns.
  - Unit test suites in `tests/domain/nlp-ipc.test.ts` and `tests/domain/search-store.test.ts` (18 test suites and 93 tests passing).
- **What changed architecturally:**
  - Created `@shared/types/nlp.ts` and `@shared/types/search.ts` adhering to strict layer boundary rules (renderer does not import from main).
  - Quick-add parsing runs debounced over IPC asynchronously, ensuring zero UI input lag.
  - Natural language date parsing cleans trailing date prepositions (by, due, on, until) when extracting dates from task titles.

---

### [2026-09-13] — Phase 6 complete: Lists, smart lists, sidebar, My Day, rollover prompt
- **What was built:**
  - Normalized Zustand list store (`src/renderer/stores/listStore.ts`) with `listsById: Record<string, List>`, `orderedIds: string[]`, `listGroupsById`, built-in smart list protection (`is_smart === 1`), optimistic mutations with rollback snapshots, and folder grouping.
  - Reactive feature module toggle store (`src/renderer/stores/moduleStore.ts`) controlling on-demand visibility of optional views.
  - Complete sidebar redesign (`src/renderer/features/sidebar/Sidebar.tsx` + `.module.css`):
    - Smooth draggable resizer with width bounds (180px–280px).
    - `ListItem.tsx` (`React.memo`) with custom icon/color, zero-count suppressed badge (FEEL UI), and right-click context menu.
    - `SmartListGroup.tsx` collapsible smart lists drawer (collapsed by default).
    - User list sections with drag-and-drop reordering.
    - Views section strictly omitting disabled modules.
    - Bottom action bar with "+" buttons for lists and folder groups.
  - List management modals:
    - `CreateListModal.tsx`: name, emoji presets, accent color swatches, background theming (solid/gradient/image), and folder assignment.
    - `ListGroupModal.tsx`: folder group creation and management.
    - `ListContextMenu.tsx`: floating portal menu for renaming, duplicating, exporting, and deleting lists.
  - My Day experience:
    - `MyDayView.tsx`: formatted date header, quote/greeting, and intelligent "Add to My Day" recommendation drawer surfacing overdue/today/high-priority tasks.
    - `RolloverPrompt.tsx`: Framer Motion slide-up banner triggered on day start for incomplete yesterday tasks with "Keep All in Today", "Dismiss All", and selective cherry-picking.
  - IPC enhancements: added `TASKS.GET_MY_DAY`, `TASKS.GET_IMPORTANT`, `TASKS.GET_PLANNED`, `TASKS.GET_COMPLETED`, `TASKS.ADD_TO_MY_DAY`, and `TASKS.REMOVE_FROM_MY_DAY` to `src/shared/ipc-channels.ts`, `IPC_CHANNELS.md`, and main handlers.
  - 6 unit tests in `tests/domain/list-store.test.ts` and `tests/domain/my-day-rollover.test.ts` (all 16 test suites and 85 tests passing).
- **What changed architecturally:**
  - Sidebar decoupled into clean `ListItem`, `SmartListGroup`, and resizer with zero flicker.
  - Smart list protection strictly enforced on both main process and renderer store.
  - Per-list background theming integrated with full CSS filter support on the main viewport.

---

### [2026-09-13] — Phase 5 complete: Core task CRUD, virtual list, detail panel, optimistic updates, undo, filtering
- **What was built:**
  - Normalized Zustand task store (`src/renderer/stores/taskStore.ts` and `task-store.ts`) with `tasksById: Record<string, Task>`, derived selectors (`useTask`, `useTasksByList`, `useMyDay`, `useImportant`, `usePlanned`, `useSubtasks`, `useCompletedTasks`, `useAllActiveTasks`), optimistic updates with rollback snapshots, and pagination/`loadMore`.
  - Progressive disclosure `TaskCard` (`src/renderer/features/tasks/TaskCard.tsx` + `.module.css`): `React.memo` container with Layer 1 (checkbox + title), Layer 2 (hover/focus: due date chip, tag dots, pomodoro count `🍅 ×N`, subtask count `M/N`, action buttons), Layer 3 (click to open detail panel), inline title editing on double-click/Enter, priority left border with critical pulse animation, and spring completion.
  - Virtualized `TaskList` (`src/renderer/features/tasks/TaskList.tsx` + `.module.css`): `@tanstack/react-virtual` with comfortable height defaults (`estimateSize: 44px`, `overscan: 10`), keyboard navigation (`j`/`k`, `x`, `Delete`, `*`), collapsible completed tasks section, and undo toast integration.
  - Slide-in `DetailPanel` drawer (`src/renderer/features/tasks/DetailPanel.tsx` + `.module.css`): Framer Motion spring slide-in (`x: 320 -> 0`), rich TipTap editor (`@tiptap/react`, `@tiptap/starter-kit`) sanitized with `DOMPurify` before IPC persistence, inline subtask manager, reminder trigger chips, and recurrence info.
  - Application-wide undo/redo system (`src/renderer/hooks/useUndoRedo.ts`) with 100-entry history stack, `Ctrl+Z`/`Ctrl+Y` shortcuts, and a 5-second `Toast` with immediate Undo action.
  - Memoized search, filter, and sort hook (`src/renderer/hooks/useFilteredTasks.ts`) and expandable `TaskListHeader` (`src/renderer/features/tasks/TaskListHeader.tsx` + `.module.css`).
  - Task duplication IPC handler (`TASKS.DUPLICATE`) and `TaskService.duplicate(id)`.
  - 8 unit tests across `tests/domain/task-store.test.ts` and `tests/domain/undo-redo.test.ts` (all 14 test suites and 79 tests passing).
- **What changed architecturally:**
  - Renderer task state strictly follows PERFORMANCE.md §12: normalized map `tasksById: Record<string, Task>`, preventing unnecessary array re-allocations and card re-renders.
  - ADR-0009 animation sites adhered to: Spring Checkbox bounce (Site #1) and Slide-in DetailPanel (Site #2).
  - Full client-side optimistic UI with rollback guarantee across task creation, updates, completion, and trash.

---

### [2026-09-13] — Phase 4 complete: Window infrastructure, tray, global shortcuts, splash, warm-start performance verified
- **What was built:**
  - Hardened `BrowserWindow` main window manager in `src/main/window/main-window.ts`:
    - Enforced `show: false` on creation per PERFORMANCE.md §1.
    - Intercepted `close` event with `e.preventDefault(); win.hide()` to keep the process and SQLite WAL connection alive in the tray.
    - Exported lifecycle controls (`showMainWindow()`, `hideMainWindow()`, `toggleMainWindow()`, `setAlwaysOnTop()`, `focusQuickAdd()`).
    - Pinned Always-on-Top mode with opacity clamping between 50% and 100%, persisted to SQLite `settings`.
  - Zero-JS lightweight HTML/CSS splash screen (`src/splash/splash.html`, `src/splash/splash.css`, `src/main/window/splash-window.ts`) for cold-start coverage, smoothly destroyed when `mainWindow` emits `ready-to-show`.
  - Centered keyboard-native Omnibar window (`src/main/window/omnibar-window.ts`) with blur-to-hide and `OmnibarView` (`src/renderer/features/omnibar/`) providing live hashtag, list, priority, and pomodoro modifier previews.
  - Reactive system tray manager (`src/main/tray/tray.ts`) with crisp in-memory SVG badge icon generator (`nativeImage.createFromDataURL`), displaying today's pending task counts and active Pomodoro countdowns (`🍅 24m`), plus context menu.
  - OS-level global shortcut registration (`src/main/shortcuts.ts`) for `Ctrl+Shift+Space` (focus main window), `Ctrl+Space` (Omnibar), `Ctrl+N` (Quick Add), `Ctrl+Shift+H` (toggle app visibility), and `Ctrl+Shift+T` (always on top).
  - Background non-blocking auto-updater service (`src/main/services/updater.ts`) powered by `electron-updater`.
  - Comprehensive unit test suite in `tests/window/window-and-tray.test.ts` (all 12 test suites passing, 71 tests total).
  - Verified bundle size and performance constraints: initial CSS = 24.43 kB (< 30 kB), initial JS = 96.89 kB gzipped (< 200 kB), and 5 code-split lazy chunks (`dashboard`, `agenda`, `projects`, `settings`, `pomodoro`).
- **What changed architecturally:**
  - Electron window destruction replaced by warm-start hide-on-close lifecycle, ensuring perceived window reopen time < 30ms.
  - Multi-window shell architecture established: MainWindow, SplashWindow, OmnibarWindow, and TrayManager operating harmoniously through central IPC and shortcut dispatchers.

---

### [2026-09-13] — Phase 3 complete: Full IPC contract, service layer, worker thread, parallel startup sequence
- **What was built:**
  - Standard IPC envelope enforcement (`{ ok: true, data }` / `{ ok: false, error }`) across all 16 IPC channel categories in `src/main/ipc/`.
  - Hardened preload script `src/main/window/preload.ts` strictly exposing only `window.electron.invoke(channel, payload?)` and `window.electron.on(channel, handler)` with zero Node APIs leaked to renderer.
  - Typed renderer IPC client adapter `src/renderer/services/ipc.ts` providing `invoke<T>()`, `invokeRaw<T>()`, and `on()`, unwrapping `{ ok: true, data }` or throwing standard Errors.
  - Complete Application Service Layer under `src/main/services/`:
    - `TaskService`: payload validation, local identity tagging, automatic recurrence next-instance calculation on `complete`, cycle detection on `makeSubtask`, reminder cleanup on `trash`, My Day membership, and fractional index reordering.
    - `ListService`: CRUD, atomic batch reordering, and smart list deletion protection (`is_smart === 1`).
    - `ProjectService`: CRUD and project archive lifecycle transitions.
    - `TagService`: tag CRUD and task-tag many-to-many relationship management.
    - `ReminderService`: Node.js `setTimeout` timer scheduling, startup overdue processing (`processOverdueAtStartup()`), system sleep/resume rescheduling (`rescheduleAfterSleep()`), snoozing, and cancellation.
    - `NotificationService`: native desktop `Notification` dispatch with inline action buttons (`Complete`, `Snooze 15m`) and database history tracking.
    - `SettingsService`: key-value preferences, theme, accent color, and launch-at-login integration.
  - Dedicated background Worker Thread layer under `src/worker/`:
    - `SearchWorker`: handles FTS5 full-text queries off the main event loop (< 150ms budget per PERFORMANCE.md).
    - `FileProcessor`: manages attachment ingestion into `userData/attachments/`.
    - `WorkerManager`: thread controller with request correlation IDs, timeout handling, and graceful fallback to main-process `SearchRepository`.
    - `vite.config.ts`: added worker compilation target to build `dist-electron/worker-main.js`.
  - Synchronous migration bootstrap and parallel startup data loading (`runStartupSequence()`) in `src/main/startup.ts`.
  - Comprehensive unit test suites under `tests/services/` for `TaskService`, `ReminderService`, `WorkerManager`, and IPC client adapter (all 11 test suites passing, 63 tests total).
- **What changed architecturally:**
  - ARCHITECTURE.md Rule 4 fully enforced: every IPC handler returns `{ ok, data }` or `{ ok, error }`.
  - Renderer code is strictly decoupled from Node.js APIs and direct Electron invocations, communicating via typed `src/renderer/services/ipc.ts`.
  - Expensive full-text search operations moved off the main thread into a dedicated worker thread with instant main-thread fallback if unavailable.

---

### [2026-09-13] — Phase 2 complete: Full SQLite schema, all repositories, domain functions, shared types
- **What was built:**
  - Initial database migration `0001_initial_schema.sql` covering all 20 Phase 1 tables + 4 Phase 2 stub tables, FTS5 virtual table `tasks_fts` with sync triggers (`tasks_ai`, `tasks_ad`, `tasks_au`), and default seeds for smart lists, modules, and settings.
  - Transactional migration runner `src/main/migrations/runner.ts` using `PRAGMA user_version`.
  - Database bootstrap `src/main/repositories/db.ts` applying all 6 performance pragmas (WAL, NORMAL, foreign keys, cache size, memory temp store, mmap size).
  - TypeScript shared types mirroring all tables under `src/shared/types/` (`Task`, `List`, `ListGroup`, `Project`, `Section`, `Tag`, `Reminder`, `Attachment`, `Comment`, `PomodoroSession`, `Goal`, `GoalLink`, `NotificationHistoryItem`, `Settings`, `Module`, `LocalIdentity`, `IpcResult`).
  - Repository layer under `src/main/repositories/`: `BaseRepository`, `TaskRepository`, `ListRepository`, `ListGroupRepository`, `ProjectRepository`, `SectionRepository`, `TagRepository`, `ReminderRepository`, `AttachmentRepository`, `PomodoroRepository`, `GoalRepository`, `SettingsRepository`, `ModuleRepository`, `NotificationRepository`, `IdentityRepository`, and `SearchRepository`.
  - Domain layer pure functions under `src/main/domain/`: `task-validation.ts`, `recurrence.ts` (RFC 5545 calculation via `rrule`), `nlp.ts` (Quick-Add natural language parsing via `chrono-node`), `fractional-index.ts` (ordering midpoints), and `dependency-check.ts` (cycle detection).
  - Shared date and UUID utilities under `src/shared/utils/`.
- **What changed architecturally:**
  - ARCHITECTURE.md Rule 2 strictly enforced: all SQLite statements live inside `src/main/repositories/` with zero string concatenation.
  - Domain logic isolated as 100% pure, side-effect-free functions decoupled from IPC and filesystem.
  - Full-text search powered by SQLite FTS5 virtual table with automated trigger-based index updates.

---

### [2026-09-13] — Phase 1 complete: Token system live, fonts wired, base component library built, app shell
- **What was built:**
  - Token system and self-hosted fonts wired at app entry point (`tokens.css`, `fonts.css`).
  - Titlebar component with frameless drag regions, OS window controls, and Always on Top pin toggle.
  - Base tokens-only component library: `Button` (3 semantic variants), `Input` (error/focus states), `Popover` (Radix wrapper), `Toast` (undo action, auto-dismiss), `EmptyState`, `LoadingSpinner` (reduced-motion friendly), and `Tooltip` (Radix wrapper with kbd badge).
  - Three-column CSS Grid application layout shell (`layout.module.css`): Sidebar | TaskList | DetailPanel.
  - Route-level lazy loading for `Dashboard`, `Agenda`, `Projects`, `Settings`, and `Pomodoro` with a layout-matched `Suspense` skeleton fallback.
- **What changed architecturally:**
  - Strict tokens-only policy enforced across all components; zero hardcoded pixel/color literals.
  - Critical path bundle established (`Sidebar`, `TaskList`, `DetailPanel`, `App`); non-critical modules code-split on demand.
  - Permitted Framer Motion interactions restricted strictly to 4 designated sites.

---

### [2026-09-13] — Phase 0 complete: All governance docs, ADRs, project skeleton, git init
- **What was built:**
  - Complete suite of companion governance documents (`UTILITIES.md`, `DONE.md`, `CHANGELOG_INTERNAL.md`, `IPC_CHANNELS.md`).
  - Architecture Decision Records (`ADR-0001` through `ADR-0009`) covering SQLite selection, Electron vs Tauri, Zustand, Vite bundler, local-first constraint, CSS Modules & design tokens, fractional indexing, FTS5 search worker, and Radix headless primitives.
  - Complete multi-process directory tree skeleton per `ARCHITECTURE.md`.
  - ESLint and Prettier setup enforcing layer boundaries (forbidding renderer-to-main/worker imports and raw values).
  - Cross-platform `electron-builder` configuration in `package.json` for `.exe` (NSIS), `.dmg`, and `.AppImage`.
  - Configured Rollup `manualChunks` in `vite.config.ts` per `PERFORMANCE.md` §5.
- **What changed architecturally:**
  - Layer boundaries established and strictly verified with ESLint rules.
  - IPC channel catalog formalized with strict `{ ok, data/error }` communication envelope.
