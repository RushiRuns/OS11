# OS11 — Dependencies

> No new package is added without a written justification here.
> Run `npm audit` before every release. No package with a known high or critical vulnerability ships.
> When an alternative was evaluated and rejected, it is listed under "Banned Alternatives" — do not re-open those decisions without an ADR.
>
> Phase 2 packages are marked. They are not installed until companion/collaboration development begins.

---

## Approval Process

Before adding any new package:

1. Is there already an approved package that covers this need? If yes, use it.
2. Does the package have an active maintainer and recent releases?
3. Does `npm audit` come back clean?
4. Is the bundle size acceptable? Document it here.
5. Write the justification in this file before the first commit that includes the package.

---

## Desktop Layer

### `electron` (latest stable)
**Does:** Desktop shell — native OS window, system tray, global shortcuts, notifications, file system access, auto-updater bridge, IPC between processes.
**Why:** Cross-platform desktop framework that lets us ship a single React + TypeScript codebase to Windows, macOS, and Linux with native OS APIs (notifications, login items, system keychain). Tauri was evaluated and rejected — see ADR-0002.
**Bundle impact:** Ships with Chromium and Node runtimes. Expected and unavoidable.

### `electron-builder`
**Does:** Packages the app into platform distributable formats (`.exe` NSIS installer, `.dmg`, `.AppImage`). Handles code signing, auto-update artifact generation.
**Why:** The de-facto Electron packaging tool. Single config for all three platforms.

### `electron-updater`
**Does:** Auto-update via GitHub Releases or a custom server. Differential (delta) updates where supported.
**Why:** Ships with `electron-builder` and is the recommended pairing. Delta updates keep the download from being the full 120-150MB on every release.

### `keytar`
**Does:** OS keychain integration — Windows Credential Store, macOS Keychain, libsecret on Linux.
**Why:** The app lock PIN and companion device pairing tokens must never be stored in SQLite unencrypted. `keytar` is the standard Electron approach to OS-native secret storage. Used for app lock in Phase 1 and device pairing tokens in Phase 2.

---

## Bundler

### `vite` (5.x)
**Does:** Dev server with HMR, production bundler for the renderer process.
**Why:** Dramatically faster than Webpack for dev iteration. Native ESM. Produces lean production bundles with automatic tree-shaking and code splitting. Native integration with `vite-plugin-electron`.

### `vite-plugin-electron`
**Does:** Integrates Vite with Electron's main and preload process bundling so both renderer and main are handled by a single `vite` command.
**Why:** Avoids maintaining a separate build pipeline for main vs renderer.

### `vite-bundle-analyzer`
**Does:** Visual map of what is in the production bundle.
**Why:** Bundle discipline is a performance requirement. This runs before any release to verify no module crept into the initial chunk that should be lazy-loaded.

---

## Frontend

### `react` (18.x) + `react-dom`
**Does:** UI component model, concurrent renderer, transitions.
**Why:** React 18 concurrent features (`useTransition`, `useDeferredValue`) are used for non-blocking list rendering and search input handling — directly serves the < 30ms interaction target.

### `zustand` (4.x)
**Does:** Minimal state management. Store-per-domain. No boilerplate.
**Why:** Sub-2KB, no providers, no reducers. Surgical subscriptions — components re-render only when their specific slice changes. This is the performance profile the "insane speed" requirement demands.
**Banned alternatives:**
- Redux/RTK — too much boilerplate, overpowered for this use case.
- React Context for global state — known re-render performance problem at scale.

### Radix UI (via `shadcn/ui` scaffold)
**Does:** Headless, fully accessible UI primitives. Installed individually from `@radix-ui/*`. OS11 owns 100% of the styling — Radix provides only the behaviour and accessibility tree.
**Why:** Popovers, dropdowns, dialogs, and tooltips require WAI-ARIA semantics, keyboard navigation, and focus trapping that are non-trivial to build correctly from scratch. Radix handles this without imposing any visual opinions.
**Initialised with:** `npx shadcn@latest init` — generates a clean scaffold; only the primitives listed below are adopted. The `shadcn` component code is ejected into `src/renderer/components/` and styled with CSS Modules + tokens, not Tailwind.
**Approved Radix primitives and their OS11 mapping:**

