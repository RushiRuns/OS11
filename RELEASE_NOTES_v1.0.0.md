# OS11 — Release Notes (v1.0.0)

Welcome to the official **v1.0.0 release of OS11** — an offline-first, deeply focused personal task and time operating system.

---

## 🚀 Highlights

### ⚡ Natural Language Quick Add & Omnibar
- **Instant capture**: Add tasks with human dates, recurrence, priorities, and tags (e.g. `Submit quarterly financials tomorrow at 4pm !high #finance @Projects 🍅`).
- **Flexible syntax**: Supports `@lists`, `#tags`, `!1`–`!4` priority flags, recurrence rules, and emoji focus triggers.
- **Global Quick Add hotkey**: Capture tasks anywhere across your OS without leaving your current workspace.

### 🍅 Built-In Pomodoro & Deep Focus
- **Customizable focus sessions**: Work intervals (25m), short breaks (5m), and long breaks (15m) with clean tray status and mini-timer window.
- **Full-screen Focus Mode (`Ctrl+Shift+F`)**: Zero distraction interface with ambient sound generators (Rain, White Noise, Lo-Fi) and edge dimming.

### 📅 Views for Every Workflow
- **My Day**: Clean slate daily planning with morning rollover recommendations and quick-pick backlog suggestions.
- **Multi-view Projects**: Seamlessly switch between List, Kanban Board, Calendar, and Timeline/Gantt views.
- **Agenda & Objectives**: Habit tracking with consistency streaks, milestone progression, and goal alignment.

### 🔒 100% Offline-First & Private
- **Zero cloud reliance**: All tasks, attachments, and settings reside in a local SQLite database on your machine.
- **App Lock**: Protect sensitive tasks with 4-digit PIN lock and OS keychain integration.
- **Automatic daily backups**: Retained local archive backups with one-click restore and version rollback.

### 🔄 Multi-Format Import & Export
- **One-click migration**: Import from Todoist, Microsoft To Do, Notion databases, or CSV.
- **Universal portability**: Export full JSON snapshots, RFC 4180 CSV tables, Markdown checklists, and attachments ZIP.

### 🎨 Accessible & Fluid Design
- **Keyboard-first navigation**: Complete Vim keybindings support (`j/k`, `gg/G`, `dd`, `o`) and global hotkeys.
- **Universal accessibility**: Full keyboard focus visibility (`:focus-visible`), WCAG color-blind geometric tag shapes (`circle`, `square`, `triangle`), high-contrast mode, and dynamic OS font scaling.
- **Under 200KB initial bundle**: Virtualized lists rendering 1,000+ tasks with zero lag.

---

## 🛠️ Performance & Verification
- **Test Suite**: 42 test suites, 282 automated unit, integration, performance, and E2E flow tests passing with 100% domain coverage.
- **Search Latency**: SQLite FTS5 worker searches across 5,000 tasks complete in under 5ms (<150ms budget).
- **Bundle Size**: Initial JavaScript payload is **195.43 kB gzipped** (target <200 KB) and CSS is **15.64 kB gzipped** (target <30 KB).
