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
| `useTaskStore` | `src/renderer/stores/task-store.ts` | Reactive task collection, optimistic task mutations, active selection | Renderer global |

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
| `Sidebar` | `src/renderer/features/sidebar/Sidebar.tsx` | Uses `ScrollArea` | No (CSS transitions) | Main navigation sidebar (critical initial bundle) |
| `TaskList` | `src/renderer/features/tasks/TaskList.tsx` | Uses `ScrollArea` | **Site #3 (Reorder layoutId)** | Primary task stream with virtual scroll and priority styling (critical initial bundle) |
| `DetailPanel` | `src/renderer/features/tasks/DetailPanel.tsx` | No | **Site #2 (Spring slide-in)** | Task metadata/notes editor with spring slide-in from right (critical initial bundle) |
| `OmnibarView` | `src/renderer/features/omnibar/OmnibarView.tsx` | No | No (CSS transitions) | Centered keyboard task capture overlay with live modifier parsing and auto-dismiss |

### Permitted Framer Motion Sites (Strict ADR-0009 Rule)
1. **Checkbox completion:** `scale(1) → scale(1.2) → scale(1)` in 180ms via `--ease-spring`.
2. **Detail panel open/close:** Spring slide-in from right (`x: 40 → 0`).
3. **Task list reorder:** `layoutId` layout animation during drag-and-drop.
4. **Quick-add bar appear/dismiss:** Scale (`0.96 → 1`) and opacity (`0 → 1`).
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
| `ReminderRepository` | `src/main/repositories/ReminderRepository.ts` | `getUpcomingAndOverdue`, `create`, `markTriggered`, `snooze`, `deleteByTaskId`, `delete` |
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
| `ReminderService` | `src/main/services/reminder/ReminderService.ts` | Node.js `setTimeout` scheduler, `processOverdueAtStartup()`, `rescheduleAfterSleep()`, snooze, cancel |
| `NotificationService` | `src/main/services/notification/NotificationService.ts` | Native desktop `Notification` dispatch with actionable buttons, persistent `notification_history` |
| `SettingsService` | `src/main/services/settings/SettingsService.ts` | Preference key-value store, `applyTheme`, `applyAccentColor`, `applyLoginItem` |
| `WorkerManager` | `src/main/services/worker-manager.ts` | Manages Node `worker_threads` instance with correlation IDs, timeouts, and seamless main-thread fallback |

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
| `TrayManager` | `src/main/tray/tray.ts` | `initTray()`, `updateTrayBadge(count, pomodoro)`, `destroyTray()` — in-memory SVG badge icon and context menu |
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