| Radix primitive | OS11 feature |
|---|---|
| `@radix-ui/react-dropdown-menu` | Right-click task context menus |
| `@radix-ui/react-popover` | Date picker, tag picker, priority picker (inline) |
| `@radix-ui/react-dialog` | Delete confirmation dialogs, Settings modal |
| `@radix-ui/react-collapsible` | Sidebar section collapse / expand |
| `@radix-ui/react-scroll-area` | Task list and sidebar overflow scrolling |
| `@radix-ui/react-tooltip` | Keyboard shortcut hints on hover / focus-visible |

**Styling rule:** No Radix primitive ships with inline styles or a className that isn't a CSS Module reference to a token. If a Radix component requires a Portal, the portal root targets `#radix-portal` in `index.html`.
**Banned alternatives:**
- Headless UI — smaller primitive set; missing Popover and ScrollArea equivalents.
- MUI / Ant Design / Chakra UI — pre-styled; conflicts with the token-based styling system and adds significant bundle weight. See Banned Packages table.

---

## Animation

### `framer-motion` (11.x)
**Does:** Production-grade animation library for React. Spring physics, layout animations, `AnimatePresence` mount/unmount, and shared element transitions via `layoutId`.
**Why:** OS11's FEEL UI requires motion that communicates state without feeling heavy. All of this is achievable in pure CSS, but Framer Motion makes it maintainable and correct across browsers without fighting CSS quirks.
**Integration with @dnd-kit:** Framer Motion handles the *visual* animation of items during drag (smooth movement, spring physics). `@dnd-kit` handles the *logical* drag detection and drop. They are used together — @dnd-kit owns the interaction; Framer Motion owns the look.
**Performance note:** Framer Motion uses the Web Animations API and GPU-composited properties (`transform`, `opacity`) by default. It does not trigger layout reflows on animated elements. `reduce_motion` in the settings table maps to `useReducedMotion()` hook — animations are replaced with instant transitions when enabled.
**Bundle impact:** ~50KB gzipped. Loaded as part of the initial renderer bundle since animations are on the critical path.

**Strict use restriction — Framer Motion is permitted at exactly 4 sites. Every other animation uses CSS transitions via tokens:**

| # | Feature | Motion type |
|---|---|---|
| 1 | **Checkbox completion** | Spring bounce (`--ease-spring`) + line-through reveal |
| 2 | **Detail panel** | Spring slide-in from right (`x: '100%' → 0`) |
| 3 | **Task list reorder** | `layoutId` layout animation during drag-and-drop |
| 4 | **Quick-add bar** | Scale + opacity appear / dismiss (`scale: 0.96 → 1`) |

If a Preact migration occurs in the future, `motion` (`motion.dev`) is the direct replacement — same API, framework-agnostic.

**Banned alternatives:**
- React Spring — comparable capability, less ergonomic API for layout animations.
- GSAP — overkill for the 4 use-sites; large bundle; licence cost for some plugins.
- CSS-only transitions for the 4 Framer Motion use-sites — achievable but not maintainable for spring physics and layout animations.
- `animate.css` — static class-based; no programmatic control.

---

## Database

### `better-sqlite3`
**Does:** Synchronous SQLite driver for Node.js. Runs in the main process.
**Why:** Synchronous API means no Promise chains or async complexity in the repository layer. SQLite is the local-first data store — disk I/O is fast enough that sync reads never block. Zero external dependencies.
**Banned alternatives:**
- `sql.js` — runs entirely in-memory (no persistence without manual serialization).
- `node-sqlite3` — async callback API, less ergonomic, same underlying engine.
- Prisma — ORM abstraction is unnecessary overhead; we own our schema and migrations directly.

---

## Natural Language Parsing

