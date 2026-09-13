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

| Component | File Path | Type | Description |
|---|---|---|---|
| `Titlebar` | `src/renderer/components/Titlebar/Titlebar.tsx` | App Chrome | Custom frameless window titlebar with drag region and window controls |
| `Checkbox` | `src/renderer/components/Checkbox/Checkbox.tsx` | Input | Accessible task completion checkbox with spring animation (permitted site #1) |
| `QuickAdd` | `src/renderer/components/QuickAdd/QuickAdd.tsx` | Feature Trigger | Quick-entry task capture input with spring scale/opacity (permitted site #4) |
| `Collapsible` | `src/renderer/components/primitives/Collapsible/` | Radix Primitive | Accessible expandable section wrapper |
| `Dialog` | `src/renderer/components/primitives/Dialog/` | Radix Primitive | Accessible modal dialog with focus trap and overlay portal |
| `DropdownMenu`| `src/renderer/components/primitives/DropdownMenu/` | Radix Primitive | Accessible contextual popout menus |
| `Popover` | `src/renderer/components/primitives/Popover/` | Radix Primitive | Floating picker and popup overlay container |
| `ScrollArea` | `src/renderer/components/primitives/ScrollArea/` | Radix Primitive | Custom scrollable viewport with themed scrollbars |
| `Tooltip` | `src/renderer/components/primitives/Tooltip/` | Radix Primitive | Accessible keyboard-shortcut tooltip hints |

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
