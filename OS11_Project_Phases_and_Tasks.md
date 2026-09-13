# OS11 — Complete Project Breakdown into Phases & Tasks

> **Governance First.** All foundational documents are written before ANY production code is written.
> This prevents the vibe coding problems — the same ones that require half the project to be re-read,
> re-explained, and re-built every session.
>
> **The five North Stars every task is measured against:**
> ⚡ Insane Speed · ⌨️ Keyboard Native · 🧩 Modular · 🤲 Extreme Convenience · 🌌 FEEL UI
>
> **Phase 1 hard constraint:** Local only. No cloud. No external auth. No AI/LLM. No exceptions.
> A feature that violates ARCHITECTURE.md does not ship — it goes back for a redesign.

---

## PHASE 0: Governance & Foundation Setup (Weeks 1-2)

### Core Governance Documents (already written — validate before first code session)

- [x] Review and validate `ARCHITECTURE.md` — Layer Order, module boundaries, hard rules, security rules
- [x] Review and validate `SCHEMA.md` — all tables, indexes, FTS5, relationships, Phase 2 stubs
- [x] Review and validate `PERFORMANCE.md` — all targets, all 18 mitigation strategies, pre-ship checklist
- [x] Review and validate `DEPENDENCIES.md` — approved packages, Banned Alternatives, bundle size targets
- [x] Review and validate `tokens.css` — all surface, text, accent, priority, tag, border, spacing, motion, and z-index tokens

### Companion Governance Documents (create before first code session)

- [x] Create `UTILITIES.md` — index of every shared hook, utility, and component in the codebase
  - Section: Shared Hooks (check here before writing a new hook)
  - Section: Shared Components (check here before writing a new component)
  - Section: Domain Functions (check here before writing new domain logic)
  - Section: Repository Methods (check here before writing a new query)
  - Section: **"Do NOT create a duplicate of"** — items that must exist only once
  - Rule: updated at the end of every session that creates something reusable
- [x] Create `DONE.md` — definition of done, consulted before closing any feature
  - Happy path tested
  - Empty state exists and is correct
  - Error state exists and is handled
  - No hardcoded color, size, radius, or font value (tokens only)
  - No renderer-side business logic (validation, computation, data transformation)
  - All IPC handlers use `try/catch` and return `{ ok, data/error }`
  - Virtual scrolling applied to any list that can grow without bound
  - Optimistic update pattern used for any write operation
  - Reduced motion handled for any animation
  - At least one test written
  - UTILITIES.md updated if anything reusable was created
  - CHANGELOG_INTERNAL.md updated
  - ARCHITECTURE.md rules not violated
  - Committed to git
- [x] Create `CHANGELOG_INTERNAL.md` — starts empty; one entry per coding session
  - Format: `[date] — [what was built] — [what changed architecturally]`
  - Updated at the end of every session before committing
- [x] Create `IPC_CHANNELS.md` — every IPC channel name defined before first use
  - No ad-hoc string literals anywhere in the codebase; every channel name comes from this file
  - Groups: APP, TASKS, LISTS, LIST_GROUPS, PROJECTS, SECTIONS, TAGS, REMINDERS,
    ATTACHMENTS, POMODORO, GOALS, SETTINGS, MODULES, SEARCH, NOTIFICATIONS, IDENTITY,
    SYNC (Phase 2 placeholder)

### Architecture Decision Records

- [x] `docs/decisions/ADR-0001-better-sqlite3.md` — why `better-sqlite3` over `sql.js` / `node-sqlite3` / Prisma
- [x] `docs/decisions/ADR-0002-electron-over-tauri.md` — the Tauri evaluation and why Electron won
- [x] `docs/decisions/ADR-0003-zustand-over-redux.md` — why Zustand; why Context is banned for global state
- [x] `docs/decisions/ADR-0004-vite-bundler.md` — why Vite over Webpack/CRA; `manualChunks` config rationale
- [x] `docs/decisions/ADR-0005-local-first-no-cloud.md` — the primary constraint, consequences, future unlock path
- [x] `docs/decisions/ADR-0006-css-modules-over-css-in-js.md` — why runtime CSS-in-JS is banned; tokens approach
- [x] `docs/decisions/ADR-0007-fractional-indexing.md` — why `sort_order REAL` with fractional indexing
- [x] `docs/decisions/ADR-0008-fts5-full-text-search.md` — why FTS5 virtual table; worker thread placement
- [x] `docs/decisions/ADR-0009-radix-ui-headless-primitives.md` — why Radix UI over building custom focus-traps; why GSAP/MUI/AntD/Chakra are banned; the 4-site Framer Motion restriction rationale

### Project Setup

- [x] Initialize project with Vite + React + TypeScript + Electron
- [x] Create complete folder structure per `ARCHITECTURE.md`:
  ```
  src/
    main/
      ipc/
      services/
        task/ list/ project/ tag/ reminder/ attachment/
        pomodoro/ goal/ notification/ settings/ analytics/
        backup/ export/ import/ calendar/ security/
      repositories/
      domain/
      window/
      tray/
      migrations/
    renderer/
      components/
        Button/ Checkbox/ Input/ Popover/ Toast/
        DatePicker/ Tooltip/ EmptyState/ LoadingSpinner/
        ProgressBar/ RecurrencePicker/
      features/
        tasks/ lists/ projects/ pomodoro/ agenda/
        dashboard/ settings/ search/ omnibar/ quickadd/
        tags/ notifications/ onboarding/ command-palette/
        attachments/ goals/
      stores/
      hooks/
      styles/
      services/
    worker/
      search/
      file-processor/
      sync/               — Phase 2 stub
    shared/
      types/
      constants/
      utils/
  docs/
    decisions/
  ```
- [x] Configure `tsconfig.json` with path aliases (`@main`, `@renderer`, `@shared`, `@worker`)
- [x] Configure `vite.config.ts` with `manualChunks` per PERFORMANCE.md §5:
  - Initial bundle: `TaskList`, `Sidebar`, `DetailPanel`, `App`
  - Lazy chunks: `Dashboard`, `Agenda`, `Projects`, `Settings`, `Pomodoro`
  - Recharts auto-splits with Dashboard chunk
- [x] Configure `electron-builder` in `package.json` for `.exe` (NSIS), `.dmg`, `.AppImage`
- [x] Set up ESLint + Prettier with rules that enforce no hardcoded values, no renderer-to-repo imports
- [x] Create `docs/decisions/` folder — empty, ready for ADRs
- [x] Git init — first commit: `"chore: project skeleton + all governance documents"`

### Governance Update

- [x] CHANGELOG_INTERNAL.md: "Phase 0 complete: All governance docs, ADRs, project skeleton, git init."
- [x] Commit: `"chore: Phase 0 complete — governance and project foundation"`

---

## PHASE 1: Design System & CSS Tokens (Weeks 2-3)

> `tokens.css` is already written. This phase wires it into the project and builds the
> component layer that every feature will consume.
> After this phase: no hardcoded value is ever acceptable in a component file again.

### Token System Wiring

- [x] `src/renderer/styles/tokens.css` — the provided token file is the source of truth
- [x] Import `tokens.css` as the first import in `src/renderer/main.tsx`
- [x] Verify tokens in both light and dark mode: open a basic page in the app, toggle `data-theme="dark"` on `<html>`, confirm surfaces and text switch
- [x] Create `src/renderer/styles/fonts.css`
  - `@font-face` for Inter (300, 400, 500, 600, 700) — self-hosted, no Google Fonts network dependency
  - `@font-face` for JetBrains Mono (400, 500) — for notes editor code blocks
  - Import after `tokens.css` in `main.tsx`
