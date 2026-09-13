# OS11 — Performance Boundaries

> Speed is a precondition, not a feature.
> These targets are not aspirational — they are rejection criteria.
> A feature that misses a target does not ship without a deliberate trade-off decision recorded in an ADR.
> When building any list, any data-loading path, any state update, or any animation: paste the relevant section of this file into the prompt.

---

## Targets

| Metric | Target | Notes |
|---|---|---|
| Window show (warm) | < 30ms perceived | Preloaded hidden `BrowserWindow`; `win.show()` on trigger |
| Cold start to interactive | < 1.5 seconds | Splash screen + parallel startup + V8 snapshot |
| First task list paint | < 100ms after window show | Data in memory; no IPC needed on open |
| Search results | < 150ms from keypress | FTS5 query in worker thread; `useDeferredValue` in renderer |
| Inline edit commit | < 16ms (one frame) | Optimistic UI; synchronous SQLite write |
| UI transitions (Framer Motion) | < 200ms | GPU-composited (`transform`, `opacity`) only |
| Drag-and-drop feedback | < 16ms (one frame) | @dnd-kit pointer-event based; no layout reflow during drag |
| Runtime RAM (warm, idle) | < 200MB | Virtual scrolling + lazy data loading keeping DOM lean |
| Installed app size | < 150MB | ASAR compression + tree-shaking + dependency pruning |
| Delta update download | < 30MB | `electron-updater` differential updates |

---

## Electron-Specific Optimizations

These come directly from evaluating Electron's known weaknesses against Tauri and applying all viable mitigations. Each one is mandatory unless explicitly noted as optional.

---

### 1. Preloaded Hidden Window — The Core Warm-Start Trick

The app registers at OS login and starts immediately — but the window stays hidden. When the user triggers it (hotkey, tray, omnibar), the window is already rendered. `win.show()` takes < 30ms.

```typescript
// src/main/window/main-window.ts
const win = new BrowserWindow({
  show: false,               // Never show on create
  webPreferences: {
    contextIsolation: true,  // Security — always
    nodeIntegration: false,  // Security — always
    sandbox: true,           // Security + slight perf gain
    preload: path.join(__dirname, 'preload.js')
  }
});

win.loadFile('index.html');

// When user triggers open:
win.show();   // Window was already rendered — perceived open time < 30ms
```

On window close: hide, don't destroy. The process stays alive in the tray.

```typescript
win.on('close', (e) => {
  e.preventDefault();
  win.hide();   // Not win.close() or app.quit()
});
```

---

### 2. Splash Screen — Cover the Cold Start

On true cold start (first run of the day, OS reboot), Chromium + Node initialization takes 1-1.5 seconds before anything is visible. A splash screen makes this feel instant.

```typescript
// src/main/window/splash-window.ts
const splash = new BrowserWindow({
  width: 420,
  height: 280,
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  webPreferences: { contextIsolation: true }
});

splash.loadFile('splash.html');   // Loads immediately — tiny HTML file

mainWindow.once('ready-to-show', () => {
  splash.destroy();
  mainWindow.show();
});
```

The splash HTML is a single file — no JS bundle, no framework. Just the logo and a minimal CSS animation. It renders before the main window's Vite bundle finishes parsing.

---

### 3. Parallelize Startup — Cut Sequential Bottlenecks

Serial startup is the default pattern and the slow one. Parallelize everything that can run concurrently.

```typescript
// src/main/startup.ts — runs before the window becomes visible

// WRONG — sequential, ~1.2s total
async function startup() {
  await loadActiveList();        // 400ms
  await initializeSearch();      // 300ms
  await applyMigrations();       // 200ms
  await loadModuleSettings();    // 100ms
  await loadAppTheme();          // 100ms
}

// RIGHT — parallel, ~500ms total
async function startup() {
  await applyMigrations();       // Must run first — schema must be current

  await Promise.all([
    loadActiveList(),            // 400ms — loads in parallel with the rest
    initializeSearch(),          // 300ms
    loadModuleSettings(),        // 100ms
    loadAppTheme(),              // 100ms
  ]);
}
```

Migration must run before data loads. Everything after can run in parallel.

---

### 4. Preload Critical Data Before the Renderer Asks

When the renderer window becomes visible, the first task list is already in memory. No "loading…" state on open.