### `chrono-node`
**Does:** Parses human-readable date/time strings into structured `Date` objects. Handles "next Monday", "tomorrow at 3pm", "in 2 weeks", "every Friday".
**Why:** The most accurate and maintained NLP date parser for JavaScript. Covers all the quick-add syntax in the feature spec.
**Scope:** Used in the domain layer (`src/main/domain/nlp.ts`). Results are mapped to ISO 8601 strings before any store or database write.

### `rrule`
**Does:** Parses and generates RFC 5545 RRULE strings. Computes occurrence sequences for recurring tasks.
**Why:** Recurrence rules need a standards-compliant library. `rrule` is the canonical JS implementation of RFC 5545.

---

## Drag and Drop

### `@dnd-kit/core` + `@dnd-kit/sortable`
**Does:** Accessible, pointer/touch/keyboard drag-and-drop primitives. `@dnd-kit/sortable` adds the sortable-list abstraction.
**Why:** Framework-agnostic, fully keyboard-accessible, pointer-event based (not HTML5 DnD API — which is unreliable for complex interactions). Works alongside Framer Motion: @dnd-kit detects drag intent and drop targets; Framer Motion animates the movement.
**Banned alternatives:**
- `react-beautiful-dnd` — deprecated by Atlassian, no longer maintained.
- `react-dnd` — HTML5 DnD API, accessibility gaps.

---

## Virtualization

### `@tanstack/react-virtual`
**Does:** Headless virtual scrolling — renders only the visible portion of any list into the DOM.
**Why:** Required for any list that can grow unbounded (task list, tag view, search results, notification history). Headless means it works with CSS Modules without imposing a styling API. Mandatory — see PERFORMANCE.md.
**Banned alternatives:**
- `react-window` — less actively maintained; `@tanstack/react-virtual` is the successor.
- No virtualization — not acceptable for any list the user populates over time.

---

## Rich Text

### `@tiptap/react` + `@tiptap/starter-kit`
**Does:** Rich text editor for task notes (bold, italic, bullet lists, inline code, links). ProseMirror-based, headless, CSS-Module-friendly. Outputs clean HTML.
**Why:** Fully keyboard-navigable and accessible. Used only in the task detail panel notes field. Task titles are plain text only.
**Banned alternatives:**
- Quill — old, unmaintained, opinionated CSS.
- Raw `contenteditable` div — not maintainable at this feature depth.

---

## Charts

### `recharts`
**Does:** Declarative chart components (bar, line, pie, area) built on D3 + SVG. React-native API, composable.
**Why:** The dashboard stats module (completion bars, heatmap, trends) are covered by Recharts primitives.
**Scope:** Dashboard module only. Lazy-loaded — not part of the initial bundle.

---

## Utilities

### `uuid`
**Does:** Generates UUID v4 identifiers for all records and for `local_identity`.
**Why:** Client-side ID generation enables optimistic writes and offline-first behaviour with no server round-trip.

### `date-fns`
**Does:** Date arithmetic and formatting utilities. Immutable, tree-shakeable.
**Why:** Used for due-date display, streak calculations, and My Day rollover logic. Import only what is needed — bundle impact is negligible with tree-shaking.
**Banned alternatives:**
- Moment.js — mutable, enormous, deprecated.

### `DOMPurify`
**Does:** Sanitizes HTML before storage or rendering.
**Why:** Task notes accept rich HTML from Tiptap. Any user-entered HTML that touches the DOM must be sanitized first. This is a security requirement, not optional. Runs in the service layer before any notes value is written to SQLite.

---

## Testing

### `vitest`
**Does:** Unit test runner. Vite-native, Jest-compatible API. Fast.
**Why:** Same config as Vite — zero extra setup. Substantially faster than Jest for this project size.

### `@playwright/test`
**Does:** End-to-end testing of the Electron app. Simulates real user interactions across windows.
**Why:** First-class Electron support. E2E tests verify IPC flows, drag-and-drop, and multi-window behaviour that unit tests cannot reach.

### `@testing-library/react`
**Does:** Component tests that simulate user behaviour (click, type, focus).

---

## Phase 2 — Companion Sync & Collaboration

> Install these packages only when Phase 2 development begins. Do not install them in Phase 1.