- [x] Initialise Radix UI / shadcn scaffold
  - Run `npx shadcn@latest init` — select **no** to Tailwind CSS when prompted; choose CSS Variables
  - Eject generated component code into `src/renderer/components/` (do not leave it in `components/ui/`)
  - Install only the 6 approved primitives: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-dialog`, `@radix-ui/react-collapsible`, `@radix-ui/react-scroll-area`, `@radix-ui/react-tooltip`
  - Add `<div id="radix-portal"></div>` to `index.html` for portal targets
  - Verify no Tailwind classes appear anywhere in ejected component files

### Custom Electron Titlebar

- [x] Create `src/renderer/components/Titlebar/Titlebar.module.css`
  - Height: `var(--titlebar-height)` (28px)
  - `-webkit-app-region: drag` on the drag zone
  - Window control buttons: `no-drag`, no system chrome (frame: false)
- [x] Create `src/renderer/components/Titlebar/Titlebar.tsx`
  - Windows: Close / Minimize / Maximize buttons (left or right per OS convention)
  - macOS: Traffic light proxy buttons (native via `titleBarStyle: 'hiddenInset'`)
  - Linux: Minimize / Maximize / Close
  - "Always on Top" toggle pin in titlebar (wired in Phase 4)

### Base Component Library

All components use only CSS variable tokens. No hardcoded values. Verified against DONE.md before closing.

- [x] Create `src/renderer/components/Checkbox/Checkbox.tsx` + `.module.css`
  - Size: `var(--checkbox-size)` (20px), border: `var(--checkbox-border-width)` (1.5px)
  - Resting: `var(--border-default)` border, transparent fill
  - Checked: `var(--accent)` fill, white check icon, **Framer Motion spring animation** (permitted use-site #1)
    - `scale(1) → scale(1.2) → scale(1)` in 180ms via `--ease-spring`
  - Project-colored variants: border and fill inherit the task's project color token when a project is assigned
  - Reduced motion: instant fill, no spring (reads `useReducedMotion()`)
- [x] Create `src/renderer/components/Button/Button.tsx` + `.module.css`
  - **Three semantic variants** (per Feature Spec §2.3):
    - `primary` — `--accent` fill, `--text-on-accent` text
    - `ghost` — transparent bg, `--text-primary` text; `--border-default` border on hover
    - `danger` — `--color-danger` fill on hover; ghost-styled at rest
  - Size modifier `sm`: `padding: var(--space-1) var(--space-3)`, `font-size: var(--text-sm)`
  - All padding uses `var(--space-*)` tokens; border radius is `var(--radius-sm)`
  - Focus ring: `var(--shadow-focus)` — visible on keyboard navigation only (`focus-visible`)
- [x] Create `src/renderer/components/Input/Input.tsx` + `.module.css`
  - Border: `var(--border-default)`, radius: `var(--radius-md)`, padding: `var(--space-2) var(--space-3)`
  - Focus: `var(--accent-border)` border + `var(--shadow-focus)` ring
  - Error: `var(--color-danger)` border + error message below in `--text-xs`
  - Placeholder: `var(--text-placeholder)` color
- [x] Create `src/renderer/components/Popover/Popover.tsx` + `.module.css`
  - **Wraps `@radix-ui/react-popover`** — do not build a custom focus-trap
  - Background: `var(--surface-overlay)`, shadow: `var(--shadow-md)`, radius: `var(--radius-md)`
  - Z-index: `var(--z-dropdown)` (100)
  - CSS transition: `opacity` + `scaleY` from origin — `var(--transition-fast)` — not Framer Motion
- [x] Create `src/renderer/components/Toast/Toast.tsx` + `.module.css`
  - Z-index: `var(--z-notification)` (500)
  - Variants: default, success, error, undo
  - "Undo" variant has an action button inline
  - Auto-dismiss after 5 seconds; CSS slide-up on mount, slide-down on dismiss (not Framer Motion)
- [x] Create `src/renderer/components/EmptyState/EmptyState.tsx` + `.module.css`
  - Every feature has an empty state — build it once here
  - Props: `icon`, `title`, `description`, `action?`
  - Uses `var(--text-secondary)` and `var(--text-tertiary)` for the calm, non-intrusive look
- [x] Create `src/renderer/components/LoadingSpinner/LoadingSpinner.tsx` + `.module.css`
  - Minimal CSS spinner — `var(--accent)` color
  - Respects `prefers-reduced-motion`: static indicator when reduced motion is on
- [x] Create `src/renderer/components/Tooltip/Tooltip.tsx` + `.module.css`
  - **Wraps `@radix-ui/react-tooltip`** — provides keyboard shortcut hints on `focus-visible` or hover
  - Z-index: `var(--z-tooltip)` (600)
  - Font: `var(--text-xs)`, `var(--weight-medium)`
- [x] Create `src/renderer/components/QuickAdd/QuickAdd.tsx` + `.module.css`
  - Height: `var(--quick-add-height)` (52px), radius: `var(--radius-xl)`
  - Layout: circular `+` icon button (left) + `"Add a task…"` text trigger (expands to full input on click)
  - **Framer Motion** appear/dismiss (permitted use-site #4): `scale: 0.96 → 1`, `opacity: 0 → 1`
  - Dismisses on `Escape` or click-outside via Radix `FocusScope` / `DismissableLayer`

### App Layout Shell

- [x] Create `src/renderer/App.tsx`
  - Three-column CSS Grid: Sidebar | TaskList | DetailPanel
  - Lazy imports per PERFORMANCE.md §5 — Dashboard, Agenda, Projects, Settings, Pomodoro all lazy
  - TaskList, Sidebar, DetailPanel always in initial bundle (critical path)
  - `Suspense` fallback: skeleton UI, not a spinner (skeleton matches the layout of real content)
- [x] Create `src/renderer/styles/layout.module.css`
  - Column widths: `var(--sidebar-width)`, fill, `var(--detail-panel-width)`
  - Respect `--sidebar-position` setting (left/right/hidden)
  - Min window width: 600px (sidebar + task list minimum)

### Governance Update

- [x] Update UTILITIES.md — inventory all components: Checkbox, Button, Input, Popover (Radix), Toast, EmptyState, LoadingSpinner, Tooltip (Radix), Titlebar, QuickAdd
  - Note which components wrap Radix primitives
  - Note which components use Framer Motion (Checkbox, DetailPanel, TaskList, QuickAdd only)
- [x] CHANGELOG_INTERNAL.md: "Phase 1 complete: Token system live, fonts wired, base component library built, app shell."
- [x] Commit: `"Phase 1 complete: Design system and base component library"`

---

## PHASE 2: Database Schema & Repository Layer (Weeks 3-5)

> `SCHEMA.md` is already written. This phase implements it as SQLite tables and repository classes.
> All `db.prepare()` calls live in `src/main/repositories/` and nowhere else (ARCHITECTURE.md rule 2).

### Database Bootstrap

- [x] Create `src/main/repositories/db.ts`
  - Open `better-sqlite3` at `app.getPath('userData')/os11.db`
  - Apply all pragmas from PERFORMANCE.md §14 before any query runs:
    ```typescript
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -32000');
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456');
    ```
  - Export a singleton `db` instance — imported by all repositories; nowhere else

### Migration System

- [x] Create `src/main/migrations/runner.ts`
  - Read `PRAGMA user_version` on startup
  - Apply pending migration files in order (`0001`, `0002`, ...)
  - Set `PRAGMA user_version` after each migration succeeds
  - Wrapped in a single transaction per migration — all or nothing
  - Must complete before any other startup operation (per PERFORMANCE.md §3)
- [x] Create `src/main/migrations/0001_initial_schema.sql`
  - All Phase 1 tables from `SCHEMA.md`: `tasks`, `lists`, `list_groups`, `projects`, `sections`,
    `task_dependencies`, `milestones`, `tags`, `task_tags`, `reminders`, `attachments`,
    `comments`, `comment_reactions`, `pomodoro_sessions`, `goals`, `goal_links`,
    `notification_history`, `settings`, `modules`, `local_identity`
  - All Phase 2 tables created as empty stubs now — no migration needed when Phase 2 ships:
    `users`, `devices`, `collaboration_members`, `sync_queue`
  - All indexes from `SCHEMA.md`
  - FTS5 virtual table: `CREATE VIRTUAL TABLE tasks_fts USING fts5(id UNINDEXED, title, notes, content=tasks, content_rowid=rowid)`
  - FTS5 sync triggers on `tasks`: INSERT → add to index, UPDATE → update index, DELETE → remove
  - Seed `settings` table with all defaults from SCHEMA.md
  - Seed `modules` table with all defaults from SCHEMA.md
  - `PRAGMA user_version = 1`
- [x] Create `src/main/migrations/README.md` — naming convention, how to add a new migration, what needs human review

### TypeScript Shared Types

One interface per table. Lives in `src/shared/types/`. The renderer, main, and worker processes all import from here.

- [x] `src/shared/types/Task.ts` — mirrors `tasks` table; adds `tags: Tag[]` as a computed join field
- [x] `src/shared/types/List.ts`
- [x] `src/shared/types/ListGroup.ts`
- [x] `src/shared/types/Project.ts`
- [x] `src/shared/types/Section.ts`
- [x] `src/shared/types/Tag.ts`
- [x] `src/shared/types/Reminder.ts`
- [x] `src/shared/types/Attachment.ts`
- [x] `src/shared/types/Comment.ts`
- [x] `src/shared/types/PomodoroSession.ts`
- [x] `src/shared/types/Goal.ts`
- [x] `src/shared/types/GoalLink.ts`
- [x] `src/shared/types/NotificationHistoryItem.ts`
- [x] `src/shared/types/Settings.ts` — typed key-value map; every key from SCHEMA.md is a typed property
- [x] `src/shared/types/Module.ts`
- [x] `src/shared/types/LocalIdentity.ts`
- [x] `src/shared/types/IpcResult.ts` — `type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }`
- [x] `src/shared/types/index.ts` — barrel export of all types

### Repository Layer

One file per domain. All parameterized statements. No string concatenation in queries. Ever.

- [x] Create `src/main/repositories/TaskRepository.ts`
  - `getByListId(listId, offset, limit): Task[]` — paginated, used for lazy loading
  - `getFirst50(listId): Task[]` — startup preload
  - `getByProjectId(projectId): Task[]`
  - `getById(id): Task | null`
  - `getSubtasks(parentId): Task[]`
  - `getMyDay(date: string): Task[]` — `WHERE my_day_date = ? AND is_trashed = 0`
  - `getImportant(): Task[]` — `WHERE is_starred = 1 AND is_trashed = 0`
  - `getPlanned(): Task[]` — `WHERE due_date IS NOT NULL AND is_trashed = 0` ordered by due_date
  - `getAllTasks(): Task[]` — `WHERE is_trashed = 0 AND parent_task_id IS NULL`
  - `getCompleted(): Task[]` — `WHERE is_completed = 1 AND is_trashed = 0` ordered by completed_at
  - `getTrashed(): Task[]`
  - `create(payload): Task`
  - `update(id, fields): Task`
  - `complete(id, completedAt): void`
  - `uncomplete(id): void`
  - `star(id): void`
  - `unstar(id): void`
  - `trash(id, trashedAt): void`
  - `restore(id): void`
  - `permanentDelete(id): void`
  - `addToMyDay(id, date): void`
  - `removeFromMyDay(id): void`
  - `updateSortOrder(id, sortOrder): void`
- [x] Create `src/main/repositories/ListRepository.ts`
  - `getAll(): List[]`
  - `getById(id): List | null`
  - `create(payload): List`
  - `update(id, fields): List`
  - `delete(id): void` — cascades to tasks via FK
  - `reorder(updates: Array<{ id: string; sortOrder: number }>): void` — batch update via transaction
- [x] Create `src/main/repositories/ListGroupRepository.ts`
- [x] Create `src/main/repositories/ProjectRepository.ts`
  - `getAll(): Project[]`
  - `getById(id): Project | null`
  - `create(payload): Project`
  - `update(id, fields): Project`
  - `archive(id): void` — sets `status = 'archived'`
- [x] Create `src/main/repositories/SectionRepository.ts`
  - `getByProjectId(projectId): Section[]`
  - `create(payload): Section`
  - `update(id, fields): Section`
  - `delete(id): void`
- [x] Create `src/main/repositories/TagRepository.ts`
  - `getAll(): Tag[]`
  - `create(payload): Tag`
  - `update(id, fields): Tag`
  - `delete(id): void` — cascades `task_tags` via FK
  - `getTagsForTask(taskId): Tag[]`
  - `addTagToTask(taskId, tagId): void`
  - `removeTagFromTask(taskId, tagId): void`
  - `getTasksForTag(tagId): Task[]` — for Tag View
- [x] Create `src/main/repositories/ReminderRepository.ts`
  - `getUpcomingAndOverdue(): Reminder[]` — `WHERE is_triggered = 0` ordered by `remind_at`
  - `create(payload): Reminder`
  - `markTriggered(id): void`
  - `snooze(id, snoozedUntil): void`
  - `deleteByTaskId(taskId): void`
- [x] Create `src/main/repositories/AttachmentRepository.ts`
  - `getByTaskId(taskId): Attachment[]`
  - `create(payload): Attachment`
  - `delete(id): Attachment` — returns record so caller can delete the file from disk
- [x] Create `src/main/repositories/PomodoroRepository.ts`
  - `create(payload): PomodoroSession`
  - `complete(id, endedAt): void`
  - `getByTaskId(taskId): PomodoroSession[]`
  - `getStats(from, to): { totalSessions: number; totalMinutes: number; sessionsByDay: Record<string, number> }`
- [x] Create `src/main/repositories/GoalRepository.ts`
  - `getAll(): Goal[]`
  - `create(payload): Goal`
  - `update(id, fields): Goal`
  - `delete(id): void`
  - `addLink(goalId, resourceType, resourceId): void`
  - `removeLink(goalId, resourceId): void`
  - `getLinks(goalId): GoalLink[]`
- [x] Create `src/main/repositories/SettingsRepository.ts`
  - `get(key): any` — JSON-parsed
  - `set(key, value): void` — JSON-stringified
  - `getAll(): Record<string, any>`
- [x] Create `src/main/repositories/ModuleRepository.ts`
  - `getAll(): Module[]`
  - `isEnabled(moduleName): boolean`
  - `toggle(moduleName, enabled): void`
- [x] Create `src/main/repositories/NotificationRepository.ts`
  - `add(payload): void`
  - `getAll(): NotificationHistoryItem[]` — virtualized in UI; returns all for now
  - `markRead(id): void`
  - `markAllRead(): void`
- [x] Create `src/main/repositories/IdentityRepository.ts`
  - `get(): LocalIdentity`
  - `create(): LocalIdentity` — UUID v4 via `uuid`; called once on first launch
  - `updateDisplayName(name): void`
- [x] Create `src/main/repositories/SearchRepository.ts`
  - `search(query): Array<{ id: string; title: string; snippet: string; listId: string }>` — FTS5 query with snippet()

### Domain Layer (Pure Functions — No I/O, No Side Effects)

- [x] Create `src/main/domain/task-validation.ts`
  - `validateCreate(payload): void` — throws with message if invalid
  - `validateUpdate(fields): void`
  - Rules: title required, max 500 chars; priority 0–4; dates valid ISO 8601; RRULE valid if present
- [x] Create `src/main/domain/recurrence.ts`
  - `nextOccurrence(rruleString, fromDate): Date | null` — `rrule` library
  - `humanReadableRRule(str): string` — "Every Monday", "Daily", etc.
  - `isValidRRule(str): boolean`
  - `expandOccurrences(str, from, to): Date[]` — for agenda/timeline views
- [x] Create `src/main/domain/nlp.ts`
  - `parseQuickAdd(input): ParsedTaskInput` — `chrono-node` for dates + regex for modifiers
  - Returns: `{ title, dueDate, dueTime, allDay, priority, tagNames, listName, pomodoroRequested, recurrenceRule }`
  - Handles all syntax from Feature Spec §5.4: `#tag`, `@list`, `!priority`, `🍅`, natural date strings
- [x] Create `src/main/domain/fractional-index.ts`
  - `between(prev: number | null, next: number | null): number`
  - `atStart(first: number): number`
  - `atEnd(last: number): number`
- [x] Create `src/main/domain/dependency-check.ts`
  - `wouldCreateCycle(taskId, dependsOnId, getAllDependencies): boolean`
- [x] Create `src/shared/utils/date.ts`
  - `toISODate(date: Date): string` — always `YYYY-MM-DD`
  - `toISODateTime(date: Date): string` — always `YYYY-MM-DDTHH:mm:ss.sssZ`
  - `formatForDisplay(isoString): string` — "Today", "Tomorrow", "Mon, Jan 6", etc. using `date-fns`
  - `isOverdue(dueDateISO): boolean`
- [x] Create `src/shared/utils/uuid.ts` — thin wrapper on `uuid` v4 package

### Governance Update

- [x] Update UTILITIES.md — document all repositories, domain functions, and shared utils
- [x] CHANGELOG_INTERNAL.md: "Phase 2 complete: Full SQLite schema, all repositories, domain functions, shared types."
- [x] Run `npm audit` — must come back clean
- [x] Commit: `"Phase 2 complete: Database, repositories, domain layer"`

---

## PHASE 3: Process Architecture & IPC Contract Layer (Weeks 5-6)

> Wires the three OS processes together per ARCHITECTURE.md.
> No feature can be built until the IPC plumbing is proven.

### Preload Script

- [ ] Create `src/main/window/preload.ts`
  - Exposes ONLY: `window.electron.invoke(channel, payload?)` and `window.electron.on(channel, handler)`
  - `contextBridge.exposeInMainWorld()` — no other Node APIs exposed
  - `contextIsolation: true` — enforced in BrowserWindow config
  - Zero business logic in the preload script

