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

### Permitted Framer Motion Sites (Strict ADR-0009 Rule)
1. **Checkbox completion:** `scale(1) → scale(1.2) → scale(1)` in 180ms via `--ease-spring`.
2. **Detail panel open/close:** Spring slide-in from right (`x: 40 → 0`).
3. **Task list reorder:** `layoutId` layout animation during drag-and-drop.
4. **Quick-add bar appear/dismiss:** Scale (`0.96 → 1`) and opacity (`0 → 1`).
*All other UI animations and transitions use pure CSS.*

---

## 3. Domain Functions

*Check here before writing new business logic. Domain functions are pure: no I/O, no IPC, no database calls.*

| Function | File Path | Description |
|---|---|---|
| `createTaskEntity` | `src/main/domain/task.ts` | Pure task factory with UUID generation, timestamping, default sort order |
| `validateTaskTitle` | `src/main/domain/task.ts` | Validates task title (non-empty, max 500 chars) |
| `clampPriority` | `src/main/domain/task.ts` | Clamps numeric priority to valid range (0-4: None, Low, Medium, High, Critical) |
| `toggleTaskCompletion`| `src/main/domain/task.ts` | Pure state transition returning updated task with completion timestamp |
| `calculateNextDueDate` | `src/main/domain/task.ts` | RFC 5545 RRULE recurrence calculator for recurring tasks |
| `parseNaturalLanguageTask` | `src/main/domain/nlp.ts` | Chrono-based NLP date/time and priority parser from raw text input |

---

## 4. Repository Methods

*Check here before writing a new query. All database queries live in repositories.*

| Repository | Method | File Path | Purpose |
|---|---|---|---|
| `BaseRepository` | `findMany`, `findOne`, `execute` | `src/main/repositories/base-repository.ts` | Type-safe wrapper around `better-sqlite3` prepared statements |
| `TaskRepository` | `findAll(filter)` | `src/main/repositories/task-repository.ts` | Fetch active/completed tasks filtered by list or project |
| `TaskRepository` | `findById(id)` | `src/main/repositories/task-repository.ts` | Fetch a single task by UUID |
| `TaskRepository` | `create(task)` | `src/main/repositories/task-repository.ts` | Insert a new task entity |
| `TaskRepository` | `update(task)` | `src/main/repositories/task-repository.ts` | Update existing task attributes |
| `TaskRepository` | `delete(id)` | `src/main/repositories/task-repository.ts` | Hard delete a task entity |
| `TaskRepository` | `toggleComplete(id)` | `src/main/repositories/task-repository.ts` | Toggle task completion status and update `completed_at` |
| `SettingsRepository` | `getAll()` | `src/main/repositories/settings-repository.ts` | Fetch all key-value application settings |
| `SettingsRepository` | `get(key)` | `src/main/repositories/settings-repository.ts` | Get setting value by key |
| `SettingsRepository` | `set(key, val)` | `src/main/repositories/settings-repository.ts` | Insert or replace setting key-value pair |

---

## 5. Do NOT Create a Duplicate Of

*The following items must exist ONLY ONCE in the codebase:*

1. **Design Tokens:** `src/renderer/styles/tokens.css` (never create alternate token files or hardcoded hex/rgba values).
2. **IPC Channel Registry:** `IPC_CHANNELS.md` and `src/shared/ipc-channels.ts` (never invent ad-hoc string channel names).
3. **Database Connection:** `src/main/database.ts` (only one `better-sqlite3` instance exists in the main process).
4. **Database Migration Runner:** `src/main/migrations/runner.ts` (tracks `PRAGMA user_version` and executes sequentially).
5. **Main Window Lifecycle Manager:** `src/main/window/main-window.ts` (sole owner of `BrowserWindow` creation, state, and sizing).
6. **IPC Dispatch Registry:** `src/main/ipc/index.ts` (all `ipcMain.handle` registrations route here).
7. **Portal Root:** `<div id="radix-portal"></div>` in `index.html` (single target for Radix portals).