```typescript
// src/main/startup.ts
let preloadedStartupData: StartupPayload | null = null;

app.on('ready', async () => {
  await runStartup();   // migrations + parallel preload

  preloadedStartupData = {
    lists: listRepo.getAll(),            // sidebar
    activeTasks: taskRepo.getFirst50(),  // first 50 tasks of default list
    settings: settingsRepo.getAll(),
    modules: moduleRepo.getAll(),
    identity: identityRepo.get(),
  };
});

// IPC handler — renderer asks on mount
ipcMain.handle(IPC.APP.GET_STARTUP_DATA, () => {
  return { ok: true, data: preloadedStartupData };
});
```

One IPC call. One response. No loading state.

---

### 5. Code Splitting by Route — Keep the Initial Bundle Small

Non-critical modules must not be in the initial bundle. They load on first open.

```typescript
// src/renderer/App.tsx
import { lazy, Suspense } from 'react';

// Critical path — always in initial bundle
import TaskList from './features/tasks/TaskList';
import Sidebar from './features/sidebar/Sidebar';
import DetailPanel from './features/tasks/DetailPanel';

// Lazy — not loaded until user opens these
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Agenda     = lazy(() => import('./features/agenda/Agenda'));
const Projects   = lazy(() => import('./features/projects/Projects'));
const Settings   = lazy(() => import('./features/settings/Settings'));
const Pomodoro   = lazy(() => import('./features/pomodoro/PomodoroView'));
```

Recharts is automatically code-split with the Dashboard chunk — it never loads unless the user opens the Dashboard.

Vite handles this automatically; just ensure the imports above match the `manualChunks` config:

```javascript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'dashboard':  ['./src/renderer/features/dashboard/Dashboard'],
        'agenda':     ['./src/renderer/features/agenda/Agenda'],
        'projects':   ['./src/renderer/features/projects/Projects'],
        'pomodoro':   ['./src/renderer/features/pomodoro/PomodoroView'],
      }
    }
  }
}
```

---

### 6. V8 Snapshot Caching — Reduce JS Parse Time on Cold Start

V8 caches the parsed bytecode of JavaScript files. This is automatic in Electron, but you must not invalidate it unnecessarily.

Rules that keep the V8 cache effective:
- Do not dynamically generate module code at runtime.
- Do not use `eval()` or `new Function()` in the renderer or main process.
- Keep Vite's chunking stable between builds — changed filenames invalidate the cache.
- Use `app.setAppUserModelId()` correctly on Windows so the cache path is consistent.

For further reduction, `electron-builder` can be configured to use Electron's V8 snapshot feature to pre-snapshot the renderer bundle. This requires running `electron --snapshot` as part of the build pipeline. Apply this once the bundle is stable.

---

### 7. ASAR Compression + Dependency Pruning

Electron packages the app into an ASAR archive (a ZIP-like format). This is automatic. The goal is to feed it the least possible code.

```bash
# Before building for release:
npm prune --production   # Remove all devDependencies

# These packages must NOT be in the production bundle:
# @types/* (type definitions — not needed at runtime)
# vitest, @playwright/test (test tools)
# vite, eslint, prettier (build tools)
# vite-bundle-analyzer (analysis tool)
```

`electron-builder` handles `npm prune` automatically on build. Verify the output size after each release:

```bash
du -sh dist/mac-arm64/OS11.app   # macOS
du -sh dist/win-unpacked          # Windows
```

Target: < 150MB installed.

---

### 8. Tree-Shaking — Don't Import More Than You Use

Vite tree-shakes automatically for ESM modules. The developer's job is to import correctly.

```typescript
// WRONG — imports entire library (70KB+)
import * as dateFns from 'date-fns';

// RIGHT — imports only what is used (tree-shaken to < 5KB)
import { format, addDays, differenceInDays } from 'date-fns';

// WRONG — lodash CommonJS is not tree-shaken
import { debounce } from 'lodash';

// RIGHT — lodash-es is tree-shaken
import { debounce } from 'lodash-es';
```

The bundle analyzer (`npm run analyze`) will catch any module that slipped in unshaken.

---

### 9. Virtual Scrolling — Mandatory for All Unbounded Lists

Any list that can grow without a known upper bound MUST use `@tanstack/react-virtual`. This is not optional.