### IPC Channel Registry

- [ ] Create `src/shared/ipc-channels.ts`
  - Every channel defined as a typed const — e.g., `export const IPC = { TASKS: { CREATE: 'tasks:create', ... }, ... }`
  - Groups match IPC_CHANNELS.md exactly
  - No ad-hoc string literals anywhere in the codebase
  - Reviewed and updated whenever a new feature adds a channel

### IPC Handler Files (Main Process)

Every handler uses this exact pattern (ARCHITECTURE.md rule 4):

```typescript
ipcMain.handle(IPC.TASKS.CREATE, async (_event, payload: CreateTaskPayload) => {
  try {
    const task = await taskService.create(payload);   // validation inside service
    return { ok: true, data: task };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
});
```

- [ ] Create `src/main/ipc/task-handlers.ts` — registers all TASKS.* handlers; delegates to TaskService
- [ ] Create `src/main/ipc/list-handlers.ts`
- [ ] Create `src/main/ipc/list-group-handlers.ts`
- [ ] Create `src/main/ipc/project-handlers.ts`
- [ ] Create `src/main/ipc/section-handlers.ts`
- [ ] Create `src/main/ipc/tag-handlers.ts`
- [ ] Create `src/main/ipc/reminder-handlers.ts`
- [ ] Create `src/main/ipc/attachment-handlers.ts`
- [ ] Create `src/main/ipc/pomodoro-handlers.ts`
- [ ] Create `src/main/ipc/goal-handlers.ts`
- [ ] Create `src/main/ipc/settings-handlers.ts`
- [ ] Create `src/main/ipc/module-handlers.ts`
- [ ] Create `src/main/ipc/search-handlers.ts` — receives query, sends to worker, returns results
- [ ] Create `src/main/ipc/notification-handlers.ts`
- [ ] Create `src/main/ipc/identity-handlers.ts`
- [ ] Create `src/main/ipc/index.ts` — calls `register*Handlers()` for each domain at app startup

### Renderer IPC Service Adapter

- [ ] Create `src/renderer/services/ipc.ts`
  - Typed wrappers around `window.electron.invoke()`:
    `invoke<T>(channel: string, payload?: unknown): Promise<IpcResult<T>>`
  - All Zustand stores call through this adapter — never `window.electron.invoke()` directly
  - Handles error unwrapping: `if (!result.ok) throw new Error(result.error)`

### Application Service Layer

One service per domain. Validation happens in domain functions called from here. Cross-domain coordination happens here.

- [ ] Create `src/main/services/task/TaskService.ts`
  - `create(payload)`: `validateCreate` → `identityRepo.get()` → `taskRepo.create()` → notify worker to index → return task
  - `update(id, fields)`: `validateUpdate` → `taskRepo.update()` → notify worker to re-index → return task
  - `complete(id)`: `taskRepo.complete()` → if recurring: `recurrence.nextOccurrence()` → `taskRepo.create()` next instance
  - `star(id)`: `taskRepo.star()` or `taskRepo.unstar()`
  - `trash(id)`: `taskRepo.trash()` → cancel scheduled reminders for this task
  - `addToMyDay(id)`: `taskRepo.addToMyDay(id, today)`
  - `moveToList(id, listId)`: `taskRepo.update(id, { list_id: listId })`
  - `makeSubtask(id, parentId)`: validate no cycle → `taskRepo.update(id, { parent_task_id: parentId })`
  - `promoteToTask(id)`: `taskRepo.update(id, { parent_task_id: null })`
- [ ] Create `src/main/services/list/ListService.ts`
- [ ] Create `src/main/services/project/ProjectService.ts`
- [ ] Create `src/main/services/tag/TagService.ts`
- [ ] Create `src/main/services/reminder/ReminderService.ts`
  - `schedule(reminder)`: sets a Node.js `setTimeout` — ID stored for later cancellation
  - `processOverdueAtStartup()`: fires any reminders that triggered while app was closed
  - `rescheduleAfterSleep()`: called on `powerMonitor.on('resume')`
  - `snooze(id, until)`: cancel existing timer, set new `setTimeout`, update DB
  - `cancel(id)`: clear `setTimeout`, mark triggered in DB
- [ ] Create `src/main/services/notification/NotificationService.ts`
  - `send(type, title, body, taskId?)`: fires OS notification (Electron `Notification` API), records to `notification_history`
  - Actionable notifications: "Complete ✓" and "Snooze 15min" actions in the notification
- [ ] Create `src/main/services/settings/SettingsService.ts`
  - `applyTheme(theme)`: update DB + emit IPC to renderer to set `data-theme` on `<html>`
  - `applyLoginItem(enabled)`: `app.setLoginItemSettings({ openAtLogin: enabled })`
  - `applyAccentColor(hex)`: emit IPC to renderer → renderer updates CSS variables

### Worker Thread

- [ ] Create `src/worker/worker-main.ts` — entry point; `parentPort.on('message', dispatch)`
- [ ] Create `src/main/services/worker-manager.ts` — spawns worker; exposes `send(type, payload)` and handles replies
- [ ] Create `src/worker/search/SearchWorker.ts`
  - Opens its own `better-sqlite3` connection (read-only)
  - Handles `SEARCH_QUERY` messages — FTS5 query → results back to main process
  - Target: < 150ms per query (PERFORMANCE.md)
- [ ] Create `src/worker/file-processor/FileProcessor.ts`
  - Handles file copy (attachment upload), thumbnail generation for images

### Main Process Entry + Startup Sequence

- [ ] Create `src/main/startup.ts`
  - Run migrations synchronously first (must complete before anything else)
  - `await Promise.all([loadActiveList(), initSearchWorker(), loadSettings(), loadModules()])` — parallel (PERFORMANCE.md §3)
  - Build `StartupPayload` — `{ lists, activeTasks (first 50), settings, modules, identity }`
  - Make available to `IPC.APP.GET_STARTUP_DATA` handler immediately — no "loading" state on open
- [ ] Create `src/main/main.ts`
  - `app.on('ready')`: run startup → register all IPC handlers → create BrowserWindow (hidden) → spawn worker
  - `app.on('window-all-closed')`: do NOT quit on non-macOS; keep alive in tray
  - `app.on('memory-pressure')`: clear caches, emit `IPC.APP.TRIM_MEMORY` to renderer (PERFORMANCE.md §15)
  - `powerMonitor.on('resume')`: `reminderService.rescheduleAfterSleep()`

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 3 complete: Full IPC contract, service layer, worker thread, parallel startup sequence."
- [ ] Commit: `"Phase 3 complete: Process architecture and IPC contract layer"`

---

## PHASE 4: Electron Window Infrastructure & Warm Start (Week 6)

> These tasks make OS11 feel like a native app.
> Every performance metric from PERFORMANCE.md must be verified before this phase closes.

### Main Window (Hidden on Create)

- [ ] Create `src/main/window/main-window.ts`
  - `new BrowserWindow({ show: false, ... })` — never shown on create (PERFORMANCE.md §1)
  - Security config: `contextIsolation: true, nodeIntegration: false, sandbox: true`
  - `win.on('close', (e) => { e.preventDefault(); win.hide(); })` — hide on close, never destroy
  - `win.show()` only when user triggers via global shortcut / tray / omnibar
  - Custom titlebar: `titleBarStyle: 'hiddenInset'` on macOS; `frame: false` + custom titlebar on Windows/Linux

### Splash Screen (Cold Start Coverage)

- [ ] Create `src/main/window/splash-window.ts` — transparent, frameless, `alwaysOnTop: true` (PERFORMANCE.md §2)
- [ ] Create `src/splash/splash.html` + `src/splash/splash.css`
  - No JS bundle, no framework, no Vite
  - Logo + minimal CSS animation — renders before Chromium finishes loading the main bundle
  - `mainWindow.once('ready-to-show', () => { splash.destroy(); mainWindow.show(); })`

### Omnibar Window

- [ ] Create `src/main/window/omnibar-window.ts`
  - Frameless, `alwaysOnTop: true`, centered on active monitor
  - `show: false` at startup
  - `win.on('blur', () => win.hide())` — closes on click-outside
  - Receives theme setting from main process via IPC → sets `data-theme` on render

### System Tray

- [ ] Create `src/main/tray/tray.ts`
  - Tray icon with today's pending task count badge (updated whenever tasks change)
  - Context menu: Open OS11 / Quick Add (→ open Omnibar) / Today's Tasks / Pomodoro controls / Quit
  - macOS: menu bar icon; Windows/Linux: system tray icon
  - Active Pomodoro session: tray icon shows 🍅 + countdown time

### Global Shortcuts (OS-Level)

- [ ] Register in `src/main/main.ts` via `globalShortcut.register()`:
  - `Ctrl+Shift+Space` (Win/Linux) / `Cmd+Shift+Space` (Mac) → show and focus main window
  - `Ctrl+Space` / `Cmd+Space` → show Omnibar
  - `Ctrl+N` / `Cmd+N` → show main window + focus quick-add input
  - `Ctrl+Shift+H` → toggle app visibility
- [ ] Unregister all on `app.on('will-quit')` — required by Electron

### Login Item (Launch at Login)

- [ ] `app.setLoginItemSettings({ openAtLogin: true })` applied on first launch (default per SCHEMA.md `launch_at_login`)
- [ ] Wired to `SettingsService.applyLoginItem(enabled)` — controlled via Settings → "Launch at Login" toggle
- [ ] Starts minimized to tray on login — no window shown

### Always on Top

- [ ] Toggle button in Titlebar component
- [ ] `Ctrl+Shift+T` shortcut
- [ ] `win.setAlwaysOnTop(true)` / `win.setAlwaysOnTop(false)` via IPC from renderer
- [ ] Opacity control (50%–100%) when "Always on Top" is active
- [ ] State saved in `settings` table (`always_on_top`, `always_on_top_opacity`)

### Auto-Updater

- [ ] Create `src/main/services/updater.ts` using `electron-updater`
  - Check for updates on startup (background, non-blocking)
  - Download update in background
  - Emit IPC to renderer when update is ready → renderer shows changelog highlight (not a modal)
  - GitHub Releases as the update source

### Performance Validation (Must Pass Before Phase Closes)

- [ ] Warm-start time: `win.show()` perceived < 30ms — measure with `console.time()` / `win.webContents.on('did-finish-load')`
- [ ] Cold-start time: < 1.5 seconds to interactive — measure with Playwright
- [ ] Initial JS bundle: run `npm run analyze` → verify < 200KB gzipped
- [ ] Initial CSS: verify < 30KB
- [ ] Confirm lazy chunks are present and not in the initial bundle: Dashboard, Agenda, Projects, Settings, Pomodoro

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 4 complete: Window infrastructure, tray, global shortcuts, splash, warm-start performance verified."
- [ ] Commit: `"Phase 4 complete: Electron window infrastructure and performance baseline"`

---

## PHASE 5: Core Task Management (Weeks 7-9)

> The most important phase. Every other feature sits on top of this.
> A TaskCard that re-renders unnecessarily fails the < 30ms interaction target.

### Zustand Task Store

- [ ] Create `src/renderer/stores/taskStore.ts`
  - Shape: `tasksById: Record<string, Task>` — keyed by ID, NOT an array (PERFORMANCE.md §12)
  - Ordered list for rendering is a derived selector computed from the keyed map
  - Selectors: `useTask(id)`, `useTasksByList(listId)`, `useMyDay()`, `useImportant()`, `usePlanned()`
  - Actions: `loadTasks`, `appendTasks`, `optimisticUpdate(id, fields)`, `optimisticDelete(id)`, `rollbackUpdate(id, previousState)`, `loadMore`
  - Optimistic update pattern (PERFORMANCE.md §11): update store immediately → fire IPC → on failure, `rollbackUpdate` + show error toast

### Task Card Component

- [ ] Create `src/renderer/features/tasks/TaskCard.tsx` + `.module.css`
  - Apply `React.memo` — re-renders only when `tasksById[task.id]` changes (PERFORMANCE.md §16)
  - Subscribe to: `const task = useTask(task.id)` — not `useTaskStore()`
  - **Layer 1 (always visible):** Checkbox + title
  - **Layer 2 (hover/focus):** Due date chip, tag dots, subtask count badge, action row
  - **Layer 3:** Click title or action row "Open" → opens DetailPanel
  - Priority: left border color only — `var(--priority-{level})` token, no badge, no label
  - Critical priority: CSS `@keyframes` pulse on the left border (respects `prefers-reduced-motion`)
  - Tags: small colored dots using `var(--tag-{color})` tokens — not chips (chips are in the detail panel)
  - Pomodoro count: "🍅 ×3" shown only when `pomodoro_count > 0`
  - Attachment count: small paperclip icon + count when attachments exist
  - Empty fields: render nothing — no due date = no date field rendered at all
  - Completion animation: spring-scale + title strikethrough via `var(--ease-spring)`

