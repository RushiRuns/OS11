# OS11 — Internal Engineering Changelog

> **Format:** `[YYYY-MM-DD] — [what was built] — [what changed architecturally]`
> **Rule:** Updated at the end of every coding session before committing.

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
