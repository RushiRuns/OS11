# OS11 — Architecture Rules

> This file is law, not suggestion.
> Every prompt to any AI tool must include or reference the relevant section here.
> A feature that violates these rules does not ship — it goes back for a redesign.

---

## Build Phase

**Phase 1 (current): Desktop only.**
- Windows, macOS, Linux via Electron.
- All data is local. No cloud. No external auth. No AI/LLM.
- Collaboration and companion sync are designed into the architecture from day one — but they are not built in Phase 1.

**Phase 2 (planned): Companion app + Collaboration.**
- Android companion app syncs with the desktop over local network (same WiFi, mDNS discovery + WebSockets).
- Collaboration happens peer-to-peer on the same network, or via a user-hosted relay server.
- Still no external cloud. No third-party auth service. No AI.

Nothing in Phase 1 code introduces a dependency on a cloud provider, an auth SDK, or an AI API. The architecture supports Phase 2 without requiring those things.

---

## Layer Order

Strict. No layer may be skipped. No direction may be reversed.

```
Renderer Process (React UI)
  ↓  IPC only — contextBridge — no direct Node/DB access from renderer
Main Process (Application Services)
  ↓
Domain Logic (pure functions — no side effects, no I/O)
  ↓
Repositories (all database access lives here — nowhere else)
  ↓
SQLite via better-sqlite3 / Filesystem
```

**What this means in practice:**

- A React component may not `require` or `import` from any repository, service, or domain module directly.
- A service may not reach into another service's repository. Cross-service reads go through the calling service's own API.
- The renderer never knows SQLite exists. It sends IPC messages and receives structured responses.
- Domain logic functions are pure: given input, return output. No database calls, no IPC, no filesystem inside domain functions.

---

## Process Architecture

OS11 runs three OS processes. Each has a defined scope. Scope violations are architectural bugs.

### Main Process (`src/main/`)
Owns: IPC handlers, app lifecycle, tray, global shortcuts, notifications, auto-updater, window management, local sync WebSocket server (Phase 2).
- Spawns and manages the renderer window.
- Spawns and communicates with the worker thread.
- All SQLite reads/writes happen here (via repositories).
- Does not contain React or any UI code.

### Renderer Process (`src/renderer/`)
Owns: All React UI, Zustand stores, CSS, Framer Motion animations, user interaction.
- Communicates with Main via `window.electron` (contextBridge-exposed API only).
- Does not import from `src/main/` or `src/worker/`. Ever.
- Contains zero business logic. The renderer is a thin view layer.
- State lives in Zustand. The renderer is the only consumer of Zustand.

### Worker Thread (`src/worker/`)
Owns: Full-text search indexing, file processing, heavy computation, sync data processing (Phase 2).
- Spawned by Main. Communicates via `worker.postMessage` / `parentPort.postMessage`.
- Never touches the UI thread or the renderer process.
- Has read access to the SQLite database via its own repository instances.
- May block: it is off the UI thread by design.

---

## Module Boundaries

```
src/
  main/
    ipc/             — IPC handler registry (thin — delegates to services)
    services/        — Application services (one per domain)
      task/
      list/
      project/
      tag/
      reminder/
      attachment/
      collaboration/ — Phase 2
      pomodoro/
      goal/
      sync/          — Phase 2 (local network sync with companion/peers)
      notification/
      settings/
    repositories/    — SQLite access (one per domain, mirrors services)
    domain/          — Pure business logic (validation, recurrence, NLP parsing)
    window/          — BrowserWindow lifecycle, preload management
  renderer/
    components/      — UI components (dumb — receive props, emit events)
    features/        — Feature-level components wired to stores
      tasks/
      lists/
      projects/
      pomodoro/
      agenda/
      dashboard/
      settings/
    stores/          — Zustand stores (one per domain)
    hooks/           — Shared React hooks (registered in UTILITIES.md)
    styles/          — CSS Modules + tokens.css
  worker/
    search/
    file-processor/
    sync/            — Phase 2
  shared/
    types/           — TypeScript interfaces shared across all processes
    constants/       — App-wide constants (priority levels, smart list IDs, etc.)
    utils/           — Pure utility functions (no I/O, no side effects)
```

**Cross-module communication rules:**
- Renderer → Main: IPC via `window.electron.<channel>()`.
- Main → Renderer: IPC via `win.webContents.send()`.
- Main ↔ Worker: `worker.postMessage()` / `parentPort.postMessage()`.
- Within Main: Services may call other services. Repositories may not call other repositories.
- Within Renderer: Stores are independent. Components do not call stores from other feature domains except through shared types.

---

## Sync Architecture (Phase 2 — designed now, built later)

**No cloud required at any point.**

### Companion App Sync (Android ↔ Desktop)

Transport: WebSocket server running in the main process on a local port (default `ws://localhost:7411`).
Discovery: mDNS (`bonjour-service`) broadcasts the desktop as `os11-sync._tcp.local`.
Pairing: QR code displayed in desktop Settings → Companion. Companion app scans it; the QR encodes the local IP + port + a one-time pairing token. After pairing, the companion stores the device UUID and reconnects automatically.
Auth: Device UUID token only. No email. No password. No external auth service.
Data format: JSON patch diffs over the WebSocket connection.