Applies to: task list, tag view, search results, attachment list, notification history, project activity feed, completed tasks list.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function TaskList({ tasks }: { tasks: Task[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,   // estimated task card height in px
    overscan: 10,             // render 10 items above/below the visible viewport
  });

  return (
    <div ref={parentRef} className={styles.listContainer}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(item => (
          <TaskCard
            key={tasks[item.index].id}
            task={tasks[item.index]}
            style={{ transform: `translateY(${item.start}px)`, position: 'absolute', width: '100%' }}
          />
        ))}
      </div>
    </div>
  );
}
```

A list of 500 tasks rendering 500 DOM nodes will fail the < 30ms interaction target and spike RAM. There is no exception to this rule.

---

### 10. Lazy Data Loading — Load the Minimum at Startup

At app open, the renderer receives exactly this:
- All lists (sidebar) — typically < 50 records.
- The active list's first 50 tasks.
- App settings and module toggles.
- Local identity record.

Nothing else. Tags, projects, attachments, pomodoro history, dashboard stats — all lazy.

Remaining tasks in a list load as the user scrolls (triggered by the virtualizer's overscan approaching the end):

```typescript
// src/renderer/features/tasks/useInfiniteTaskLoader.ts
function useInfiniteTaskLoader(listId: string) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Triggered by virtualizer when user scrolls near the bottom
  const loadMore = useCallback(async () => {
    const more = await window.electron.invoke(IPC.TASKS.GET_PAGE, {
      listId, offset: page * PAGE_SIZE, limit: PAGE_SIZE
    });
    if (more.ok && more.data.length > 0) {
      taskStore.appendTasks(more.data);
      setPage(p => p + 1);
    }
  }, [listId, page]);

  return { loadMore };
}
```

---

### 11. Optimistic Updates — No "Saving…" Spinners

Every write (complete task, edit title, change priority, move to list) follows this pattern:

1. User action fires.
2. UI updates immediately (optimistic).
3. IPC call fires async to write to SQLite.
4. On success (the common case): nothing changes — UI is already correct.
5. On failure (rare): roll back the UI update and show a toast error.

`better-sqlite3` is synchronous and local — writes complete in < 5ms. There is no reason to show a spinner for a disk write.

---

### 12. Incremental State Updates — Never Replace Full Arrays

When a single task changes, update that record in the store. Do not replace the whole task array.

```typescript
// WRONG — causes every TaskCard to re-render (even ones that didn't change)
set({ tasks: tasks.map(t => t.id === id ? { ...t, is_completed: 1 } : t) });

// RIGHT — surgical update; only that task's subscribers re-render
set(state => {
  state.tasksById[id].is_completed = 1;
  state.tasksById[id].completed_at = new Date().toISOString();
});
```

Zustand stores are keyed by ID (`tasksById: Record<string, Task>`). The ordered list for rendering is a derived selector — computed from the keyed map, not a source array.

---

### 13. Background Operations — Never Block the UI Thread

| Operation | Process |
|---|---|
| Full-text search indexing | Worker thread |
| File processing (attachment copy, thumbnail gen) | Worker thread |
| Recurrence expansion | Main process (not renderer) |
| Dashboard stats aggregation | Main process, on demand |
| Phase 2: companion sync | Worker thread |

The renderer does zero I/O. It sends IPC messages and receives results.

---

### 14. SQLite Performance Configuration

Applied at database open — before any query runs:

```typescript
// src/main/repositories/db.ts
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');       // Write-Ahead Logging: concurrent reads don't block writes
db.pragma('synchronous = NORMAL');     // Safe + faster than FULL (WAL makes this safe)
db.pragma('foreign_keys = ON');        // Enforce referential integrity
db.pragma('cache_size = -32000');      // 32MB page cache
db.pragma('temp_store = MEMORY');      // Temp tables in memory, not disk
db.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O for faster reads
```

**Query rules:**
- Every frequently-filtered column has an index (see SCHEMA.md).
- `sort_order` uses fractional indexing — reordering one task never rewrites all others.
- FTS5 virtual table handles all search. Never `LIKE '%query%'` on `title`.
- Batch inserts use transactions. Never insert 100 records one at a time.
- The `sync_queue` is the only table the sync worker writes to during normal operation.

---

### 15. Memory Management — Electron-Specific Hooks

Electron exposes a `memory-pressure` event. Use it to release non-essential caches when the OS signals memory pressure.

```typescript
// src/main/main.ts
app.on('memory-pressure', (_event, level) => {
  if (level.level === 'critical' || level.level === 'serious') {
    // Clear non-essential in-memory caches
    searchCache.clear();
    thumbnailCache.clear();
    // Notify renderer to trim non-visible list data
    win.webContents.send(IPC.APP.TRIM_MEMORY);
  }
});
```

In the renderer, respond to `IPC.APP.TRIM_MEMORY` by evicting non-visible task data from Zustand stores (keep only the active list's loaded data).

Additionally, V8's garbage collector can be nudged after heavy operations (bulk import, full sync):

```typescript
// After a heavy batch write in main process
if (global.gc) {
  global.gc();   // Only available with --expose-gc flag; add to electron-builder launch args
}
```

---

### 16. React Rendering Rules

- Components subscribe to the narrowest possible slice of state. A `TaskCard` subscribes to `tasksById[id]` — not the whole task store.
- `React.memo` is applied to `TaskCard`, `ListItem`, and any component rendered inside a virtualizer.
- `useDeferredValue` wraps search input so typing does not block the visible list render.
- `useTransition` wraps list switches so the current list stays visible during the next list's load.
- No `useEffect` without a dependency array.
- No anonymous functions as props to memoized components — they break memoization every render.

---

### 17. Animation Performance Rules (Framer Motion)

- Only animate `transform` and `opacity`. Never animate `width`, `height`, `top`, `left`, `margin`, or `padding` — these trigger layout recalculation on every frame.
- All Framer Motion transitions must complete in < 200ms. Use `ease-out` easing (things feel faster when they decelerate into place rather than ease in).
- Use `AnimatePresence` for task card mount/unmount. The exit animation must be ≤ 150ms — any longer and it slows down mass completion (checking off many tasks quickly).
- `will-change: transform` is set automatically by Framer Motion on animated elements. Do not apply it globally or to static elements — it wastes GPU memory.
- The `reduce_motion` setting (`settings` table key) maps to Framer Motion's `useReducedMotion()` hook. When true, all animated variants are replaced with `{ duration: 0 }`. No animation plays. The UI responds instantly.

```typescript
// src/renderer/hooks/useMotion.ts
import { useReducedMotion } from 'framer-motion';

