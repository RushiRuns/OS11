# OS11 — Internal Engineering Changelog

> **Format:** `[YYYY-MM-DD] — [what was built] — [what changed architecturally]`
> **Rule:** Updated at the end of every coding session before committing.

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