### `ws`
**Does:** WebSocket server and client for Node.js. Runs in the main process as the sync server that companion devices and collaborators connect to.
**Why:** Lightweight, no-frills WebSocket implementation. The companion app connects to this server over local network. No cloud, no third-party relay.
**Phase 2 scope:** `src/main/services/sync/`

### `bonjour-service`
**Does:** mDNS (Multicast DNS) — advertises the desktop as `os11-sync._tcp.local` on the local network so companion apps can discover the desktop's IP and port without manual configuration.
**Why:** The companion app doesn't need to know the desktop's IP address manually. mDNS handles discovery automatically when both devices are on the same WiFi.
**Phase 2 scope:** `src/main/services/sync/discovery.ts`

### `qrcode`
**Does:** Generates QR codes for companion pairing. The pairing QR encodes `{ ip, port, pairingToken }`.
**Why:** The pairing UX in the spec requires scanning a QR code. `qrcode` renders the QR as an SVG or data URL that the renderer displays in Settings → Companion.
**Phase 2 scope:** `src/main/services/sync/pairing.ts`

---

## Android Companion

> Managed in a separate repository. Listed here for reference.

### `react-native` (0.74+)
**Does:** Android companion app. Shared TypeScript types and business logic from `src/shared/` are reused.

### `ws` (same as desktop)
**Does:** WebSocket client on the Android side, connecting to the desktop server.

---

## Banned Packages — Do Not Add

| Package | Reason |
|---|---|
| Any cloud SDK (`@supabase/supabase-js`, Firebase, AWS Amplify) | OS11 is local-first, no cloud. Requires an ADR and founder sign-off to revisit. |
| Any auth SDK (`auth0`, `@clerk/clerk-js`, `passport`) | No external auth. Identity is device-local. Same sign-off requirement. |
| Any AI/LLM client (`openai`, `@anthropic-ai/sdk`, `ollama`) | No AI in OS11. Requires ADR to revisit. |
| `moment` | Mutable, enormous, deprecated. Use `date-fns`. |
| `lodash` (full build) | Use native equivalents or `lodash-es` with tree-shaking for a specific function. |
| `axios` | `fetch()` is sufficient; adding axios adds weight with no benefit here. |
| `redux` / `@reduxjs/toolkit` | Zustand is the chosen state manager. Do not introduce a second pattern. |
| `react-beautiful-dnd` | Deprecated and unmaintained. |
| `react-window` | Superseded by `@tanstack/react-virtual`. |
| `webpack` / CRA | Vite is the bundler. |
| `electron-forge` | `electron-builder` is the packager. Do not introduce a competing tool. |
| `node-sqlite3` | `better-sqlite3` is the chosen driver. |
| `sql.js` | In-memory only, not suitable for production data. |
| Any CSS-in-JS runtime (`styled-components`, `emotion`, `stitches`) | CSS Modules + CSS Variables is the styling system. Runtime CSS-in-JS adds overhead that conflicts with the performance requirement. |
| `animate.css` | No programmatic control; Framer Motion covers all animation needs. |
| `gsap` (GreenSock) | Overkill for OS11's 4 Framer Motion use-sites; commercial licence required for some plugins. |
| `@mui/material` / `@ant-design/icons` / `@chakra-ui/react` | Pre-styled component systems that conflict with the token-based CSS Modules approach. Bundle weight unjustifiable. Radix UI primitives (via shadcn scaffold) cover all accessibility needs without visual opinions. |
| `react-spring` | Framer Motion is the chosen animation library. Do not introduce a second pattern. |

---

## Bundle Size Targets

| Artifact | Target |
|---|---|
| Renderer initial JS bundle | < 200KB gzipped |
| Renderer initial CSS | < 30KB |
| Total installed app size | < 150MB (Electron + app) |
| Dashboard module (lazy chunk) | < 50KB gzipped |
| Recharts lazy chunk | < 60KB gzipped |
| `framer-motion` (initial bundle) | ~50KB gzipped — acceptable; on critical path |

Lazy chunks load only when the user opens that module for the first time in a session. Run `vite-bundle-analyzer` before every release to verify the split is holding.