export function useMotionConfig() {
  const prefersReduced = useReducedMotion();
  const settingReduced = useAppStore(s => s.settings.reduce_motion);
  const skip = prefersReduced || settingReduced;

  return {
    transition: skip ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' },
    spring:     skip ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 },
  };
}
```

Every animated component imports `useMotionConfig()` instead of hardcoding durations.

---

### 18. Security as Performance

The `nodeIntegration: false` + `contextIsolation: true` + `sandbox: true` configuration is both a security requirement and a minor performance win. The sandboxed renderer has a smaller V8 context — it does not initialize the Node.js module system inside the renderer process.

```typescript
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // Required
    nodeIntegration: false,   // Required
    sandbox: true,            // Added security + smaller renderer context
    preload: path.join(__dirname, 'preload.js')
  }
});
```

---

## Pre-Ship Performance Checklist

Before any feature merges, verify:

```
[ ] Does this feature render a list? → Virtual scrolling applied.
[ ] Does this feature write data? → Optimistic update; no spinner.
[ ] Does this feature do I/O? → Runs in worker or main process. Not renderer.
[ ] Does this feature add an animation? → transform/opacity only; ≤ 200ms; useMotionConfig() used; reduced motion handled.
[ ] Does this feature add a Zustand selector? → Narrowest possible slice — not the whole store.
[ ] Does this feature add a SQLite query? → Indexed column; parameterized statement; no LIKE on title.
[ ] Does this feature touch the initial bundle? → If not critical path, it is lazy-loaded.
[ ] Does this feature add a dependency? → Documented in DEPENDENCIES.md with bundle size impact.
[ ] Has the bundle analyzer been run? → No unexpected module in the initial chunk.
```

If any item above is unchecked and the reason is not recorded in an ADR, the feature is not done.

---

## Performance Reference — Electron After Mitigations

These are the numbers from the Electron vs Tauri analysis, applied to OS11. The mitigation strategies above are what move us from the raw column to the target column.

| Metric | Electron raw | OS11 target | Mitigations applied |
|---|---|---|---|
| Cold startup | 2-3 seconds | 1-1.5s (perceived: instant) | Splash screen, parallel startup, code splitting, V8 snapshot |
| Runtime RAM | 200-300MB | < 200MB | Virtual scroll, lazy data load, memory pressure hook |
| Bundle (installed) | 150-250MB | < 150MB | ASAR compression, pruning, tree-shaking |
| Delta update | 150-200MB | < 30MB | `electron-updater` differential updates |
| List render (10K items) | Slow (all DOM nodes) | Instant (50 nodes in DOM) | @tanstack/react-virtual |
| Search | Blocks UI | < 150ms, non-blocking | FTS5 in worker, `useDeferredValue` in renderer |
