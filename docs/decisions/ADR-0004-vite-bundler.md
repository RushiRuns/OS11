# ADR-0004: Choose Vite as the Primary Bundler and Configure Route-Level manualChunks

## Status
Accepted

## Context
A desktop application built on Electron must maintain instantaneous startup times and lightning-fast developer feedback loops. 

Key requirements:
1. **Cold Startup Performance:** The initial JS bundle executed when the renderer window initializes must be under 200KB gzipped (per PERFORMANCE.md §5).
2. **Fast Dev Iteration:** Hot Module Replacement (HMR) must occur in sub-100ms without restarting the Electron host process.
3. **Unified Multi-Target Builds:** One build tool must orchestrate the React renderer, Electron main process, preload script, and worker threads.

### Evaluated Alternatives
1. **Create React App (CRA):**
   - Deprecated, unmaintained, and bloated. Uses an unoptimized Webpack 5 pipeline with slow cold startup and fragile configuration overriding. Banned.
2. **Custom Webpack Pipeline:**
   - Requires extensive configuration and third-party loaders. Cold rebuilds and dev server starts take several seconds. Hot module replacement degrades as the codebase grows.
3. **Vite (Rollup + esbuild):**
   - Native ESM dev server provides instant startup (<300ms) and instant HMR.
   - Rollup-powered production builds offer superior tree-shaking and deterministic code splitting.
   - First-class support for Electron via `vite-plugin-electron` and `vite-plugin-electron-renderer`.

## Decision
We choose **Vite** as the standard bundler across all processes.
We enforce explicit route-level and feature-level code splitting via Rollup's `manualChunks` configuration in `vite.config.ts`.

### Bundle Splitting Strategy (PERFORMANCE.md §5)
1. **Critical Initial Bundle:**
   - Only components needed for the immediate first render are in the initial chunk: `App`, `Sidebar`, `TaskList`, and `DetailPanel`.
2. **Lazy Feature Chunks (`manualChunks`):**
   - Heavy, non-immediate features are explicitly split into dedicated on-demand chunks loaded via React `lazy()`:
     - `dashboard` (includes heavy dependencies like `recharts`)
     - `agenda`
     - `projects`
     - `pomodoro`
     - `settings`
3. **Zero Leaks:** Third-party data visualization libraries (like `recharts`) must never leak into the initial critical bundle.

## Consequences
- **Positive:**
  - Dev server boots in milliseconds; HMR updates components without losing React state.
  - Critical renderer bundle remains well under the 200KB gzipped budget.
  - Heavy views (`Dashboard`, `Recharts`) are parsed and compiled by V8 only when the user explicitly navigates to them.
- **Negative / Considerations:**
  - Route navigation to lazy-loaded views requires an instantaneous UI transition skeleton (`Suspense` fallback) to avoid blank flicker (codified in DONE.md).
