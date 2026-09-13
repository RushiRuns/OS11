# ADR-0002: Choose Electron over Tauri for Desktop Layer

## Status
Accepted

## Context
OS11 requires a robust, cross-platform desktop runtime for Windows (10/11), macOS (Apple Silicon + Intel), and Linux (Ubuntu/Debian/Fedora). The shell must support:
- Frameless custom windowing with native draggable regions and custom controls
- Native system tray integration with contextual menus
- OS keychain credentials access (`keytar`) for PIN protection and pairing tokens
- Multi-process architecture (Main process, Worker Threads, and React Renderer)
- Full-featured local WebSocket server and mDNS broadcast for Phase 2 local companion sync
- Reliable auto-updates via differential delta downloads (`electron-updater`)

### Evaluated Alternatives: Electron vs Tauri
1. **Tauri (Rust + Webview2 / WebKit):**
   - *Pros:* Significantly lower initial baseline RAM (30-50MB idle vs 80-110MB in Electron) and smaller installer download sizes (~10-15MB).
   - *Cons:*
     - Webview fragmentation: Uses Safari WebKit on macOS, Microsoft WebView2 on Windows, and WebKitGTK on Linux. This causes inconsistent CSS rendering (especially sub-pixel text rendering, flexbox/grid edge cases, and font metric variations) violating the "FEEL UI" North Star.
     - Linux WebKitGTK dependencies frequently break across user distributions.
     - In Phase 2, running a high-throughput local WebSocket server and handling peer discovery requires writing substantial Rust backend code and serializing through Tauri's IPC bridge, splitting our codebase between Rust and TypeScript.
     - Keychain access and background workers require additional Rust FFI bindings and crates.
2. **Electron (Chromium + Node.js):**
   - *Pros:*
     - 100% unified rendering engine (Chromium) across all operating systems. Pixel-identical appearance and performance.
     - Single language ecosystem: TypeScript across Main process, Worker threads, and Renderer.
     - Native Node.js APIs available directly in the Main process for local networking, file system streaming, and native OS APIs (`keytar`).
     - Extremely mature ecosystem for auto-updates, crash reporting, and cross-platform window management.
   - *Cons:*
     - Higher baseline memory footprint and larger distribution bundle (~120-150MB).

## Decision
We choose **Electron** paired with `electron-builder` and `electron-updater` for OS11.

## Consequences & Mitigations (per PERFORMANCE.md)
To counteract Electron's inherent resource overhead and ensure the **Insane Speed** North Star is achieved:
1. **Preloaded Hidden Window:** A hidden window is created and warmed during startup, enabling sub-30ms instant show times when activated.
2. **Strict Bundle Size Discipline:** Cold renderer bundle capped at <200KB gzipped via route-level code splitting (`manualChunks`).
3. **Dedicated Worker Threads:** Search indexing and heavy data transforms are offloaded to a Node worker thread (`src/worker/`) to keep the main and renderer event loops completely free of jank.
4. **List Virtualization:** Large lists are virtualized with `@tanstack/react-virtual`, ensuring memory remains constant whether a list has 10 tasks or 10,000.
5. **Differential Updates:** `electron-updater` downloads only delta changes rather than the entire 150MB binary on each release.
