# OS11 — Internal Engineering Changelog

> **Format:** `[YYYY-MM-DD] — [what was built] — [what changed architecturally]`
> **Rule:** Updated at the end of every coding session before committing.

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