### Task List with Virtual Scrolling

- [ ] Create `src/renderer/features/tasks/TaskList.tsx` + `.module.css`
  - `@tanstack/react-virtual` mandatory — no exceptions (PERFORMANCE.md §9)
  - `estimateSize: () => 44` — `var(--task-height-comfortable)`; updates to 34 or 56 with density class
  - `overscan: 10` — render 10 items above/below the visible viewport
  - `useTransition` for list switches — current list stays visible while next list loads (PERFORMANCE.md §16)
  - `useDeferredValue` for sort/filter changes — list never blocks input
  - `useInfiniteTaskLoader` hook: triggers `loadMore()` when overscan approaches end of loaded data

### Task Detail Panel

- [ ] Create `src/renderer/features/tasks/DetailPanel.tsx` + `.module.css`
  - Right-side drawer — `var(--detail-panel-width)`: 320px
  - Framer Motion: `AnimatePresence` + `initial={{ x: 320 }}` `animate={{ x: 0 }}` — slide in/out, < 200ms, `ease-out`
  - Sections (Notes, Subtasks, Attachments, Reminders, Recurrence) collapsed by default; each expands individually
  - Empty sections: render nothing — not a collapsed empty header
  - Notes editor: `@tiptap/react` + `@tiptap/starter-kit` — bold, italic, bullets, inline code, links, images
  - Notes are sanitized via `DOMPurify` on every write before IPC → SQLite (ARCHITECTURE.md security rules)
  - Keyboard: `Escape` closes the panel

### Task CRUD

- [ ] Task creation — three entry points, one IPC path:
  - Quick Add bar at top of list
  - `Enter` when no task is selected (cursor goes to end of list)
  - Omnibar (Phase 7 wires NLP; here handle plain title)
  - Flow: input → `taskStore.optimisticUpdate` (pending state) → IPC `TASKS.CREATE` → on success, replace pending task with real task
- [ ] Task completion:
  - Checkbox click → `taskStore.optimisticUpdate(id, { is_completed: 1 })` → IPC `TASKS.COMPLETE`
  - If recurring: service generates next occurrence automatically
  - Completed tasks collapse into "Completed" section at bottom of list (collapsible)
- [ ] Task deletion (FEEL UI — no aggressive modal, no friction):
  - Delete → `taskStore.optimisticDelete(id)` → IPC `TASKS.TRASH` (moves to trash, not permanent)
  - Undo toast (5 seconds) — clicking Undo calls `TASKS.RESTORE`
  - After 30 days in trash, tasks are permanently purged automatically
- [ ] Task inline editing:
  - Click title → title becomes editable `input`, focused immediately → `Enter` saves, `Escape` cancels
  - Click due date chip → opens `DatePicker` popover, closes on selection (no OK button)
  - Click priority dot → 5-option inline picker (None / Low / Medium / High / Critical)
- [ ] Task starring: `Ctrl+I` or star icon on card → `TASKS.STAR`
- [ ] Task duplication: copies all fields, appends " (Copy)" to title
- [ ] Subtask creation:
  - `Tab` inside a task → creates indented subtask below with cursor ready
  - Subtask inherits parent's list, tags (per Feature Spec §3.4 smart defaults)
  - `Shift+Tab` → promotes subtask to standalone task in the same list
  - Subtask count shows on parent card: "2/5" (completed/total)

### Undo / Redo System

- [ ] Create `src/renderer/hooks/useUndoRedo.ts`
  - Application-wide `Ctrl+Z` / `Ctrl+Y` — not just text editing
  - Per-session action stack: records `{ action, undoFn, redoFn }` for every destructive operation
  - Max 100 entries (oldest dropped when exceeded)
  - Every destructive action triggers an undo toast via `Toast` component (5-second window)
  - Undo: calls `undoFn()` → reverses the IPC call and store update

### Sorting & Filtering

- [ ] Create `src/renderer/features/tasks/TaskListHeader.tsx` + `.module.css`
  - FEEL UI: when no filters are active, shows only a subtle filter icon — does not occupy permanent space
  - Click icon → filter/sort row expands
  - Sort by: Due date, Priority, Alphabetical, Creation date, Manual (drag)
  - Filter by: Tag, Priority, Due date range, Incomplete only, Has attachments
- [ ] Create `src/renderer/hooks/useFilteredTasks.ts`
  - Takes active filters/sort config → returns filtered + sorted task ID list
  - `useMemo` on filter config — does not recompute unless filters change

### Governance Update

- [ ] Update UTILITIES.md: `TaskCard`, `TaskList`, `DetailPanel`, `useTask`, `useFilteredTasks`, `useUndoRedo`, `useInfiniteTaskLoader`
- [ ] CHANGELOG_INTERNAL.md: "Phase 5 complete: Core task CRUD, virtual list, detail panel, optimistic updates, undo, filtering."
- [ ] Commit: `"Phase 5 complete: Core task management"`

---

## PHASE 6: Lists, Smart Lists & My Day (Weeks 9-10)

### Zustand List Store

- [ ] Create `src/renderer/stores/listStore.ts`
  - `listsById: Record<string, List>`, `orderedIds: string[]`
  - `activeListId: string` — which list is currently shown
  - Smart lists (My Day, Important, Planned, All Tasks, Completed) seeded from DB; never deleted
  - Actions: `loadLists`, `setActiveList`, `createList`, `updateList`, `deleteList`, `reorderLists`

### Sidebar

