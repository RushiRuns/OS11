# ⚡ OS11 — Feature Specification
### An Electron-Based Task Manager (Microsoft To Do × Apple Reminders × Beyond)

---

## Table of Contents

1. [Philosophy & Core Architecture](#1-philosophy--core-architecture)
2. [FEEL UI — The Design Philosophy](#2-feel-ui--the-design-philosophy)
3. [Extreme Convenience — Interaction Design](#3-extreme-convenience--interaction-design)
4. [Performance — Insane Speed](#4-performance--insane-speed)
5. [Keyboard-First Design](#5-keyboard-first-design)
6. [System Integration (Startup, Background, Omnibar, Always-on-Top)](#6-system-integration)
7. [Task Management — Core](#7-task-management--core)
8. [Project Management](#8-project-management)
9. [Pomodoro & Custom Timer](#9-pomodoro--custom-timer)
10. [Agenda & Goals](#10-agenda--goals)
11. [Dashboard & Statistics](#11-dashboard--statistics)
12. [Scheduling](#12-scheduling)
13. [Collaboration *(Phase 2)*](#13-collaboration)
14. [File Attachments](#14-file-attachments)
15. [OS-Level Notifications](#15-os-level-notifications)
16. [Tags & Important Tasks](#16-tags--important-tasks)
17. [Theming — Dual Theme & Background Change](#17-theming--dual-theme--background-change)
18. [Android Companion App *(Phase 2)*](#18-android-companion-app)
19. [Modular Settings (Feature Toggle)](#19-modular-settings-feature-toggle)
20. [Inspired by Microsoft To Do](#20-inspired-by-microsoft-to-do)
21. [Inspired by Apple Reminders](#21-inspired-by-apple-reminders)
22. [Additional Recommended Features](#22-additional-recommended-features)
23. [Tech Stack Summary](#23-tech-stack-summary)

---

## Build Phase

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Desktop app — Windows, macOS, Linux. All data local. No cloud, no external auth, no AI. | **Current** |
| **Phase 2** | Android companion app + Collaboration. Sync via local network (WebSocket + mDNS). No cloud required at any phase. | Planned |

Sections and modules marked ***(Phase 2)*** are designed into the architecture from day one but are not built until Phase 2 begins.

---

## 1. Philosophy & Core Architecture

> **"Open in under 100ms. Do the job. Get out of the way."**

OS11 is built around five non-negotiable principles. Every feature, every interaction, every design decision is measured against all five. If something violates one, it goes back to the drawing board.

| North Star | One-line definition |
|---|---|
| ⚡ **Insane Speed** | The app should feel faster than writing on paper. |
| ⌨️ **Keyboard Native** | Every action is reachable without ever touching the mouse. |
| 🧩 **Modular** | Users activate only what they need. Clutter is the enemy of focus. |
| 🤲 **Extreme Convenience** | Every interaction is designed to require the least possible effort from the user. |
| 🌌 **FEEL UI** | The UI is feature-rich, but the user always feels like it is spacious and uncluttered. |

These are not marketing words. They are the rejection criteria for any proposed feature. A feature that adds speed at the cost of convenience gets redesigned, not shipped. A feature that adds richness at the cost of the FEEL gets hidden, not displayed.

The app targets **Windows**, **macOS**, and **Linux** via Electron in Phase 1, with an **Android companion app** joining in Phase 2.

---

## 2. FEEL UI — The Design Philosophy

> **"Show only what's necessary. Everything else is one deliberate gesture away."**

FEEL UI is OS11's visual and interaction design language. The name stands for **Focused, Elegant, Effortless Layout**. The closest references in the real world are Apple Reminders and Microsoft To Do — apps that are genuinely feature-rich but never *feel* cluttered. The guiding principle is the same as abstraction in OOP: **expose only the interface; hide the implementation**.

### 2.1 Core Rules of FEEL UI

- **Reveal on intent, not on load.** Secondary actions (edit, delete, move, tag) appear only when the user signals intent — hover, right-click, or a keyboard trigger. The default state of every view is calm.
- **One focal point per view.** At any moment, the UI draws the eye to exactly one thing: the task list, the detail panel, the timer. Supporting elements recede visually.
- **Whitespace is a feature.** Generous spacing is not wasted space. It is the breathing room that makes a dense feature set feel light.
- **Depth over breadth.** Features are layered. The most common 20% of actions are on the surface. The remaining 80% live one level deeper — accessible but invisible until needed.
- **No status-bar clutter.** Metadata (due date, tags, subtask count, priority) is shown on a task card only when it exists. A task with no due date shows no date field — not an empty one.

### 2.2 Progressive Disclosure — The FEEL Pattern

Every feature in OS11 follows a three-layer disclosure pattern:

```
Layer 1 — Default view (always visible):
  Task title, completion checkbox, star/importance flag.

Layer 2 — Hover / focus state (appears on intent):
  Due date chip, tag chips, subtask count, action row (edit, move, delete).

Layer 3 — Detail panel / expanded state (opened explicitly):
  Full notes, subtasks list, attachments, recurrence, comments, history.
```

This means a user who only creates simple tasks sees a clean, minimal list. A power user who opens the detail panel finds the full depth. The *same* UI serves both without compromise.

### 2.3 FEEL UI in Practice — Component Specs

**Task Cards**
- Resting state: title + checkbox. Nothing else unless the task has data to show.
- Hover state: a single action row fades in below the title (`Edit`, `Move`, `Delete`, `…`).
- **Priority:** rendered as a `2.5px solid` left border in the priority color. Never a badge, icon, or separate column. Critical priority tasks additionally get a `pulse` animation (1.5s ease-in-out, alternating opacity 1 → 0.6).
- **Tags:** three display forms depending on context:
  - **Dot form** — 18px circle (`--radius-full`): resting state on any task card.
  - **Chip form** — rounded pill with label (`--text-sm`, `--radius-full`): hover state on cards and in the detail panel.
  - **Project dot** — 10px circle + text label: sidebar project list only.
- **Star / Importance:** `--color-star` (`#F4B942`) fill. Never accent-colored or red.
- **Subtask progress:** shown as `◎ N/M` when subtasks exist; hidden when there are none.
- **Overdue dates:** date chip text and background tint switch to `--color-danger`.
- **Completed tasks:** title gets `text-decoration: line-through` in `--text-tertiary` color.

**Checkbox**
- 20px circle (`--checkbox-size`), `1.5px` border (`--checkbox-border-width`).
- Resting: `--border-default` border, transparent fill.
- Checked: `--accent` fill, white checkmark, spring bounce animation via `--ease-spring` (Framer Motion).
- Project-colored variants: checkbox border and fill match the task's project color when assigned.
- Reduced motion: instant fill, no spring.

**Buttons — three semantic variants plus a size modifier:**
- `.btn-primary` — accent fill, white text, `--radius-sm` border radius.
- `.btn-ghost` — transparent background, `--text-primary` text; border appears on hover.
- `.btn-danger` — `--color-danger` fill on hover; resting state is ghost-styled.
- `.btn-sm` modifier — `padding: var(--space-1) var(--space-3)`, `font-size: var(--text-sm)`.
- Focus ring: `var(--shadow-focus)` — visible only on `focus-visible`.

**Quick-Add Bar**
- Fixed height `var(--quick-add-height)` (52px), `--radius-xl` radius.
- Contains: a circular `+` icon button on the left, and a text trigger (`"Add a task…"`) that expands into a full input on click.
- Appears via Framer Motion scale + opacity (`scale: 0.96 → 1`, `opacity: 0 → 1`).
- Dismisses on `Escape` or click-outside.

**Inputs**
- Border: `var(--border-default)`, radius: `var(--radius-md)`, padding: `var(--space-2) var(--space-3)`.
- Focus: `var(--accent-border)` border + `var(--shadow-focus)` ring.
- Error: `var(--color-danger)` border + error message below in `--text-xs`.
- Placeholder: `var(--text-placeholder)` color.

**Sidebar**
- List names are shown. Icons optional. Unread/pending counts shown only when non-zero.
- **Core smart views** (always present, non-removable):
  - ☀️ Today, 📅 Upcoming, 📋 Anytime, 🌙 Someday, ⭐ Important
  - Counts appear as small rounded badges only when non-zero.
- Projects listed below smart views with a 10px colored project dot + name + optional task count.
- Smart lists (My Day, Important, Planned) are grouped under a single collapsible header — not always expanded by default.
- Disabled modules are not shown at all in the sidebar — they do not exist in the UI until enabled.

**Detail Panel**
- Opens as a right-side drawer (`var(--detail-panel-width)` = 320px), not a modal, so the task list remains visible.
- Sections (Notes, Subtasks, Attachments, Reminders) are collapsed by default; each expands individually when the user needs it.
- Empty sections display no placeholder text — they simply don't exist visually until clicked.

**Settings**
- Settings are grouped into categories. Advanced settings live under a secondary "Advanced" toggle within each category — a user who doesn't need them never sees them.
- Feature toggles (Modules page) let users permanently hide entire UI sections.

### 2.4 Motion & Animation

- All CSS transitions are **under 200ms**, eased with `ease-out` curves (`--ease-out`). Nothing lingers.
- **Framer Motion is restricted to 4 specific use-sites** (see ARCHITECTURE.md §UI Component Architecture). Everything else — hover states, sidebar selection, button presses, popover fades — uses CSS `transition` via token shorthands.
  1. Checkbox completion — spring bounce + line-through.
  2. Detail panel open/close — spring slide from right.
  3. Task list reorder — `layoutId` layout animation.
  4. Quick-add bar appear/dismiss — scale + opacity.
- Animations communicate state changes (task completion, drag-drop landing, panel open/close) — they are never decorative.
- Reduced motion mode (Settings → Accessibility or OS `prefers-reduced-motion`) disables all Framer Motion transitions; instant layout changes remain for feedback.
- The "spacey" feel comes from **timing** as much as layout: things appear and disappear decisively, never sluggishly.

### 2.5 Typography & Density

- Task titles use `--weight-medium`. Supporting metadata (dates, tags) uses `--weight-regular` and `--text-sm` — visually subordinate.
- Three density modes: **Comfortable** (default, 44px task height), **Compact** (34px), **Cozy** (56px). Toggled via `.density-compact` / `.density-cozy` class on `<html>`.
- Line height (`--leading-normal`, 1.5) is generous enough that a full list never feels like a wall of text.

---

## 3. Extreme Convenience — Interaction Design

> **"The best interaction is the one the user didn't have to think about."**

Extreme Convenience means measuring every user action by the question: *could this require less effort?* The benchmark is Apple Reminders — an app where every gesture feels obvious in hindsight. OS11 applies this principle at the interaction layer, not just the feature layer.

### 3.1 Drag-and-Drop as a First-Class Citizen

Drag-and-drop is not a nice-to-have. It is a primary interaction mode for the most common task operations.

| Drag action | Result |
|---|---|
| Drag **task → task** (drop on top of another task) | The dragged task becomes a **subtask** of the target. |
| Drag **task → list** in the sidebar | Moves the task to that list instantly. |
| Drag **task → "My Day"** in the sidebar | Adds the task to My Day without moving it from its original list. |
| Drag **task → section header** within a project | Moves task into that section. |
| Drag **task → time slot** in Agenda view | Schedules the task to that time block. |
| Drag **subtask → outside parent** | Promotes it to a standalone task in the same list. |
| Drag **file → task card** | Attaches the file to that task. |
| Drag **tasks to reorder** within a list | Manual sort order is saved persistently. |

Every drag operation has a visible drop target indicator and is fully undoable with `Ctrl+Z`.

### 3.2 Context Menus — The Power Behind Right-Click

Right-clicking any task opens a context menu with all high-frequency operations immediately accessible. No navigating to a detail panel required.

Right-click task menu:
- Complete / Uncomplete
- Star / Unstar
- Set due date → inline mini date picker
- Set priority → inline priority picker
- Add to My Day / Remove from My Day
- Move to list → inline list picker
- Add tag → inline tag picker
- Duplicate task
- Create subtask
- Open detail panel
- Delete (with immediate undo toast)

### 3.3 Inline Editing — Never Leave the List

Users should rarely need to open a detail panel for common edits. The task list itself supports:

- **Click task title** → title becomes an editable input in-place. `Enter` saves. `Escape` cancels.
- **Click due date chip** → mini date/time picker opens inline, attached to the chip. No panel required.
- **Click tag chip** → opens tag picker attached to the chip.
- **Click priority dot** → opens a 5-option priority picker inline.
- **Tab inside a task** → immediately creates a subtask indented below, with cursor ready to type.

### 3.4 Smart Defaults — Decisions the App Makes So the User Doesn't Have To

- When a task is created in a specific list, it is automatically assigned to that list.
- When "Add to My Day" is triggered in the morning, the task gets today's date as a soft due reminder automatically.
- When a user types a due date in natural language and the time is past midnight, the app infers "next occurrence" automatically.
- When duplicating a recurring task, the user is asked once whether to copy recurrence settings — then that choice is remembered.
- When dragging a task to create a subtask, the subtask inherits the parent's list, tags, and assignee by default (adjustable per preference).

### 3.5 Undo Everything — Zero Fear of Mistakes

- Every destructive action (delete, complete, move, bulk-clear) shows an **undo toast** at the bottom of the screen for 5 seconds.
- `Ctrl+Z` works application-wide for all actions, not just text editing.
- Full undo/redo history is maintained per-session.
- Deleted tasks go to a **Trash** (recoverable for 30 days) rather than being permanently removed immediately.

### 3.6 Bulk Operations — Act on Many with One Motion

- Hover over any task → a subtle checkbox appears on the left.
- Clicking the checkbox enters **multi-select mode**.
- Additional checkboxes appear on all other tasks; click to add to selection.
- A **floating action bar** rises from the bottom of the list with bulk actions: Complete, Delete, Move, Tag, Set Priority, Add to My Day.
- `Ctrl+A` selects all tasks in the current list.
- Escape or clicking away exits multi-select mode.

### 3.7 Quick Add Everywhere

The user should never have to navigate to "the right place" before adding a task.

- **Global hotkey** (`Ctrl+N` from anywhere) opens a floating quick-add field.
- **Omnibar** (`Ctrl+Space`) supports adding tasks with full natural language parsing without opening the app.
- **Tray right-click → Quick Add** works even when the app is completely hidden.
- **"+" button** at the top of every list — always visible, always one click away.
- In the **task list itself**: pressing `Enter` when no task is selected opens a new task input at the bottom of the list with the cursor ready.

### 3.8 Convenience-First Notifications

- Notifications are **actionable** — "Complete ✓" and "Snooze 15min" buttons are in the notification itself. No need to open the app.
- Snooze presets are shown as quick options: 15 min / 1 hr / Tomorrow morning.
- Clicking a notification opens the app and **focuses the exact task** — not just the app homepage.

### 3.9 Rollover & Smart Day Transitions

- At midnight (or a user-set "day starts at" time), My Day resets — but unfinished tasks are not silently dropped. A **rollover prompt** appears: "You have 3 unfinished tasks from yesterday. Keep them in My Day?"
- One tap to roll all over, one tap to dismiss, or individually cherry-pick.

---

## 4. Performance — Insane Speed

This is the single most important technical requirement. Every decision below serves sub-100ms perceived launch. Speed is not a feature — it is a precondition for everything else.

### 4.1 Preloading & Background Process
- The main Electron process **starts at OS login** and loads the renderer in the background silently.
- When the user triggers the app (hotkey, tray click, omnibar), the window is already in memory — it just becomes **visible instantly**.
- A hidden `BrowserWindow` is kept alive with `show: false`. On trigger, it calls `win.show()` — perceived open time: **< 30ms**.

### 4.2 Renderer Optimization
- Use **Vite** (not Webpack/CRA) for bundling — extremely fast dev + lean production bundles.
- **React 18** with surgical renders and `useTransition` / `useDeferredValue` for non-blocking updates.
- Animations use **Framer Motion** — GPU-composited properties only (`transform`, `opacity`), never triggering layout recalculation.
- CSS is pre-compiled and injected at startup via CSS Modules; no runtime style computation on open.
- First paint shows a **splash screen** then a **skeleton UI** within one frame, then data hydrates immediately from local cache.

### 4.3 Local-First Data
- All data lives in **SQLite** (via `better-sqlite3`) on disk — zero network latency for reads.
- At startup, only the **active list's first 50 tasks** are loaded. Everything else is lazy-loaded on demand.
- In Phase 2, data syncs to connected companion/peer devices **in the background** over local network — this never blocks the UI thread.
- All drag-and-drop operations, completions, and inline edits are committed to SQLite immediately and optimistically reflected in the UI — no "saving…" spinners.

### 4.4 Process Architecture
- Main process: task management, IPC, tray, hotkeys, notifications — **Node.js**.
- Renderer process: UI only — communicates via Electron IPC (`contextBridge`).
- Worker thread: search indexing, file processing, sync (Phase 2) — never touches the UI thread.

### 4.5 Cold Start (Rare Case)
- Even a true cold start targets **< 1.5 seconds** to interactive, with a splash screen covering the delay.
- App bundle targets **< 150MB** installed. Non-critical modules (Dashboard, Agenda, Projects) are lazy-loaded chunks.
- `app.setAppLogsPath()` and aggressive **V8 snapshot caching** reduce JS parse time on subsequent starts.

---

## 5. Keyboard-First Design

Every single action in the app has a keyboard shortcut. The mouse is optional, always.

### 5.1 Global Shortcuts (OS-Level)
| Action | Default Shortcut |
|---|---|
| Open / Focus App | `Ctrl+Shift+Space` (Win/Linux), `Cmd+Shift+Space` (Mac) |
| Open Omnibar | `Ctrl+Space` / `Cmd+Space` |
| Quick Add Task | `Ctrl+N` / `Cmd+N` |
| Toggle App Visibility | `Ctrl+Shift+H` |

### 5.2 In-App Shortcuts
| Action | Shortcut |
|---|---|
| Navigate lists | `↑ ↓` Arrow keys |
| Complete task | `Space` or `Ctrl+Enter` |
| Edit task | `Enter` or `F2` |
| Delete task | `Delete` / `Backspace` |
| Mark important | `Ctrl+I` |
| Add subtask | `Tab` (indents into subtask below) |
| Promote subtask to task | `Shift+Tab` |
| Move to list | `Ctrl+Shift+M` |
| Set due date | `Ctrl+D` |
| Add tag | `Ctrl+T` |
| Search | `Ctrl+F` or `/` |
| Switch tabs / lists | `Ctrl+1` through `Ctrl+9` |
| Open Pomodoro | `Ctrl+P` |
| Open Dashboard | `Ctrl+Shift+D` |
| Open Command Palette | `Ctrl+K` |
| Multi-select mode | `Ctrl+Click` or `Shift+Click` |
| Select all (in list) | `Ctrl+A` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |

### 5.3 Vim-Style Navigation (Optional, Toggleable)
- `j/k` to move up/down tasks.
- `g g` to jump to top, `G` to jump to bottom.
- `d d` to delete, `c c` to complete, `s s` to star.
- `o` to open detail panel.
- Toggled in Settings → Input Preferences.

### 5.4 Quick Add Syntax (Natural Language Parsing)
Type in omnibar or quick-add and the app parses it:
- `"Submit report #work !high tomorrow 2pm"` → task: "Submit report", tag: work, priority: high, due: tomorrow 2pm.
- `"Call dentist next Monday @personal"` → due: next Monday, list: personal.
- `"Review PR in 3 days 🍅"` → adds a Pomodoro session.
- `"Buy groceries every Sunday !low"` → recurring task, due each Sunday, low priority.

The parser shows a **live preview chip** below the input as the user types, so the parsed result is always confirmed before submitting — no surprises.

---

## 6. System Integration

### 6.1 Startup App
- Registers itself as a **login item** on Windows (Registry), macOS (LaunchAgent), and Linux (XDG autostart).
- Starts **minimized to tray** — no window shown unless the user opens it.
- Controlled from Settings → "Launch at Login" toggle.

### 6.2 Background Behavior (After Window Close)
- Closing the window does **not** quit the app.
- The process stays alive in the **system tray** (Windows/Linux) or **menu bar** (macOS).
- Tray icon shows today's pending task count as a badge.
- Right-click tray menu:
  - Open OS11
  - Quick Add Task
  - Today's Tasks (expandable list)
  - Pomodoro: Start / Pause / Skip
  - Quit

### 6.3 OS-Level Omnibar
- A **floating, frameless overlay window** that appears anywhere on screen via global hotkey.
- Appears centered on the active monitor.
- Supports: quick task creation, searching existing tasks, opening specific lists, starting a Pomodoro.
- Closes on `Escape` or click-outside.
- Styled to match the OS or the app's current theme.
- Live parse preview shown below the input as the user types.

### 6.4 Always on Top (Keep on Top)
- A toggle button in the window titlebar pins the app **above all other windows**.
- Shortcut: `Ctrl+Shift+T`.
- Stays on top across virtual desktops/spaces.
- Opacity can be reduced (50%–100%) when "Always on Top" is enabled so it doesn't obstruct reading.
- State is saved per-session.

---

## 7. Task Management — Core

### 7.1 Task Structure
Each task supports:
- **Title** (required)
- **Notes / Description** (rich text: bold, italic, bullets, code)
- **Due Date & Time**
- **Reminder** (one or multiple, before due date)
- **Repeat / Recurrence** (daily, weekly, monthly, custom: "every 2nd Tuesday")
- **Priority** (None / Low / Medium / High / Critical)
- **Importance flag** (⭐ star — Microsoft To Do style)
- **Tags** (multiple)
- **List assignment**
- **Project assignment**
- **Subtasks** (nested, with their own due dates)
- **File attachments**
- **URL links** (auto-detected in notes)
- **Estimated duration** (e.g., "1h 30m")
- **Assigned to** (for collaboration — Phase 2)
- **Created / Modified / Completed timestamps**
- **Completion %** (for tasks with subtasks)

> **FEEL UI:** On a task card in the list view, only the fields that have data are rendered. A task with no due date shows no date field — not a greyed-out or empty one. The detail panel reveals the full structure on demand.

### 7.2 Smart Lists (Auto-Generated)
Inspired by Microsoft To Do:
- **My Day** — User curates daily focus tasks.
- **Important** — All starred/flagged tasks.
- **Planned** — Tasks with a due date.
- **Assigned to Me** — Tasks assigned to this device's user (Phase 2).
- **All Tasks** — Everything.
- **Completed** — Finished tasks, grouped by date.

### 7.3 My Day
- Resets every morning; previously added tasks are not silently dropped. A **rollover prompt** appears: "You have N unfinished tasks from yesterday. Keep them?" (see §3.9).
- **"Add to My Day" suggestion panel** — app suggests tasks based on due dates, priority, and patterns.
- Weather widget (optional) shown at top of My Day.

### 7.4 Task Actions
> **Extreme Convenience:** All of the following are available without opening the detail panel.

- **Drag task → task** to create subtask relationship.
- **Drag task → list** in sidebar to move it.
- **Drag task → My Day** to add without moving.
- **Right-click** for the full context menu (see §3.2).
- **Inline edit** any field by clicking it directly on the card (see §3.3).
- Multi-select with checkbox hover → bulk action bar (see §3.6).
- Undo / Redo for all destructive actions (`Ctrl+Z` / `Ctrl+Y`).
- Copy task (duplicate).
- Share task (generates a share code if collaboration is enabled — Phase 2).

### 7.5 Sorting & Filtering
Sort by: Due date, Priority, Alphabetical, Creation date, Completion status, Custom (manual drag).
Filter by: Tag, Priority, Due date range, Assignee, Attachment presence, Incomplete only.

> **FEEL UI:** Filter/sort controls live in a collapsible row at the top of the list. When no filters are active, this row shows only a subtle icon — it does not occupy permanent space.

---

## 8. Project Management

A dedicated **Projects** tab for managing multi-task work with structure.

### 8.1 Project Structure
- **Project** → contains **Sections** → contains **Tasks** → contains **Subtasks**.
- Projects have: Title, Description, Color/Icon, Due date, Team members (Phase 2), Status (Active/Archived/Completed).

### 8.2 Views
Switch between views per project:
- **List View** — Classic task list grouped by section.
- **Board View (Kanban)** — Drag cards between columns (To Do / In Progress / In Review / Done).
- **Timeline View (Gantt)** — Horizontal bar chart, drag to reschedule, shows dependencies.
- **Calendar View** — Tasks plotted on a calendar grid.
- **Table View** — Spreadsheet-like, all fields editable inline.

> **Extreme Convenience:** View switching is a single click from a view toggle at the top of the project. The chosen view is remembered per-project.

### 8.3 Project Features
- **Task Dependencies** — "Task B starts after Task A."
- **Milestones** — Key dates marked on the timeline.
- **Project Overview** — Progress ring, task count by status, overdue count.
- **Activity Feed** — Log of all changes made to the project and its tasks.
- **Project Templates** — Save a project structure as a reusable template.
- **Export** — Export project to CSV, PDF, or Markdown.

---

## 9. Pomodoro & Custom Timer

### 9.1 Pomodoro Timer
- Classic **25/5 minute** work/break cycle, configurable.
- Session linked to a specific task — drag a task onto the timer widget to link it.
- Full-screen focus mode during a session: hides everything except the current task and timer (FEEL UI at its most focused).
- **Pomodoro count per task** shown as 🍅 icons on the task card (visible only when > 0).
- Sound alerts: choose from built-in sounds or upload custom audio.

### 9.2 Custom Timer
- Set any work duration (1 min – 8 hours) and break duration.
- **Long break** after N sessions (configurable).
- **Auto-start** next session or wait for manual start.
- Pause / Resume / Skip / Reset controls.

### 9.3 Distraction Blocker (Optional Integration)
- While a Pomodoro session is running, the app can trigger an OS-level "Do Not Disturb" mode.
- Suppresses all non-critical notifications for the duration of the session.

### 9.4 Timer Visibility
- Timer always visible in the **tray/menu bar** during a session.
- Mini floating timer widget (always-on-top, draggable) that shows even when the main app is closed.
- **Progress ring** animation on the tray icon.

---

## 10. Agenda & Goals

### 10.1 Daily Agenda
- A planner view showing all tasks due today, ordered by time.
- Morning summary sent as a desktop notification at a user-defined time.
- **Time blocks** — Assign tasks to specific hours of the day by dragging them onto the time grid.
- Unscheduled tasks shown in a sidebar panel for easy drag-onto-timeline.

> **Extreme Convenience:** Dragging an unscheduled task from the sidebar onto a time slot in the Agenda sets both the due time and creates a time block in one gesture.

### 10.2 Weekly Agenda
- 7-day scrollable timeline view.
- Blocked time visible (work hours, meetings imported from calendar integration).
- "Load balancing" indicator — warns if a day is over-packed.

### 10.3 Goals
- **Goal** → set a high-level objective with a target date.
- Link tasks and projects to a goal.
- **Progress bar** calculated from completion of linked tasks.
- Goal types: Habit-based (repeat daily/weekly), Milestone-based (complete X tasks), Outcome-based (manual %).
- **Goal streaks** — tracks consecutive days of progress.
- Weekly review prompt: "How's your goal going? Any blockers?"

### 10.4 Habit Tracker (Optional Module)
- Mark specific tasks as habits.
- Visual streak calendar (GitHub contributions-style heatmap).
- Habit chain view showing all habits and today's check-off status.

---

## 11. Dashboard & Statistics

A rich analytics view — understand how you work.

> **FEEL UI:** Dashboard charts are rendered with generous whitespace between them. The view is not a wall of numbers — it opens with 3-4 top-level stats, and detailed charts are accessible by scrolling or expanding sections.

### 11.1 Personal Stats
- **Tasks completed** today / this week / this month / all time.
- **Streak** — consecutive days with at least one task completed.
- **Average completion time** per task (estimated vs actual).
- **On-time rate** — % of tasks completed before their due date.
- **Most productive day** and **most productive hour** (heatmap grid).
- **Pomodoro sessions** completed, total focus time accumulated.

### 11.2 Charts & Graphs
- Bar chart: Tasks completed per day (last 30 days).
- Pie/donut chart: Tasks by list, by tag, by priority.
- Line chart: Completion rate trend over time.
- Heatmap: Activity calendar (full year).
- Burndown chart: Per-project task completion rate.

### 11.3 Project Stats
- Tasks total / completed / overdue / in-progress per project.
- Team member contribution in collaborative projects (Phase 2).
- Velocity: average tasks completed per week.

### 11.4 Focus Stats
- Total deep work time (Pomodoro sessions).
- Focus time by project/tag.
- Distraction interruptions logged.

### 11.5 Export & Reports
- Export stats as PDF or CSV.

---

## 12. Scheduling

### 12.1 Due Dates & Times
- Quick date picker with natural language: "tomorrow", "next Friday", "in 3 days", "end of month".
- Time picker with 15-minute slots or free-form input.
- **All-day** vs **specific time** tasks.

> **FEEL UI:** The date picker is a compact inline popover, not a full-screen modal. It disappears the moment a date is selected — no "OK" button required.

### 12.2 Recurrence Rules
- Pre-sets: Daily, Weekdays, Weekly, Monthly, Yearly.
- Custom rules: "Every 2 weeks on Tuesday and Thursday."
- "After completion" recurrence: "3 days after I mark this done."
- Skipping occurrences without deleting the rule.

### 12.3 Reminders
- Multiple reminders per task (e.g., 1 day before + 1 hour before + at due time).
- Location-based reminders via the Android companion app (Phase 2).
- Snooze directly from the OS notification — no need to open the app.

### 12.4 Calendar Integration
- Sync with **Google Calendar**, **Apple Calendar (CalDAV)**, and **Outlook Calendar**.
- View calendar events alongside tasks in Agenda view.
- Optionally create calendar events from tasks automatically.
- Two-way sync for tasks created in the app ↔ calendar events.

### 12.5 Time Blocking
- Reserve time slots in the Agenda view for specific tasks.
- Drag an unscheduled task onto a time slot to assign it instantly.

---

## 13. Collaboration *(Phase 2)*

> Collaboration is a Phase 2 feature. The data model and architecture support it from day one — nothing in Phase 1 needs to be rebuilt. Collaboration ships alongside the Android companion app. No cloud service is required: sync runs over the local network or a user-hosted relay.

### 13.1 Shared Lists & Projects
- Share any list or project with others via an **invite code** or **QR scan**.
- Permission levels: **Viewer** (read-only) / **Editor** (add/edit tasks) / **Admin** (manage members, delete).
- Shared lists show member avatars and online presence indicators.

### 13.2 Task Assignment
- Assign tasks to one or multiple people from within the task card (inline — no detail panel required).
- Assigned tasks appear in assignee's "Assigned to Me" smart list.
- Re-assignment with notification.

### 13.3 Comments & Activity
- Comment thread on each task (with @mentions).
- @mention sends a notification to that user.
- Activity log shows who changed what and when.
- Emoji reactions on comments.
- Resolve/unresolve comment threads.

### 13.4 Sync Mechanism
- **Local network (same WiFi):** Changes appear live for all connected participants. One device runs a WebSocket server; others connect as clients. Discovery via mDNS — no manual IP entry.
- **Remote (different networks):** Participants connect to a user-hosted relay server (a lightweight WebSocket relay the team runs themselves). OS11 does not operate this relay.
- **Offline-first:** Edits queue locally in the `sync_queue` table and sync automatically when reconnected.
- **Conflict resolution:** Last-write-wins with a conflict history accessible in the task detail panel.

### 13.5 Notifications for Collaboration
- "Sarah completed a task assigned to you."
- "John commented on your task."
- "@mentioned you in a comment."
- All collaboration notifications go to both OS-level and in-app notification center.

---

## 14. File Attachments

### 14.1 Supported Attachment Types
- Images (PNG, JPG, GIF, WebP, HEIC)
- Documents (PDF, DOCX, XLSX, PPTX, TXT, MD)
- Archives (ZIP, RAR)
- Audio / Video
- Any other file type (shown as generic file icon)

### 14.2 Attachment Sources
> **Extreme Convenience:** Files can be attached through any of the following without opening the detail panel.

- Drag-and-drop files onto a task card directly.
- Paste from clipboard (images paste directly with `Ctrl+V` while a task is focused).
- Local file picker.
- Cloud storage links: **Google Drive**, **Dropbox**, **OneDrive** (link reference, not a file copy).
- Screen capture: built-in screenshot tool captures and attaches directly.

### 14.3 Attachment Display
- Image thumbnails shown inline in the task detail panel.
- Click to open in: system default app, or built-in image viewer.
- PDF preview inline (first page thumbnail).
- Total attachment size shown per task.

> **FEEL UI:** Attachment thumbnails are compact and shown in a horizontal scroll strip inside the detail panel. They do not expand the task card in the list view — only a small paperclip icon with a count appears there.

### 14.4 Storage
- All attachments are stored **locally** inside the app's data directory (`app.getPath('userData')/attachments/`).
- Attachment search: search by filename across all tasks.
- **Export attachments** as part of the full data export.

---

## 15. OS-Level Notifications

### 15.1 Notification Types
- **Due date** — "📌 Submit report is due now."
- **Reminder** — "⏰ Team meeting in 30 minutes."
- **Pomodoro** — "🍅 Focus session complete. Take a break!"
- **Collaboration** — "@John mentioned you." *(Phase 2)*
- **Daily Agenda** — Morning summary at user-set time.
- **Goal nudge** — "You haven't worked on 'Learn Spanish' today."
- **Streak alert** — "Don't break your 14-day streak! Complete one task today."

### 15.2 Notification Behavior
> **Extreme Convenience:** Common actions are available directly inside the notification — no app open required.

- Native OS notifications (using Electron's `Notification` API).
- **Actionable notifications**: "Complete ✓" / "Snooze 15min" / "Open Task" buttons directly in the notification.
- Snooze presets: 15 min / 1 hr / Tomorrow morning — all accessible from the notification.
- Click notification → opens app and focuses the relevant task.
- **Notification Center** inside the app (bell icon) — full history of all alerts.
- Quiet Hours — suppress non-critical notifications between set hours.

### 15.3 Notification Channels
- Per-category toggles: Due dates, Reminders, Collaboration (Phase 2), Pomodoro, Goals.
- Per-list notification settings.
- Notification sound: choose from presets or mute.

---

## 16. Tags & Important Tasks

### 16.1 Tags
- Create unlimited custom tags.
- Each tag has a **name** and **color** (pick from palette or custom hex).
- Assign multiple tags to one task — from the task card inline (no detail panel required).
- Tags appear as small colored dots on task cards; full chip labels shown only in the detail panel.
- **Tag view** — click any tag to see all tasks with that tag across all lists.
- Filter and sort by tag in any view.
- **Nested tags** — e.g., `work/client/Acme` for hierarchy.
- Rename/merge/delete tags (with batch update across tasks).
- **Auto-tag** — set rules like "tasks in list Work → auto-tag #professional."

### 16.2 Important / Starred Tasks
- Star (⭐) any task to mark it as Important.
- Shortcut: `Ctrl+I` or click the star icon on the task card.
- All starred tasks appear in the **Important** smart list.
- Starred tasks are visually distinct: gold star icon + subtle highlight.
- Star is independent of priority — a task can be Low priority but still Important.

### 16.3 Priority Levels
- **None / Low / Medium / High / Critical** — shown as a color-coded left border on the task card.
- Sort any list by priority (Critical → None).
- Overdue high-priority tasks shown with a pulsing red left border.

> **FEEL UI:** Priority is communicated through the left border color only — not a separate badge, label, or icon. Visual weight is added only for the highest-priority tasks (Critical), keeping the list calm for everything else.

---

## 17. Theming — Dual Theme & Background Change

### 17.1 Dual Theme
- **Light Mode** — Clean, minimal, white/grey palette.
- **Dark Mode** — Deep dark (not just dark grey — true #0d0d0d option).
- **Auto Mode** — Follows OS system preference, changes at sunset/sunrise.
- Manual toggle: sun/moon icon in sidebar, or `Ctrl+Shift+L`.

### 17.2 Accent Colors
- Choose an accent color applied to buttons, active states, checkmarks, tags.
- Presets: Blue (default), Purple, Green, Red, Orange, Pink, Teal.
- Custom hex/RGB input.

### 17.3 Background Change
- Replace the default background with:
  - **Solid colors** — color picker.
  - **Gradients** — choose two or three colors; direction control.
  - **Built-in wallpapers** — curated set of landscapes, abstract art, minimal textures.
  - **Custom image** — upload any photo (JPEG/PNG/WebP).
  - **Unsplash integration** — search and set Unsplash photos directly.
  - **Animated backgrounds** — subtle CSS animations (particles, aurora, gradient shifts). Toggleable for performance.
  - **Daily auto-change** — a new background every day from a chosen category.
- Background blur control (0–20px) so content remains readable over busy images.
- Background applies per-list or globally (user's choice).

### 17.4 Typography
- Font size: Small / Medium / Large / XL.
- Font family: System default, Inter, JetBrains Mono (for code-heavy users), and any installed system font.
- Line density: Comfortable / Compact / Cozy.

### 17.5 Layout Options
- Sidebar: Left (default) / Right / Hidden (full-width task panel).
- Task card style: **Default** (text + minimal metadata) / **Rich** (show subtask count, tags, attachments) / **Minimal** (title only).

> **FEEL UI:** The "Minimal" card style is the FEEL UI ideal — just the title and the checkbox. Users who want more data can switch to Rich. The UI never forces density on anyone.

---

## 18. Android Companion App *(Phase 2)*

> The companion app ships in Phase 2. The desktop app's sync architecture is designed for it from day one — no desktop refactor required when Phase 2 begins. Sync runs over local network with no cloud intermediary.

### 18.1 Core Features
- Full parity for task creation, editing, completing, and organizing.
- **Offline-first** — works without internet, queues changes locally, and syncs automatically when the desktop is reachable on the same network.
- Widget: Home screen widget showing Today's tasks, Quick Add button.
- Lock screen notifications and Quick Settings tile.

### 18.2 Mobile-Specific Features — Convenience First
- **Voice input** — speak a task and it gets transcribed + parsed with the same NLP grammar as desktop.
- **Location-based reminders** — "Remind me when I arrive at Office."
- Share sheet integration — share any content from another app as a task (e.g., share a webpage → becomes a task with the URL attached).
- Barcode/QR scanner — attach product info or URLs to tasks.
- Camera shortcut — quickly attach a photo to any task.
- **Morning brief notification** — a single, consolidated daily notification summarizing the day's tasks.
- **Swipe actions** — swipe left on a task to complete, swipe right to move/star.

> **Extreme Convenience:** Swipe-to-complete is the mobile-native equivalent of desktop drag-and-drop — the primary interaction that requires the least effort for the most common action.

### 18.3 Sync
- **Discovery:** The companion finds the desktop automatically via mDNS (`os11-sync._tcp.local`) — no manual IP entry.
- **Pairing:** First-time pairing done by scanning a QR code in OS11 Settings → Companion. Subsequent connections are automatic.
- **Transport:** WebSocket over local network. Changes queue in `sync_queue` when offline and flush when reconnected.
- **Sync status indicator:** Last synced X seconds ago.
- **Conflict resolution:** Last-write-wins with conflict history accessible in the task detail panel.

### 18.4 Companion-Specific Settings
- Notification preferences (separate from desktop — e.g., mobile-only for reminders, desktop-only for collaboration alerts).
- Battery saver mode — reduces sync polling frequency.
- Biometric lock (fingerprint / face unlock) for the app.

---

## 19. Modular Settings (Feature Toggle)

A dedicated **Settings → Modules** page where users enable/disable entire feature sets.

> **The most direct expression of the FEEL UI principle and the Modular north star:** Disabled modules are completely absent from the UI. They do not appear as greyed-out items. They do not leave empty sidebar slots. They simply do not exist in the interface until enabled.

### 19.1 Toggleable Modules
| Module | Default | Notes |
|---|---|---|
| My Day | ✅ On | |
| Project Management (Board, Timeline, Table views) | ✅ On | |
| Pomodoro Timer | ✅ On | |
| Agenda & Time Blocking | ✅ On | |
| Goals & Habits | ✅ On | |
| Dashboard & Statistics | ✅ On | |
| File Attachments | ✅ On | |
| Natural Language Parsing | ✅ On | |
| Calendar Integration | ⬜ Off | Requires calendar account setup |
| Animated Backgrounds | ⬜ Off | |
| Habit Tracker | ⬜ Off | |
| Vim Keybindings | ⬜ Off | |
| Collaboration | ⬜ Off | Phase 2 — requires companion/peer setup |
| Companion Sync | ⬜ Off | Phase 2 — requires pairing |

### 19.2 Profile Presets
- **Minimalist** — Only Tasks + My Day + Notifications. Everything else off.
- **GTD Mode** — Tasks + Projects + Agenda + Goals. No social features.
- **Team Mode** — Full collaboration, projects, all on. *(Phase 2 features activate here)*
- **Focus Mode** — Tasks + Pomodoro + Agenda. Minimal.
- **Custom** — User-defined combination.

> **Extreme Convenience:** Preset profiles are shown on first launch so the user arrives at the right configuration on day one, without manually toggling 14 switches.

---

## 20. Inspired by Microsoft To Do

Features ported and improved from Microsoft To Do:

- **My Day** view with daily reset and task suggestions.
- **Starred / Important** smart list.
- **Planned** smart list showing all dated tasks.
- **Lists** with custom icons and colors.
- **List groups** — group related lists into folders.
- **Subtasks** (called "Steps" in To Do — we support deeper nesting and drag-to-subtask creation).
- **Notes on tasks** (rich text, not plain text like To Do).
- **Repeat tasks** with full recurrence rule support.
- **Due date + Reminder** as distinct fields.
- **Print list** — export a list as a printer-friendly page.
- **Emoji in task titles and list names.**
- **Completed tasks** section (collapsible, at the bottom of each list).
- **Sort by** multiple criteria (To Do only supports one at a time; we support multi-key sort).
- **Assigned to Me** smart list.
- **Hashtag-style list assignment** in quick add.
- **Background themes per list** (To Do's colored themes → we extend with photos and gradients).

---

## 21. Inspired by Apple Reminders

Features ported and improved from Apple Reminders, with special attention to its **convenience-first** interaction model:

- **Smart Lists** equivalent (Today, Scheduled, All, Flagged, Completed).
- **Location-based reminders** (via mobile companion — Phase 2).
- **Subtask nesting** (Reminders supports one level; we support unlimited, plus drag-to-subtask).
- **Sections within a list** — group tasks under named headers; drag tasks between sections.
- **Tags** (introduced in Reminders iOS 15; we extend with colors and nesting).
- **Flagged tasks** (equivalent to our Important/Star feature).
- **Templates** — save a list as a reusable template (groceries, packing list, etc.).
- **Send reminders to others** — assign a task to a contact via collaboration (Phase 2).
- **Natural language date parsing** ("every weekday at 9am").
- **Early reminder** — get notified before the due time.
- **Image attachment** inline in task notes.
- **Grocery mode** — smart list that auto-categorizes grocery items (optional module).
- **iCloud-style simplicity** option in Minimalist profile preset.
- **Drag-to-subtask** — the killer convenience feature from Reminders iOS 16+; fully implemented here.
- **Drag-to-list from main window** — drag any task from the main list directly to a list in the sidebar.
- **Column view** (Reminders macOS Monterey+) → our Board/Table views cover this.

---

## 22. Additional Recommended Features

### 22.1 Command Palette
- `Ctrl+K` — opens a Spotlight-style command palette.
- Search tasks, lists, actions, settings all in one place.
- Recent actions shown at top.
- Plugin commands accessible here.

> **Extreme Convenience + FEEL UI:** The command palette is the ultimate abstraction — it gives power users access to everything without cluttering the main UI with buttons for every action.

### 22.2 Focus Mode (Full Screen)
- Hides all UI except the current task and a minimal toolbar.
- Dims the screen edges.
- Optional ambient sound player (lo-fi beats, rain, white noise — built in).
- Available from the task detail panel or via shortcut `Ctrl+Shift+F`.

> **FEEL UI at its extreme:** Focus Mode is what the app would look like if it only had one task. One task. Nothing else.

### 22.3 Recurring Review System
- **Weekly Review** — Prompted every Friday (or custom day): review completed tasks, clear stale tasks, set next week's priorities.
- **Monthly Review** — Prompted first of month: review goals, archive completed projects, celebrate streaks.

### 22.4 Integrations & Automation
- **Zapier / Make (Integromat) webhook** support.
- **CLI tool** (`os11 add "Buy milk" --due tomorrow --list groceries`).
- **REST API** (local HTTP server, optional) for scripting and third-party tools.
- **Browser Extension** (Chrome/Firefox) — capture URLs as tasks, clip articles.
- **Slack / Discord bot** — `/task add` command creates tasks in the app.
- **GitHub Issues sync** — link a task to a GitHub issue; status syncs.

### 22.5 Templates
- **Task Templates** — reusable task structures (e.g., "New Client Onboarding Checklist").
- **Project Templates** — full project structure with sections and placeholder tasks.
- **Community Template Library** — browse and import templates shared by other users.

### 22.6 Backup & Data Portability
- **Auto-backup** — daily backup to a local folder (user-defined path).
- **Export** — full data export as JSON, CSV, or Markdown.
- **Import** — from Todoist, Notion, Microsoft To Do, Apple Reminders, TickTick (via their export formats).
- **Version history** — roll back any task to a previous state (last 30 days).

### 22.7 Accessibility
- Full keyboard navigation (no mouse required for any action).
- Screen reader support (ARIA labels on all elements).
- High contrast mode (beyond light/dark — WCAG AAA compliant).
- Font scaling (respects OS accessibility font size setting).
- Reduced motion mode — disables all Framer Motion animations; UI responds instantly.
- Color-blind friendly tag palette (shapes + colors, not color alone).

### 22.8 Privacy & Security
- **Local-only by design** — all data lives on device. Nothing leaves the machine unless the user explicitly enables Companion Sync or Collaboration (Phase 2).
- **App lock** — PIN stored in the OS keychain (Windows Credential Store / macOS Keychain / libsecret), or biometric (Windows Hello / macOS Touch ID) via Electron APIs.
- **Stealth mode** — omit task titles from notifications (shows "1 task due" instead).
- **Data deletion** — permanently delete all local app data from Settings → Privacy.
- **No telemetry** — OS11 collects no usage data, no crash reports to a cloud endpoint, no analytics.

### 22.9 Onboarding & Help
- Interactive onboarding tour on first launch (skippable at any point — FEEL UI applies even here).
- Profile preset selection on first launch (see §19.2) — user arrives at the right configuration immediately.
- **Tooltip hotkey hints** — hover any button to see its keyboard shortcut.
- Contextual in-app tips (dismissible, never repeat after dismissed).
- **Help Center** (offline-accessible docs bundled with the app).
- Changelog shown on update (highlights only — not a wall of text).

---

## 23. Tech Stack Summary

| Layer | Technology |
|---|---|
| **Desktop Framework** | Electron (latest stable) |
| **Bundler** | Vite |
| **Frontend** | React 18 |
| **Animation** | Framer Motion (4 use-sites only; see ARCHITECTURE.md) |
| **Styling** | CSS Modules + CSS Variables (zero runtime CSS-in-JS) |
| **Headless UI Primitives** | Radix UI (via shadcn/ui scaffold) — Dropdown, Popover, Dialog, Collapsible, ScrollArea, Tooltip |
| **Local Database** | SQLite via `better-sqlite3` |
| **Sync — Phase 2** | WebSocket (`ws`) + mDNS (`bonjour-service`) — local network, no cloud |
| **State Management** | Zustand |
| **Natural Language Parsing** | `chrono-node` (dates) + custom regex grammar |
| **Recurrence** | `rrule` (RFC 5545) |
| **Drag-and-Drop** | `@dnd-kit/core` + `@dnd-kit/sortable` |
| **Virtual Scrolling** | `@tanstack/react-virtual` |
| **Rich Text (Notes)** | Tiptap + ProseMirror |
| **Identity** | Local device UUID — no cloud auth, no email, no password |
| **App Lock / Secrets** | `keytar` (OS keychain) |
| **Companion Pairing** | QR code (`qrcode` package) + mDNS discovery |
| **Notifications** | Electron `Notification` API |
| **Global Shortcuts** | Electron `globalShortcut` module |
| **Tray** | Electron `Tray` module |
| **File Storage** | Local disk — `app.getPath('userData')/attachments/` |
| **Android App** | React Native *(Phase 2)* |
| **Charts** | Recharts |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **Auto-Updater** | `electron-updater` (delta updates) |
| **Packaging** | `electron-builder` (`.exe`, `.dmg`, `.AppImage`) |

---

*Document version 3.0 — OS11 Feature Specification*
*North Stars: Insane Speed · Keyboard Native · Modular · Extreme Convenience · FEEL UI*
*Built with inspiration from Microsoft To Do, Apple Reminders, Todoist, TickTick, Things 3, and Linear.*
*Phase 1: Desktop only. Phase 2: Android companion + Collaboration — local network sync, no cloud required at any phase.*