```
Desktop (WebSocket server, port 7411)
  ↕ local network
Android companion (WebSocket client)
```

When not on the same network: sync is paused. Changes are queued locally. The `sync_queue` table accumulates changes. When the devices reconnect (same WiFi), the queue flushes automatically.

### Collaboration (Peer-to-Peer)

On the same local network: one participant's desktop acts as the WebSocket server. Others connect as clients. Changes are broadcast to all connected peers.
Remote (different networks): participants point to a self-hosted relay server (a small WebSocket relay — no data stored on it, just forwarded). OS11 does not provide or operate this relay; the user/team runs it.
Conflict resolution: last-write-wins with a conflict history log accessible in the task detail panel. Handled in the sync service domain layer.

---

## IPC Contract

All IPC channels are defined in `src/shared/ipc-channels.ts`. No ad-hoc string literals.

Every IPC handler follows this structure:

```typescript
ipcMain.handle(IPC.TASKS.CREATE, async (_event, payload: CreateTaskPayload) => {
  try {
    validate(payload);
    const task = await taskService.create(payload);
    return { ok: true, data: task };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
```

Rules:
- Every handler is wrapped in `try/catch`. Errors are returned as `{ ok: false, error }` — never thrown across the IPC boundary.
- The renderer validates `result.ok` before using `result.data`.
- Payloads are validated at the service layer, not in the IPC handler itself.
- The preload script exposes only `window.electron.invoke()` and `window.electron.on()`. No other Node APIs leak into the renderer.

---

## State Management Rules

- One Zustand store per feature domain. No cross-store imports.
- The store is the single source of truth for UI state. SQLite is the single source of truth for persisted state. These two must always agree — optimistic updates are allowed; stale UI state is a bug.
- Stores do not call IPC directly. They call a service adapter in `src/renderer/services/` which wraps the IPC call.
- No duplicated state: if data lives in the task store, the project store does not copy it. It references the task store's selector.
- Global app state (theme, active list, module toggles): `appStore`. UI-local state (hover, focus, open/closed panel) stays in React local state or Framer Motion's animation state.

---

## Concurrency Rules

```
Operation order for any write that touches a task:
  user action → optimistic UI update → IPC call → SQLite write → sync_queue entry (Phase 2)
  (never reversed, never parallelized on the same record)

Autosave and undo never run concurrently on the same record.
The sync worker reads from sync_queue — it does not read live task data.

Local state is always the source of truth.
Sync reads from local state. Sync never overwrites local state without going through conflict resolution.

Functions crossing async boundaries (IPC, worker messages, timers) communicate by message-passing only.
They do not share references to mutable objects.
```

---

## Security Rules

```
contextIsolation: true — always. No exceptions.
nodeIntegration: false — always. No exceptions.
sandbox: true — apply to the renderer BrowserWindow.

All user input is validated at the service layer before reaching the database or filesystem.
Never trust data from the renderer process via IPC without validation.

All SQLite queries use parameterized statements.
No string concatenation in queries. Ever.

The app reads/writes files only within designated directories:
  - app.getPath('userData') for all app data and attachments
  - user-chosen directories (opened via dialog.showOpenDialog; paths sanitized before use)

App lock PIN is stored in the OS keychain via keytar.
No secrets, tokens, or PINs are stored in SQLite unencrypted.

npm audit is run before every release. No dependency with a known
high or critical vulnerability ships.
```

---

## Schema & Migration Rules

- Every schema change has a migration file in `src/main/migrations/`.
- Migration files are named `NNNN_description.sql` (e.g., `0001_initial_schema.sql`).
- Migrations run forward only. No destructive rollback migrations.
- The app checks the current schema version at startup (`PRAGMA user_version`) and applies pending migrations before any other database operation.
- No AI tool touches migration files without human review of the migration path.

---

## Hard Rules — The Rejection List

If a proposed implementation violates any of these, it is rejected and redesigned before code is written.

1. React components do not import from repositories or domain modules.
2. All persistence goes through the repository layer. No `db.prepare()` outside of `src/main/repositories/`.
3. All dates stored as ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
4. All IPC handlers use `try/catch` and return `{ ok: boolean, data?, error? }`.
5. State lives in one place per domain. No duplicating state across stores.
6. No new dependency without a written justification in `DEPENDENCIES.md`.
7. No new architectural pattern without a decision record in `docs/decisions/ADR-*.md`.
8. Every schema change requires a migration file.
9. No feature ships without at least one test.
10. The renderer contains zero business logic. Validation, computation, and data transformation happen in services or domain functions — not in components or stores.
11. No cloud provider SDK, external auth SDK, or AI/LLM API client is introduced at any point without a formal decision record. This is a hard constraint for Phase 1 and requires explicit founder sign-off for any later phase.

---

## Decision Records

Significant architectural decisions are documented in `docs/decisions/`. Format:

```
ADR-0001: Use better-sqlite3 over sql.js
Status: Accepted
Context: ...
Decision: ...
Consequences: ...
```

When a prompt would introduce a new pattern, library, or structural change: write the ADR first, then build.