- [ ] Create `src/renderer/features/sidebar/Sidebar.tsx` + `.module.css`
  - Width: `var(--sidebar-width)` (224px), min 180px, max 280px — resizable via drag handle
  - Surface: `var(--surface-sidebar)` (#F0EFEC light / #181719 dark)
  - List items: name + optional emoji icon; pending count badge only when non-zero (FEEL UI)
  - Smart lists grouped under "Smart Lists" collapsible header — collapsed by default
  - Disabled modules: absent from sidebar entirely — not greyed out; check `moduleStore.isEnabled()` before rendering
  - Active list: `var(--surface-selected)` background
  - Hover: `var(--surface-hover)` background
  - "+" button at bottom → create new list inline
  - Drag to reorder user lists (within their section — not mixing with smart lists)
- [ ] Create `src/renderer/features/sidebar/ListItem.tsx` + `.module.css`
  - `React.memo` — only re-renders when this list's data changes
- [ ] Create `src/renderer/features/sidebar/SmartListGroup.tsx` + `.module.css`

### List Management

- [ ] Create `src/renderer/features/lists/CreateListModal.tsx` — name, emoji icon, accent color
- [ ] Create `src/renderer/features/lists/ListContextMenu.tsx`
  - Right-click list in sidebar → Rename, Change color/icon, Duplicate, Export, Sort options, Set background, Delete
- [ ] Create `src/renderer/features/lists/ListGroupModal.tsx` — create and manage list groups (folders)
- [ ] Implement per-list background theming:
  - Solid color: CSS `background-color` override on the task list content area
  - Gradient: CSS `background: linear-gradient(...)`
  - Custom image: stored in `userData/backgrounds/`, loaded as CSS `background-image`
  - Background blur control: CSS `backdrop-filter: blur()` on the list content layer over the image

### Smart List Queries

- [ ] Wire `TaskRepository` smart list methods to IPC handlers: `TASKS.GET_MY_DAY`, `TASKS.GET_IMPORTANT`, `TASKS.GET_PLANNED`, `TASKS.GET_ALL`, `TASKS.GET_COMPLETED`
- [ ] Each smart list updates dynamically when tasks change — task store actions emit to the relevant smart list store selector

### My Day

- [ ] Create `src/renderer/features/lists/MyDayView.tsx` + `.module.css`
  - Header: date + optional weather chip (if calendar integration or OS weather API enabled — optional module)
  - "Add to My Day" suggestion panel: surfaces tasks due today + upcoming high-priority, one tap to add
- [ ] Create `src/renderer/features/lists/RolloverPrompt.tsx` + `.module.css`
  - Triggered on first open of the day when `my_day_date < today` tasks exist
  - Framer Motion: slide-up from bottom, `AnimatePresence`
  - Actions: "Keep All" / "Dismiss All" / per-task checkboxes for cherry-picking

### Governance Update

- [ ] Update UTILITIES.md: `Sidebar`, `ListItem`, `listStore`, `SmartListGroup`, `RolloverPrompt`
- [ ] CHANGELOG_INTERNAL.md: "Phase 6 complete: Lists, smart lists, sidebar, My Day, rollover prompt."
- [ ] Commit: `"Phase 6 complete: Lists, smart lists, My Day"`

---

## PHASE 7: Quick Add, NLP Parsing & Keyboard-First Design (Weeks 10-11)

### Quick Add Bar (In-App)

- [ ] Create `src/renderer/features/quickadd/QuickAddBar.tsx` + `.module.css`
  - Always visible at top of task list: height `var(--quick-add-height)` (52px), radius `var(--radius-xl)`
  - `Ctrl+N` / `Cmd+N` focuses it from anywhere in the app
  - On submit → send raw input to `IPC.NLP.PARSE` → receive `ParsedTaskInput` → show parse preview chip → user confirms → `IPC.TASKS.CREATE`
  - Live parse preview chip updates as user types: shows parsed date, tag, priority, list assignment
- [ ] Create `src/renderer/features/quickadd/ParsePreviewChip.tsx` + `.module.css`
  - Shown below the input, disappears when input is empty
  - Not interactive — just a visual confirmation of what will be created

### Omnibar UI (in the Omnibar BrowserWindow)

- [ ] Create `src/renderer/features/omnibar/OmnibarView.tsx` + `.module.css`
  - Rendered in the separate omnibar `BrowserWindow`
  - Same NLP input + parse preview chip as Quick Add Bar
  - Additional modes (Tab to switch): Add Task / Search Tasks / Open List / Start Pomodoro
  - `Escape` → hides window

### NLP Parsing Wired to IPC

- [ ] Add `IPC.NLP.PARSE` handler in main process: calls `nlp.parseQuickAdd(input)`, returns `ParsedTaskInput`
- [ ] Full quick-add syntax supported (Feature Spec §5.4):
  - `#work` → assign tag "work" (creates tag if not exists)
  - `@personal` → assign to list named "personal" (fuzzy match)
  - `!high` / `!low` / `!medium` / `!critical` → set priority
  - `🍅` → mark Pomodoro requested (linked session starts after creation)
  - Natural date strings: "tomorrow 2pm", "next Monday", "in 3 days", "end of month"
  - Recurrence: "every Sunday", "every weekday at 9am" → RRULE via `rrule` domain function

### All In-App Keyboard Shortcuts

- [ ] Create `src/renderer/hooks/useKeyboardShortcuts.ts`
  - Global `keydown` listener on the main window
  - All shortcuts from Feature Spec §5.2 wired to store actions or IPC calls:
    - `↑ ↓` → move task focus up/down
    - `Space` / `Ctrl+Enter` → complete focused task
    - `Enter` / `F2` → edit focused task title inline
    - `Delete` / `Backspace` → trash focused task (undo toast appears)
    - `Ctrl+I` → star/unstar focused task
    - `Tab` → create subtask below focused task
    - `Shift+Tab` → promote subtask to task
    - `Ctrl+Shift+M` → open Move to List picker
    - `Ctrl+D` → open DatePicker on focused task
    - `Ctrl+T` → open TagPicker on focused task
    - `Ctrl+F` / `/` → focus search input
    - `Ctrl+1` – `Ctrl+9` → switch to list by sidebar position
    - `Ctrl+P` → open Pomodoro
    - `Ctrl+Shift+D` → open Dashboard
    - `Ctrl+K` → open Command Palette
    - `Ctrl+Z` / `Ctrl+Y` → undo/redo
    - `Ctrl+A` → select all tasks in current list
    - `Ctrl+Shift+L` → toggle dark/light mode
    - `Ctrl+Shift+T` → toggle Always on Top
    - `Ctrl+Shift+F` → enter Focus Mode

### Vim Mode (Optional Module)

- [ ] Create `src/renderer/hooks/useVimMode.ts`
  - Activated only when `moduleStore.isEnabled('vim_keybindings')` is true
  - `j/k` → move up/down, `gg/G` → top/bottom, `dd` → trash, `cc` → complete, `ss` → star, `o` → open detail

### Command Palette

- [ ] Create `src/renderer/features/command-palette/CommandPalette.tsx` + `.module.css`
  - `Ctrl+K` → Spotlight-style overlay; Z-index `var(--z-modal)` (400)
  - Fuzzy search across: tasks, lists, actions, settings
  - Recent actions shown at top when input is empty
  - Groups: Tasks / Lists / Actions / Settings
  - Keyboard navigation: `↑ ↓` to navigate, `Enter` to execute, `Escape` to close
  - Framer Motion: `AnimatePresence` scale + opacity enter, < 150ms

### Search

- [ ] Create `src/renderer/features/search/SearchView.tsx` + `.module.css`
  - `Ctrl+F` / `/` → opens inline at top of task list (not a modal)
  - Input wrapped in `useDeferredValue` — typing does not block task list render (PERFORMANCE.md §16)
  - IPC → worker thread → FTS5 query → results in < 150ms
  - Results virtualized (PERFORMANCE.md §9)
  - Each result: task title + list name + matched snippet from `notes`
  - `Escape` → close search, restore normal list view
- [ ] Create `src/renderer/stores/searchStore.ts` — `query: string`, `results: TaskSearchResult[]`, `isSearching: boolean`

### Governance Update

- [ ] Update UTILITIES.md: `QuickAddBar`, `ParsePreviewChip`, `OmnibarView`, `CommandPalette`, `SearchView`, `useKeyboardShortcuts`, `useVimMode`, `searchStore`
- [ ] CHANGELOG_INTERNAL.md: "Phase 7 complete: Quick Add, Omnibar, NLP parsing, all keyboard shortcuts, command palette, search."
- [ ] Commit: `"Phase 7 complete: Quick Add, NLP, keyboard-first design"`

---

## PHASE 8: Drag-and-Drop, Context Menus & Multi-Select (Weeks 11-12)

### @dnd-kit Integration

- [ ] Wrap `TaskList` in `DndContext` + `SortableContext` from `@dnd-kit`
- [ ] `@dnd-kit` owns the drag detection and drop logic; Framer Motion owns the animation — they do not overlap
- [ ] Implement all drag targets from Feature Spec §3.1:

  | Drag action | Implementation |
  |---|---|
  | Task → Task (drop on top) | `TaskService.makeSubtask(draggedId, targetId)` |
  | Task → Sidebar List | `TaskService.moveToList(draggedId, targetListId)` |
  | Task → "My Day" in sidebar | `TaskService.addToMyDay(draggedId)` |
  | Task → Section header (project) | `TaskService.update(draggedId, { section_id })` |
  | Subtask → outside parent | `TaskService.promoteToTask(draggedId)` |
  | File → Task card | `AttachmentService.upload(file, taskId)` |
  | Reorder within list | `fractionalIndex.between()` → `TaskService.updateSortOrder()` |

- [ ] Drop target indicators: visible on active drag via Framer Motion `opacity` transitions
- [ ] Every drag triggers an undo entry in `useUndoRedo`
- [ ] Drag feedback: `< 16ms` pointer-event response (PERFORMANCE.md target)
- [ ] Test: dragging 50 tasks rapidly to reorder — no jank

### Context Menu

- [ ] Create `src/renderer/features/tasks/TaskContextMenu.tsx` + `.module.css`
  - Right-click any task card → context menu at cursor position
  - Z-index: `var(--z-dropdown)` (100)
  - All actions from Feature Spec §3.2:
    - Complete / Uncomplete
    - Star / Unstar
    - Set due date (inline DatePicker popover)
    - Set priority (inline 5-option picker)
    - Add to My Day / Remove from My Day
    - Move to list (inline list picker)
    - Add tag (inline TagPicker)
    - Duplicate task
    - Create subtask
    - Open detail panel
    - Delete (triggers undo toast)
  - All sub-pickers are popovers — no detail panel required for any of these
  - `Escape` closes the menu; click outside closes the menu

### Multi-Select & Bulk Operations

- [ ] Hover any task → subtle multi-select checkbox appears on the left
- [ ] Click checkbox → enter multi-select mode; all tasks show checkboxes
- [ ] `Ctrl+Click` / `Shift+Click` for range selection
- [ ] `Ctrl+A` → select all tasks in current list
- [ ] Create `src/renderer/stores/selectionStore.ts` — `selectedIds: Set<string>`, `isMultiSelectActive: boolean`
- [ ] Create `src/renderer/features/tasks/BulkActionBar.tsx` + `.module.css`
  - Framer Motion: `AnimatePresence` slide-up from bottom when multi-select is active, slide-down on exit
  - Actions: Complete, Delete, Move to List, Add Tag, Set Priority, Add to My Day
  - Shows "X tasks selected" count
  - `Escape` → exit multi-select mode

### Inline Date Picker

- [ ] Create `src/renderer/components/DatePicker/DatePicker.tsx` + `.module.css`
  - Compact inline popover — not a full-screen modal (FEEL UI)
  - Quick options: Today, Tomorrow, Next Week, No Date
  - Calendar grid for custom selection
  - Time input: 15-minute slot grid or free-form text (parsed with `chrono-node`)
  - All-day vs specific-time toggle
  - Closes immediately on date selection — no OK button (FEEL UI)
  - Natural language input at top of popover: "next Friday" → auto-selects in grid

### Governance Update

- [ ] Update UTILITIES.md: `TaskContextMenu`, `BulkActionBar`, `DatePicker`, `selectionStore`
- [ ] CHANGELOG_INTERNAL.md: "Phase 8 complete: All drag-and-drop targets, context menu, multi-select, bulk operations, inline date picker."
- [ ] Commit: `"Phase 8 complete: Drag-and-drop, context menus, multi-select"`

---

## PHASE 9: Tags, Priority & Notification Center (Week 12)

### Tag System

- [ ] Create `src/renderer/stores/tagStore.ts` — `tagsById: Record<string, Tag>`, lazy loaded on first tag use
- [ ] Create `src/renderer/features/tags/TagPicker.tsx` + `.module.css`
  - Inline popover (triggered by `Ctrl+T` or clicking tag area on card)
  - Existing tags listed with color dots; fuzzy search within tags
  - Create new tag inline — name + color selection (12-color palette from tokens)
  - Nested tag support: display `work/client/Acme` as hierarchical tree
  - `Escape` closes; `Enter` or click applies selected tag
- [ ] Create `src/renderer/features/tags/TagView.tsx` + `.module.css`
  - Click any tag in sidebar or tag dot on task card → opens Tag View
  - All tasks with this tag across all lists, virtualized
  - Header: tag color dot + tag name + task count
- [ ] Create `src/renderer/features/tags/TagManager.tsx` — in Settings
  - List all tags with edit / rename / recolor / delete controls
  - Merge tags: combine two tags → batch updates all `task_tags` entries
  - Nested tags: parent tag picker when editing
- [ ] Auto-tag rules (Settings → Tags, optional): "tasks in list [X] → auto-tag #[tag]"
  - Stored as a setting key/value; applied in `TaskService.create()` after list assignment

### Priority Display

- [ ] Left border color only — no badge, no label, no icon (FEEL UI)
- [ ] Critical priority: pulsing CSS `@keyframes` animation on the left border
  - `@media (prefers-reduced-motion: reduce)` disables the animation
- [ ] Overdue + high/critical priority: red due date chip (text color `var(--color-danger)`)

### In-App Notification Center

- [ ] Create `src/renderer/features/notifications/NotificationCenter.tsx` + `.module.css`
  - Bell icon in Titlebar; badge count of unread notifications
  - Framer Motion: `AnimatePresence` slide-in panel from the right (not a modal)
  - All notification types shown: due, reminder, pomodoro, agenda, goal, streak
  - Grouped by date (Today, Yesterday, Earlier)
  - Each item: mark read on click → focuses the relevant task
  - "Mark All Read" button at top
  - Virtualized — can hold unlimited history
- [ ] Create `src/renderer/stores/notificationStore.ts` — `items: NotificationHistoryItem[]`, `unreadCount: number`

### Governance Update

- [ ] Update UTILITIES.md: `TagPicker`, `TagView`, `TagManager`, `NotificationCenter`, `tagStore`, `notificationStore`
- [ ] CHANGELOG_INTERNAL.md: "Phase 9 complete: Full tag system (nested, merge, auto-tag), notification center."
- [ ] Commit: `"Phase 9 complete: Tags, priority, notification center"`

---

## PHASE 10: Project Management (Weeks 13-15)

> Five separate view modes. The most complex phase visually.
> Projects lazy chunk — not in the initial bundle.

### Zustand Project Store

- [ ] Create `src/renderer/stores/projectStore.ts`
  - `projectsById: Record<string, Project>`, `sectionsById: Record<string, Section>`
  - `milestonesById: Record<string, Milestone>`, `dependenciesByTaskId: Record<string, string[]>`
  - Actions: `loadProjects`, `createProject`, `archiveProject`, `createSection`, `reorderSections`

### Project List View (Baseline)

- [ ] Create `src/renderer/features/projects/ProjectListView.tsx` + `.module.css`
  - Tasks grouped by section; each section has a collapsible header
  - Add task inline within a section: press `Enter` at bottom of section
  - Drag tasks between sections via `@dnd-kit`
  - Project overview ring (completion %) in project header
  - Completed task count / total shown per section
  - Activity feed below all sections

### Project Board View (Kanban)

- [ ] Create `src/renderer/features/projects/ProjectBoardView.tsx` + `.module.css`
  - Columns map to sections in the project
  - `@dnd-kit` for card drag between columns — Framer Motion for landing animation
  - Horizontal scroll for many columns
  - "Add Column" button at the far right
  - Column header: section name + task count + completion ring

### Project Timeline View (Gantt)

- [ ] Create `src/renderer/features/projects/ProjectTimelineView.tsx` + `.module.css`
  - Horizontal bar per task: position = `due_date`, width = `estimated_minutes`
  - Drag to reschedule: drag the bar to a new date → `TASKS.UPDATE` with new `due_date`
  - Milestones: diamond markers (`milestones` table) — click to complete/uncomplete
  - Task dependencies: arrows connecting dependent tasks (from `task_dependencies`)
  - Zoom controls: Day / Week / Month / Quarter view
  - Today line: vertical rule showing current date

### Project Calendar View

- [ ] Create `src/renderer/features/projects/ProjectCalendarView.tsx` + `.module.css`
  - Monthly calendar grid
  - Tasks plotted by `due_date` — click a date cell → expand to show tasks
  - Drag task between dates → reschedules due date
  - Today cell highlighted with `var(--accent-muted)` background

### Project Table View (Spreadsheet)

- [ ] Create `src/renderer/features/projects/ProjectTableView.tsx` + `.module.css`
  - One row per task; columns: Title, Due Date, Priority, Tags, Estimated Time, Status, Assignee (Phase 2)
  - All fields editable inline (click cell → edit in place)
  - Column resize, column show/hide
  - Sort by any column header click

### View Switcher

- [ ] Create `src/renderer/features/projects/ViewSwitcher.tsx`
  - List / Board / Timeline / Calendar / Table — one click each
  - Active view persisted per project in `projects.default_view`
  - Framer Motion: crossfade between views, < 200ms

### Project Features

- [ ] Task dependencies: "Depends on" field in detail panel; arrow overlay in Timeline view; circular dependency check before insert
- [ ] Milestones: create in Timeline view or from project header; shown as diamond markers
- [ ] Project overview: progress ring (% tasks completed) + task counts (total / completed / overdue)
- [ ] Activity feed: audit log of project changes — derived from `notification_history` filtered by project tasks
- [ ] Project templates: export project structure (sections + placeholder tasks, no dates) as a reusable template
- [ ] Project export: CSV (task list), Markdown (outline), PDF (`webContents.printToPDF()`)

### Governance Update

- [ ] Update UTILITIES.md: `ViewSwitcher`, `ProjectListView`, `ProjectBoardView`, `ProjectTimelineView`, `ProjectCalendarView`, `ProjectTableView`, `projectStore`
- [ ] CHANGELOG_INTERNAL.md: "Phase 10 complete: Full project management — 5 views, dependencies, milestones, templates, export."
- [ ] Commit: `"Phase 10 complete: Project management"`

---

## PHASE 11: Scheduling, Recurrence & Reminders (Weeks 15-16)

### Recurrence Engine (Fully Wired)

- [ ] `RecurrencePicker.tsx` component (referenced in Phase 2 domain, now built):
  - Pre-sets: Daily, Weekdays, Weekly, Monthly, Yearly
  - Custom rule builder: "every 2 weeks on Tuesday and Thursday"
  - Natural language preview updates in real time via `humanReadableRRule()`
  - "After completion" toggle: `recurrence_basis = 'after_completion'`
  - Skip occurrence: complete without generating next
- [ ] `TaskService.complete()` generates next occurrence correctly in all scenarios:
  - Fixed recurrence: next date = rule expansion from `due_date`
  - After-completion recurrence: next date = today + interval
  - Verifies: new task record gets all parent fields except `is_completed`, `completed_at`, `my_day_date`, `pomodoro_count`

### Reminder System (Fully Wired)

- [ ] `ReminderService.processOverdueAtStartup()` fires on every app open:
  - Queries `reminders WHERE is_triggered = 0 AND remind_at <= now`
  - Fires OS notification for each immediately, marks triggered
- [ ] `powerMonitor.on('resume')` calls `ReminderService.rescheduleAfterSleep()` — re-sets all pending `setTimeout` timers
- [ ] Multiple reminders per task: "1 day before + 1 hour before + at due time"
- [ ] Snooze from OS notification (actionable buttons):
  - "Snooze 15min" → `ReminderService.snooze(id, now + 15min)`
  - "Snooze 1hr" → `ReminderService.snooze(id, now + 1hr)`
  - "Snooze tomorrow morning" → `ReminderService.snooze(id, tomorrow 8am)`
- [ ] Create `src/renderer/features/tasks/ReminderEditor.tsx` + `.module.css`
  - In detail panel: add multiple reminders with date + time
  - Shows list of upcoming reminders for the task with delete controls

### Calendar Integration (Optional Module)

- [ ] Create `src/main/services/calendar/CalendarService.ts` — gated by `moduleStore.isEnabled('calendar_integration')`
  - Google Calendar: OAuth2 local-loopback redirect (no cloud SDK — raw HTTP to Google APIs)
  - Apple Calendar: CalDAV protocol
  - Outlook: Microsoft Graph API via local OAuth2
  - Read calendar events and show in Agenda view alongside tasks
  - Optional two-way sync: create calendar event from task's `due_date` + `due_time`
- [ ] Module disabled by default; enabled in Settings → Modules → Calendar Integration

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 11 complete: Recurrence fully wired, reminder scheduling with snooze, calendar integration."
- [ ] Commit: `"Phase 11 complete: Scheduling, recurrence, reminders"`

---

## PHASE 12: Pomodoro & Custom Timer (Week 16)

### Zustand Pomodoro Store

- [ ] Create `src/renderer/stores/pomodoroStore.ts`
  - `activeSession: { taskId | null, type, durationSeconds, elapsedSeconds, isPaused } | null`
  - `sessionCount: number` — sessions in current cycle (resets after long break)
  - `settings: { workMinutes, breakMinutes, longBreakMinutes, sessionsBeforeLongBreak, autoStart }`
  - Actions: `startSession`, `pauseSession`, `resumeSession`, `skipBreak`, `resetTimer`, `tickElapsed`

### Pomodoro View (Lazy Chunk)

- [ ] Create `src/renderer/features/pomodoro/PomodoroView.tsx` + `.module.css`
  - Circular progress ring (SVG or CSS `conic-gradient`)
  - Linked task displayed below timer — "Focus: [task title]"
  - `@dnd-kit` drop target: drag a task onto the timer widget to link it
  - Controls: Pause / Resume / Skip / Reset
  - Sound alert picker: built-in presets or custom audio file
  - Session count dots (completed: filled, remaining: outline)
  - Full-screen focus mode button: hides sidebar + task list, shows only task + timer + minimal controls

### Mini Floating Timer Window

- [ ] Create `src/main/window/timer-window.ts`
  - Small, always-on-top, draggable `BrowserWindow` — shown when a session is active, hidden otherwise
  - Displays: 🍅 + time remaining; Pause / Skip buttons
  - Closes (hides) when session ends or is reset
  - Positioned: bottom-right corner by default; position remembered per session

### Tray Integration During Session

- [ ] Tray icon text updated to show countdown: "🍅 18:45" while session is active
- [ ] Tray context menu gains: Pause / Resume / Skip during active session
- [ ] Progress ring animation on tray icon (SVG generated and sent via IPC from main)

### Session Tracking

- [ ] Each completed Pomodoro creates a `pomodoro_sessions` record (Phase 2 repo already written)
- [ ] `tasks.pomodoro_count` incremented after each completed session
- [ ] `tasks.pomodoro_count` shown on task card as 🍅 ×N only when > 0
- [ ] Long break auto-triggered after `sessionsBeforeLongBreak` sessions (default: 4)
- [ ] Distraction Blocker (optional): trigger OS "Do Not Disturb" during work sessions via Electron system API

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 12 complete: Pomodoro timer, mini window, tray countdown, session tracking, distraction blocker."
- [ ] Commit: `"Phase 12 complete: Pomodoro"`

---

## PHASE 13: Agenda & Goals (Weeks 17-18)

### Daily Agenda (Lazy Chunk)

- [ ] Create `src/renderer/features/agenda/DailyAgenda.tsx` + `.module.css`
  - Tasks due today ordered by `due_time`; overdue tasks pinned to top in red
  - Time-block slots: each hour shown as a row; tasks with `due_time` placed in their slot
  - Drag unscheduled task onto a time slot → sets `due_time` for that task
  - "Load balancing" indicator: color-coded header (green < 5 tasks / amber 5–10 / red > 10)
  - Morning summary desktop notification sent at user-configured time via `ReminderService`
- [ ] Create `src/renderer/features/agenda/WeeklyAgenda.tsx` + `.module.css`
  - 7-day scrollable column view
  - Calendar events shown alongside tasks (if calendar integration enabled)
  - Load balancing indicator per day
  - Drag tasks between days to reschedule due dates

### Goals

- [ ] Create `src/renderer/stores/goalStore.ts` — `goalsById: Record<string, Goal>`
- [ ] Create `src/renderer/features/agenda/GoalsView.tsx` + `.module.css`
  - Create goal: title, description, type (habit / milestone / outcome), target date
  - Link tasks / projects to a goal from the goal card or from task detail panel
  - Progress bar: computed from `goal_links` → linked task completion rate
  - Goal streaks: `streak_count` column shown as a flame streak indicator
  - Weekly review prompt: shown on user-configured day (Friday by default)
- [ ] Create `src/renderer/components/ProgressBar/ProgressBar.tsx` + `.module.css`
  - Height: `var(--space-1)` (4px) thin version; `var(--space-2)` (8px) standard
  - Fill: `var(--accent)` for primary goals; `var(--color-success)` for completed

### Habit Tracker (Optional Module)

- [ ] Module toggle: `habit_tracker` — disabled by default
- [ ] Create `src/renderer/features/agenda/HabitTracker.tsx` + `.module.css`
  - Mark tasks as habits in task detail panel (boolean flag — requires migration `0002_habit_flag.sql` if not in initial schema)
  - GitHub-style heatmap calendar: 52 weeks × 7 days grid of completion dots
  - Color intensity: `var(--accent-muted)` → `var(--accent)` based on completion count per day
  - Habit chain view: all habits + today's check-off status in a horizontal list

### Governance Update

- [ ] Update UTILITIES.md: `DailyAgenda`, `WeeklyAgenda`, `GoalsView`, `HabitTracker`, `ProgressBar`, `goalStore`
- [ ] CHANGELOG_INTERNAL.md: "Phase 13 complete: Daily/weekly agenda, goals with streaks, habit tracker."
- [ ] Commit: `"Phase 13 complete: Agenda and goals"`

---

## PHASE 14: Dashboard & Statistics (Weeks 18-19)

> Dashboard is a lazy chunk. Recharts loads with it — never in the initial bundle.

### Stats Aggregation (Main Process)

- [ ] Create `src/main/services/analytics/AnalyticsService.ts`
  - `getPersonalStats(from, to)`: completed count, streak (consecutive days ≥ 1 completion), avg completion time, on-time rate
  - `getMostProductiveDay()`: GROUP BY `strftime('%w', completed_at)`, count completions
  - `getMostProductiveHour()`: GROUP BY `strftime('%H', completed_at)`, count completions
  - `getCompletionsByDay(from, to)`: GROUP BY date, count → for bar chart
  - `getTasksByList()`, `getTasksByTag()`, `getTasksByPriority()` → for pie/donut chart
  - `getPomodoroStats(from, to)`: total sessions, total minutes, sessions per day
  - `getProjectStats(projectId)`: total / completed / overdue tasks, velocity (tasks/week)
  - All queries run in main process on demand — never block the renderer

### Dashboard View (Lazy Chunk)

- [ ] Create `src/renderer/features/dashboard/Dashboard.tsx` + `.module.css`
  - Opens with 4 stat cards at top: tasks completed today, current streak, on-time rate %, total focus time
  - FEEL UI: generous whitespace between charts; not a wall of numbers
  - Charts below stat cards, in order: Completion Bar → Task Distribution → Completion Trend → Activity Heatmap
  - Date range picker at top: Last 7 days / Last 30 days / Last 3 months / All time
  - On range change: re-fetches stats via IPC, shows skeleton while loading

### Charts (Recharts)

- [ ] Create `src/renderer/features/dashboard/charts/CompletionBarChart.tsx`
  - Tasks completed per day (last 30 days by default)
  - `recharts` `BarChart` — fill: `var(--accent)`, bar radius matches `var(--radius-xs)`
- [ ] Create `src/renderer/features/dashboard/charts/TaskDistributionPie.tsx`
  - Pie/donut — toggle between: By List / By Tag / By Priority
  - Colors: list colors, tag colors, or priority tokens respectively
- [ ] Create `src/renderer/features/dashboard/charts/CompletionTrend.tsx`
  - Line chart: on-time completion rate over time
  - Reference line at 100% — visual anchor
- [ ] Create `src/renderer/features/dashboard/charts/ActivityHeatmap.tsx`
  - Full-year grid: 52 weeks × 7 days
  - Color intensity from `var(--accent-muted)` → `var(--accent)` based on daily completion count
  - Tooltip on hover: "Jan 6 — 12 tasks completed"
- [ ] Create `src/renderer/features/dashboard/charts/ProjectBurndown.tsx`
  - Per-project task completion rate over time
  - Shown only when a project is selected from a dropdown

### Export

- [ ] PDF: `webContents.printToPDF({ printBackground: true })` — Dashboard rendered to PDF
- [ ] CSV: main process serializes aggregated stats arrays to CSV string → `dialog.showSaveDialog()`

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 14 complete: Full dashboard, all 5 charts, stats aggregation, PDF/CSV export."
- [ ] Commit: `"Phase 14 complete: Dashboard and statistics"`

---

## PHASE 15: File Attachments (Week 19)

### Attachment Service

- [ ] Create `src/main/services/attachment/AttachmentService.ts`
  - `upload(sourcePath, taskId)`:
    1. Copy file into `app.getPath('userData')/attachments/{taskId}/{uuid}.{ext}`
    2. Sanitize filename (no path traversal, no special characters)
    3. Insert into `attachments` table
    4. Send to worker for thumbnail generation (images only)
    5. Return `Attachment` record
  - `delete(attachmentId)`: remove DB record + delete file from disk; atomic
  - `getByTask(taskId)`: returns all attachments
  - `exportAll(destDir)`: copies all attachment files to `destDir` (for data export)

### Attachment Sources

- [ ] Local file picker: `dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })` → `AttachmentService.upload()`
- [ ] Drag file onto task card: file dropped on `@dnd-kit` task drop target → IPC `ATTACHMENTS.UPLOAD`
- [ ] Clipboard paste: `Ctrl+V` while a task is focused → check clipboard for `image/png` or `image/jpeg` → write temp file → upload
- [ ] Cloud storage links: Google Drive / Dropbox / OneDrive — stored as URL reference in `attachments.local_path` with `is_link = 1` flag (requires `0003_attachment_links.sql` migration if not in initial schema)

### Attachment Display

- [ ] Create `src/renderer/features/attachments/AttachmentStrip.tsx` + `.module.css`
  - Horizontal scroll strip inside detail panel
  - Images: thumbnail (80px height, generated by worker); click → built-in image viewer window
  - PDFs: first-page thumbnail via worker; click → `shell.openPath()` to system PDF viewer
  - Other files: file type icon + filename + size; click → `shell.openPath()`
  - Delete button on each attachment (right-click or hover reveal)
- [ ] On task card in list view: small paperclip icon + count only — no thumbnail (FEEL UI)
- [ ] Attachment search: filenames indexed in command palette → type filename → jump to task

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 15 complete: File attachments — all upload sources, thumbnail generation, display, clipboard paste."
- [ ] Commit: `"Phase 15 complete: File attachments"`

---

## PHASE 16: Theming, Settings & Module System (Weeks 19-20)

### Theme Engine

- [ ] Create `src/main/services/settings/ThemeService.ts`
  - Apply theme change: emit `IPC.APP.SET_THEME` → renderer sets `data-theme` on `<html>`
  - Auto mode: `nativeTheme.on('updated')` → re-emit `IPC.APP.SET_THEME` with current OS preference
- [ ] Apply accent color at runtime: `IPC.APP.SET_ACCENT_COLOR` → renderer calls `document.documentElement.style.setProperty('--accent', hex)` + derives `--accent-hover`, `--accent-active`, `--accent-muted`, `--accent-border`

### Background Engine

- [ ] Solid color: CSS `background-color` on task list content area
- [ ] Gradient: CSS `background: linear-gradient(direction, color1, color2, ...)`
- [ ] Built-in wallpapers: bundled JPEG/WebP files in `src/renderer/assets/backgrounds/`
- [ ] Custom image upload: stored in `userData/backgrounds/`; loaded as `background-image: url('file://')`
- [ ] Background blur: CSS `backdrop-filter: blur(Xpx)` on content layer above image
- [ ] Animated backgrounds (module `animated_backgrounds`, default off): CSS `@keyframes` — aurora, particles, gradient drift
- [ ] Per-list vs global background: `lists.background_type` / `lists.background_value` vs global `settings.background_*`

### Settings View (Lazy Chunk)

- [ ] Create `src/renderer/features/settings/SettingsView.tsx` + `.module.css`
  - Sidebar navigation within settings: General / Appearance / Keyboard / Notifications / Privacy / Modules / Advanced
  - Advanced sub-toggles within each category — hidden by default
- [ ] Create `src/renderer/features/settings/GeneralSettings.tsx` — launch at login, day starts at, quick-add default list
- [ ] Create `src/renderer/features/settings/AppearanceSettings.tsx` — theme, accent color, background, font size, font family, density, sidebar position, task card style
- [ ] Create `src/renderer/features/settings/NotificationSettings.tsx` — quiet hours, per-category toggles, notification sound
- [ ] Create `src/renderer/features/settings/PrivacySettings.tsx` — app lock, stealth mode, data deletion, "Empty Trash"
- [ ] Create `src/renderer/features/settings/KeyboardSettings.tsx` — shortcut viewer; Vim mode toggle

### Module Toggle System

- [ ] Create `src/renderer/stores/moduleStore.ts`
  - `modulesEnabled: Record<string, boolean>`
  - `isEnabled(moduleName): boolean` — used by sidebar, toolbar, settings to conditionally render
  - Toggle: `IPC.MODULES.TOGGLE` → DB → reload → store update → UI effect is instant removal (not greyed out)
- [ ] Create `src/renderer/features/settings/ModulesPage.tsx`
  - One toggle per module with name + description
  - Phase 2 modules shown as "Coming in Phase 2 — Companion & Collaboration"
  - Profile presets at top: Minimalist / GTD / Focus / Custom (one click sets multiple toggles)

### Profile Presets

- [ ] Preset "Minimalist": enable only `my_day`. Disable all others.
- [ ] Preset "GTD Mode": enable `my_day`, `project_management`, `agenda`, `goals_habits`. Disable rest.
- [ ] Preset "Focus Mode": enable `my_day`, `pomodoro`, `agenda`. Disable rest.
- [ ] Preset "Custom": current state — no forced changes
- [ ] Preset selection shown on first launch (step 1 of onboarding in Phase 18)

### App Lock (Privacy)

- [ ] Create `src/main/services/security/AppLockService.ts`
  - PIN stored in OS keychain via `keytar` — never in SQLite unencrypted
  - `verifyPin(input)`: retrieve from keychain → constant-time comparison
  - `setPin(pin)`: store in keychain
  - Biometric: Windows Hello / macOS Touch ID via Electron APIs (optional, fallback to PIN)
- [ ] Create `src/renderer/features/settings/AppLockScreen.tsx` — shown on app open when lock is enabled

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 16 complete: Theme engine, accent color, backgrounds, full settings, module toggles, profile presets, app lock."
- [ ] Commit: `"Phase 16 complete: Theming, settings, module system"`

---

## PHASE 17: Data Portability, Backup & Import (Week 20)

### Export

- [ ] Create `src/main/services/export/ExportService.ts`
  - **Full JSON export:** all tasks, lists, projects, tags, goals, pomodoro sessions, settings → single `os11-export.json`
  - **CSV export:** tasks as flat table — title, list, tags (comma-separated), due date, priority, completed
  - **Markdown export:** `- [ ] Task title (due: YYYY-MM-DD)` format, grouped by list
  - **Print list:** `webContents.printToPDF()` or system print dialog for any task list
  - **Attachment export:** ZIP of JSON export + all files from `userData/attachments/`
  - All export operations run via `dialog.showSaveDialog()` for destination

### Import

- [ ] Create `src/main/services/import/ImportService.ts`
  - Import from OS11 JSON export (full round-trip) — idempotent (duplicate IDs are skipped)
  - Import from **Todoist** JSON export
  - Import from **Microsoft To Do** CSV export
  - Import from **Notion** CSV export (task database format)
  - All imports run in worker thread — never block the UI
  - Progress IPC: `IPC.IMPORT.PROGRESS` sent as import proceeds → renderer shows progress bar
  - Atomic: entire import wrapped in one SQLite transaction — all or nothing

### Auto-Backup

- [ ] Create `src/main/services/backup/BackupService.ts`
  - Daily backup: triggered once per day on app startup if no backup exists for today
  - Backup destination: user-defined local folder (`dialog.showOpenDialog`)
  - Format: ZIP — JSON export + all attachments
  - Retention: keep last 7 backups by default (configurable)
  - "Restore from backup" in Settings → Privacy: replaces current DB with backup (requires restart)

### Version History

- [ ] Create migration `0002_task_history.sql`:
  ```sql
  CREATE TABLE task_history (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_fields  TEXT NOT NULL,  -- JSON: { field: { from, to } }
    changed_at      TEXT NOT NULL
  );
  CREATE INDEX idx_task_history_task_id ON task_history(task_id);
  ```
- [ ] `TaskService.update()` inserts a `task_history` record after every field change
- [ ] History older than 30 days purged on startup
- [ ] UI: "History" section in detail panel — list of changes; "Restore to this version" rolls back fields

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 17 complete: JSON/CSV/Markdown export, multi-source import, daily auto-backup, version history."
- [ ] Commit: `"Phase 17 complete: Data portability and backup"`

---

## PHASE 18: Onboarding, Accessibility & Polish (Weeks 21-22)

### Onboarding

- [ ] Create `src/renderer/features/onboarding/OnboardingFlow.tsx` + `.module.css`
  - Multi-step wizard, skippable at any point (FEEL UI — even onboarding respects it)
  - Step 1: Choose profile preset (Minimalist / GTD / Focus / Custom)
  - Step 2: Set display name + emoji avatar → `IPC.IDENTITY.UPDATE`
  - Step 3: Interactive quick-add demo — "Add your first task" with guided prompts
  - Step 4: "Here's your keyboard" — shortcut cheat-sheet overlay
  - Framer Motion: slide transitions between steps, < 200ms
  - Shown only on first launch; `settings.onboarding_completed` set to true on completion or skip

### Accessibility

- [ ] ARIA labels on all interactive elements — task cards, checkboxes, buttons, sidebar items, inputs
- [ ] `role="list"` + `role="listitem"` on the virtual task list — screen reader navigation
- [ ] Focus ring: `var(--shadow-focus)` on all focusable elements via `focus-visible` pseudo-class — not shown on mouse click
- [ ] High contrast mode: `@media (prefers-contrast: more)` — increase border contrast, remove glass effects
- [ ] Font scaling: `font-size: 100%` on root, `em` units throughout — respects OS accessibility font size
- [ ] Reduced motion: already in `tokens.css`; all Framer Motion components already read `useMotionConfig()`
- [ ] Screen reader testing: NVDA on Windows, VoiceOver on macOS
- [ ] Color-blind accessibility: tag dots use shape + color (circle / square / triangle) — not color alone
- [ ] Keyboard navigation audit: walk every screen without a mouse; every action must be reachable

### Focus Mode (Full Screen)

- [ ] `Ctrl+Shift+F` → hides sidebar + task list → shows only current task (title + notes) + minimal toolbar
- [ ] Dims screen edges (CSS `box-shadow: inset`)
- [ ] Optional ambient sound player: lo-fi beats / rain / white noise — small bundled audio files
  - `<audio>` element in renderer, controlled via toolbar buttons
- [ ] `Escape` or `Ctrl+Shift+F` again → exit focus mode

### Recurring Review System

- [ ] Weekly Review prompt: every Friday at a user-configured time → shows completed tasks, stale tasks, prompts priority-setting for next week
- [ ] Monthly Review prompt: first of month → shows goal progress, suggests archiving completed projects, streak summary
- [ ] Both prompts are dismissible; prompt timing is configurable in Settings → General

### Performance Final Verification

All targets from PERFORMANCE.md must be confirmed before this phase closes:

- [ ] Initial JS bundle < 200KB gzipped — `npm run analyze`
- [ ] Initial CSS < 30KB
- [ ] Warm-start `win.show()` < 30ms perceived
- [ ] Cold-start < 1.5 seconds to interactive
- [ ] Search < 150ms from keypress to results
- [ ] Task list with 1000+ tasks: DOM node count ~50 (virtualizer working)
- [ ] Inline edit commit < 16ms (one frame)
- [ ] UI transitions < 200ms (verify in DevTools → Performance)
- [ ] Drag-and-drop feedback < 16ms (no layout reflow on drag)
- [ ] Runtime RAM idle < 200MB
- [ ] Installed app size < 150MB — `du -sh dist/...`
- [ ] Run `npm audit` — zero high or critical vulnerabilities

### Governance Review

- [ ] Final review of ARCHITECTURE.md — all 11 hard rules intact
- [ ] Final review of UTILITIES.md — matches everything in the codebase
- [ ] Final review of DEPENDENCIES.md — all packages justified, `npm audit` clean
- [ ] Final review of all ADRs — at least 8 written (ADR-0001 through ADR-0008)
- [ ] CHANGELOG_INTERNAL.md: complete history of all phases

### Governance Update

- [ ] CHANGELOG_INTERNAL.md: "Phase 18 complete: Onboarding, full accessibility audit, focus mode, recurring reviews, performance verified."
- [ ] Commit: `"Phase 18 complete: Onboarding, accessibility, polish, performance verified"`

---

## PHASE 19: Testing & Release — v1.0.0 (Weeks 22-24)

### Unit Tests (Vitest)

- [ ] All domain functions — 100% coverage target:
  - `task-validation.ts`: all invalid inputs, edge cases
  - `recurrence.ts`: daily, weekly, monthly, yearly, custom rules, after-completion, skip occurrence
  - `nlp.ts`: all Quick Add syntax variants; ambiguous inputs; empty input
  - `fractional-index.ts`: between, atStart, atEnd, extreme values
  - `dependency-check.ts`: direct cycle, transitive cycle, no cycle
- [ ] All repositories — parameterized statements verified; no SQL injection possible
- [ ] All services — happy path + every error path
- [ ] `date.ts` utils, `uuid.ts`, all utility functions in `src/shared/utils/`

### Integration Tests (Vitest)

- [ ] Task lifecycle: Create → Complete (recurring: verify next occurrence) → Undo → Trash → Restore → Permanent delete
- [ ] Tag system: create tag → assign to task → delete tag → verify `task_tags` CASCADE
- [ ] Subtask: create subtask → verify `parent_task_id` → promote → verify `parent_task_id = null`
- [ ] Attachment: upload file → delete task → verify file removed from disk
- [ ] Import/export round-trip: export JSON → fresh DB → import → compare record counts and field values
- [ ] Migration runner: version 0 → apply 0001 → verify schema; version 1 → apply 0002 → verify new table

### E2E Tests (Playwright)

- [ ] App launches → splash shows → main window renders → task list loads
- [ ] Create task via Quick Add bar → appears in list (optimistic update confirmed)
- [ ] Create task via Omnibar with NLP → due date and tag parsed correctly
- [ ] Complete task → moves to Completed section → Undo restores it to correct position
- [ ] Drag task → task: verify `parent_task_id` updated in DB
- [ ] Drag task → sidebar list: verify `list_id` updated in DB
- [ ] Drag file onto task card: verify `attachments` record created and file exists on disk
- [ ] Pomodoro: start session → complete → verify `pomodoro_sessions` record and `tasks.pomodoro_count` updated
- [ ] Multi-select `Ctrl+A` → bulk complete → verify all tasks completed
- [ ] Global shortcut `Ctrl+Shift+Space` → main window shows
- [ ] Dark mode toggle → `data-theme="dark"` applied on `<html>`
- [ ] Module toggle: disable Pomodoro → Pomodoro absent from sidebar; re-enable → returns
- [ ] App lock: enable PIN → close and reopen → lock screen shown → correct PIN unlocks

### Performance Tests

- [ ] 1000 tasks in one list: measure DOM node count (should be ~50 with virtualizer)
- [ ] 5000-task database: search query time < 150ms (measured in worker)
- [ ] Cold start: measured via Playwright timing from process start to first paint
- [ ] CI bundle size check: fail build if initial bundle > 200KB gzipped

### Manual QA Scenarios

- [ ] New install: first launch, complete onboarding, create first task with NLP syntax
- [ ] Add 500 tasks: list renders smoothly; no lag on scroll or keyboard navigation
- [ ] Toggle dark mode: all screens switch correctly; no hardcoded color visible
- [ ] Change accent color to each preset + custom hex: all interactive elements update
- [ ] Delete a list with 50 tasks: CASCADE removes all tasks from DB
- [ ] Export full data → import to fresh install → all tasks present and correct
- [ ] All keyboard shortcuts functional from cold open, no mouse used

### Release Build

- [ ] `npm prune --production` — all devDependencies removed
- [ ] Run `npm audit` — zero high or critical vulnerabilities
- [ ] Sign macOS: Apple Developer ID Application certificate
- [ ] Sign Windows: code signing certificate (Authenticode)
- [ ] Build: `.dmg` (macOS), `.exe` NSIS installer (Windows), `.AppImage` (Linux)
- [ ] Test each installer on a clean VM (no dev tools, no Node installed)
- [ ] Set up GitHub Releases for `electron-updater`
- [ ] Write v1.0.0 release notes: highlights only (Feature Spec §22.9 says "not a wall of text")

### Final Commit & Tag

- [ ] Commit: `"Phase 19 complete: Testing, QA, performance verified, release build"`
- [ ] Tag: `v1.0.0`

---

## PHASE 20: Phase 2 Foundation — Companion Sync & Collaboration (Post v1.0.0)

> The Phase 1 codebase was built for this from day one. No desktop refactor required.
> Phase 2 tables (users, devices, collaboration_members, sync_queue) already exist — empty.
> Install Phase 2 packages only when this phase begins. See DEPENDENCIES.md §Phase 2.

### Companion Sync Infrastructure

- [ ] Install Phase 2 packages: `ws`, `bonjour-service`, `qrcode`
- [ ] Create `src/main/services/sync/SyncServer.ts`
  - WebSocket server on `ws://localhost:7411` (default port); user can change in settings
  - Runs in main process
- [ ] Create `src/main/services/sync/Discovery.ts`
  - `bonjour-service` advertises `os11-sync._tcp.local` on local network
  - Companion discovers desktop without manual IP entry
- [ ] Create `src/main/services/sync/Pairing.ts`
  - Generate QR code with `{ ip, port, pairingToken }` via `qrcode` package
  - Display in Settings → Companion (new settings page)
  - On successful scan: companion sends token → store paired device in `devices` table → token stored in OS keychain via `keytar`
- [ ] Create `src/worker/sync/SyncWorker.ts`
  - Drains `sync_queue` table; sends changes to connected companion/peers over WebSocket
  - Handles incoming changes from companion: applies via repositories
  - Conflict resolution: last-write-wins; stores conflict in `task_history`
  - Retry logic: `retry_count` column; exponential backoff up to 5 retries
- [ ] Sync status indicator in sidebar footer: "Last synced X seconds ago" / "Offline"

### Collaboration Features

- [ ] Shared list/project invites: invite code or QR scan → creates `collaboration_members` record
- [ ] Permission levels: viewer (read-only) / editor (add/edit) / admin (manage members, delete)
- [ ] Task assignment: `assignee_device_id` column already in `tasks` — wire to UI via inline picker on task card
- [ ] Comment threads: `comments` table already in schema — build `CommentThread.tsx` in detail panel
- [ ] Comment reactions: `comment_reactions` table already in schema — emoji picker on each comment
- [ ] @mentions in comments → notification to mentioned device via WebSocket broadcast

### Android Companion App (Separate Repository)

- [ ] New repository: `os11-android`
- [ ] React Native 0.74+; shared TypeScript types from `src/shared/` via npm workspace or git submodule
- [ ] WebSocket client: `ws` package, connects to desktop server discovered via mDNS
- [ ] Full task CRUD, quick add with NLP (same parser, shared code)
- [ ] Location-based reminders (geofencing via React Native Location API)
- [ ] Voice input: React Native Speech-to-Text → NLP parser
- [ ] Home screen widget: Today's tasks + Quick Add button
- [ ] Swipe actions: swipe left to complete, swipe right to move/star
- [ ] Share sheet integration: share URL from browser → creates task with URL attached
- [ ] Offline-first: changes queue in `sync_queue` table (local SQLite), flush when desktop reconnects

---

## Key Governance Documents

| Document | Purpose | Updated When |
|---|---|---|
| `ARCHITECTURE.md` | Layer order, module boundaries, 11 hard rules, security rules | Before breaking any rule |
| `SCHEMA.md` | Full data model — tables, indexes, FTS5, relationships | When any table or index changes |
| `PERFORMANCE.md` | Speed targets + 18 mitigation strategies + pre-ship checklist | When any performance pattern is added or changed |
| `DEPENDENCIES.md` | Approved packages, Banned Alternatives, bundle size targets | When any package is added |
| `tokens.css` | Every CSS variable the app uses | When any new visual token is needed |
| `UTILITIES.md` | Shared hooks, components, domain functions — check before creating | When any reusable abstraction is added |
| `IPC_CHANNELS.md` | Every IPC channel name — no string literals | When any new IPC channel is needed |
| `DONE.md` | Definition of done checklist | Consulted before closing any feature |
| `CHANGELOG_INTERNAL.md` | Session-by-session progress log | After every coding session, before committing |
| `docs/decisions/ADR-*.md` | Architecture decision records | Before introducing any new pattern or library |

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|---|---|---|
| Phase 0 | Weeks 1-2 | All governance docs, ADRs, project skeleton, git init |
| Phase 1 | Weeks 2-3 | Design tokens live, fonts wired, base components, app shell |
| Phase 2 | Weeks 3-5 | SQLite schema, all repositories, domain functions, shared types |
| Phase 3 | Weeks 5-6 | IPC contract, service layer, worker thread, parallel startup |
| Phase 4 | Week 6 | Window infrastructure, tray, global shortcuts, warm-start verified |
| Phase 5 | Weeks 7-9 | Core task CRUD, virtual list, detail panel, optimistic updates, undo |
| Phase 6 | Weeks 9-10 | Lists, smart lists, sidebar, My Day, rollover prompt |
| Phase 7 | Weeks 10-11 | Quick Add, Omnibar, NLP parsing, all shortcuts, command palette, search |
| Phase 8 | Weeks 11-12 | All drag-and-drop targets, context menus, multi-select, bulk operations |
| Phase 9 | Week 12 | Tag system (nested, merge, auto-tag), notification center |
| Phase 10 | Weeks 13-15 | Full project management — 5 view modes, dependencies, milestones |
| Phase 11 | Weeks 15-16 | Recurrence fully wired, reminder scheduling and snooze, calendar integration |
| Phase 12 | Week 16 | Pomodoro, mini floating window, tray countdown, session tracking |
| Phase 13 | Weeks 17-18 | Daily/weekly agenda, goals with streaks, habit tracker |
| Phase 14 | Weeks 18-19 | Dashboard, all 5 charts, stats aggregation, PDF/CSV export |
| Phase 15 | Week 19 | File attachments — all upload sources, thumbnails, clipboard paste |
| Phase 16 | Weeks 19-20 | Theme engine, backgrounds, settings, module toggles, app lock |
| Phase 17 | Week 20 | Export/import (5 sources), daily auto-backup, version history |
| Phase 18 | Weeks 21-22 | Onboarding, full accessibility, focus mode, recurring reviews, performance verified |
| Phase 19 | Weeks 22-24 | Unit + integration + E2E tests, manual QA, signed release build — v1.0.0 |
| Phase 20 | Post v1.0.0 | Companion sync, collaboration, Android app |

**Total: ~24 weeks for Phase 1 feature-complete, tested, signed desktop app on all three platforms.**

---

## Preventing the Vibe Coding Problems

Every phase is designed to prevent the 20 known vibe coding failure modes:

1. ✅ **Features faster than comprehension** → CHANGELOG_INTERNAL.md updated every session; one feature per session
2. ✅ **Architectural drift** → ARCHITECTURE.md included in every prompt; layer boundaries enforced by ESLint
3. ✅ **Optimizes for current request** → ARCHITECTURE.md + PERFORMANCE.md + SCHEMA.md wrap every prompt
4. ✅ **Bug fixes create new bugs** → Root cause protocol in DONE.md; no fix ships without understanding why
5. ✅ **Works but edge cases fail** → DONE.md: happy path + empty state + error state before closing
6. ✅ **Combinatorial testing problem** → Manual QA scenarios in Phase 19 cover cross-feature interactions
7. ✅ **AI tests give false confidence** → Domain functions tested spec-first against known inputs and outputs
8. ✅ **Refactoring becomes hard** → Small bounded phases; one feature per session; `UTILITIES.md` prevents duplication
9. ✅ **Data migrations are terrifying** → Migrations from day one; Phase 2 tables pre-created; no surprise schema breaks
10. ✅ **AI adds dependencies** → DEPENDENCIES.md approval gate; Banned Alternatives enforced; bundle analyzer every release
11. ✅ **Duplicate abstractions** → UTILITIES.md — check before creating any hook, component, or utility
12. ✅ **AI loses the why** → ADRs explain every significant decision; DEPENDENCIES.md explains every package choice
13. ✅ **Context bottleneck** → Phased prompts reference only the relevant governance doc sections for that session
14. ✅ **Long sessions drift** → One session = one feature = one commit; session template enforces scope
15. ✅ **UI consistency** → `tokens.css` enforced — no hardcoded values; every value from tokens
16. ✅ **Performance becomes architectural** → PERFORMANCE.md is a rejection criterion, not a wish list; verified each phase
17. ✅ **Concurrency nightmare** → Concurrency rules in ARCHITECTURE.md; optimistic update pattern defined in PERFORMANCE.md
18. ✅ **Security becomes hard** → Security rules baked into ARCHITECTURE.md; enforced from Phase 3 (preload, IPC, keytar)
19. ✅ **AI optimizes for code quantity** → Minimum viable implementation rule; no feature without a passing DONE.md checklist
20. ✅ **You become the compiler** → Architecture review cadence; enforce layer violations in every session review

---

## Session Template (Use for Every Coding Session)

```
# Session Goal
[One sentence: what this session will accomplish. One thing only.]

# Reference Files for This Session
- ARCHITECTURE.md — section: [which layer is being touched — Renderer/Main/Worker/Domain/Repository]
- SCHEMA.md — tables: [which tables this feature reads or writes]
- PERFORMANCE.md — sections: [which performance rules apply: virtual scroll? optimistic update? lazy chunk?]
- tokens.css — [if building any UI component]
- UTILITIES.md — [check BEFORE creating any new hook, component, or utility]
- DEPENDENCIES.md — [if any new package is being considered]
- docs/decisions/[relevant ADRs]

# Task Scope — Files to Touch
- Create: [specific file paths, matching ARCHITECTURE.md folder structure]
- Modify: [specific file paths]
- Do NOT touch: [off-limits files]

# Definition of Done for This Session
- [ ] Feature implemented per ARCHITECTURE.md layer rules
- [ ] No hardcoded color, size, radius, or font value — tokens only
- [ ] No business logic in renderer (components, stores) — it goes in services or domain functions
- [ ] All IPC handlers use try/catch and return { ok: boolean, data?, error? }
- [ ] Virtual scrolling applied if a list is rendered that can grow without bound
- [ ] Optimistic update pattern used for any write
- [ ] Reduced motion handled if any animation was added (useMotionConfig())
- [ ] UTILITIES.md updated if anything reusable was created
- [ ] At least one test written
- [ ] CHANGELOG_INTERNAL.md updated: "[date] — [what was built]"
- [ ] Committed: "Phase N: [feature name] — [one-line description]"

# North Star Check (before closing)
- [ ] ⚡ Insane Speed: does this add any perceptible lag? (virtual scrolling, optimistic updates, lazy chunks)
- [ ] ⌨️ Keyboard Native: can every action in this feature be done without the mouse?
- [ ] 🧩 Modular: should this be behind a module toggle? (check SCHEMA.md modules table)
- [ ] 🤲 Extreme Convenience: is there any friction the user shouldn't have to deal with?
- [ ] 🌌 FEEL UI: does this add anything to the default view that should instead be layer 2 or 3?
```

---

**This is your Phase 1 roadmap.**
**Governance first. Architecture before code. Performance as a precondition, not a feature.**
**⚡ Insane Speed · ⌨️ Keyboard Native · 🧩 Modular · 🤲 Extreme Convenience · 🌌 FEEL UI**
