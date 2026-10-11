# Task Card Reciprocal Cross-View Badges Feature - Context & Implementation Summary

## 1. Project Background
- **Project**: OS11 (Desktop productivity app built with React, TypeScript, Vite, Electron, Zustand, and SQLite).
- **Core Component**: `TaskCard` (`src/renderer/features/tasks/TaskCard.tsx`).
- **Related Stores**: `useAppStore`, `useProjectStore`, `useAreaStore`, `useListStore`, `useTaskStore`.

---

## 2. Feature Goal & Requirements
When a user moves or drag-and-drops a task between containers (Projects, Areas, Custom Lists) and smart list views (such as "My Day", "Planned", "Anytime", "Someday", "Waiting For"), there was previously no visual feedback on the task card to confirm the membership change.

The goal was to implement **reciprocal location and membership badges** inspired by Microsoft To Do:
1. **Container-to-Smart View (Viewing in smart lists like My Day, Planned, Anytime)**:
   - If a task belongs to a project, display a subtle text-with-icon badge: `<project_icon> <project_name>` (e.g. `📁 WorkOS` or `✅ OS11`).
   - If a task belongs to an area, display: `🏢 <area_name>`.
   - If a task belongs to a custom list, display: `📋 <list_name>`.
   - Clicking this badge navigates directly to that project/area/list via `setActiveListId`.
2. **Smart-to-Container View (Viewing inside a container like a Project, Area, or Custom List)**:
   - When a task in that container also belongs to a smart list or scheduling state, display a badge reflecting that status:
     - `☀️ My Day` (when `task.my_day_date === today`)
     - `⚡ Anytime` (when `task.bucket === 'anytime'`)
     - `💡 Someday` (when `task.bucket === 'someday'`)
     - `⏳ Waiting: <name>` (when `task.waiting_on` is present)
   - Clicking the badge navigates to that smart list (`smart_my_day`, `smart_anytime`, etc.).
3. **Precedence Rule**:
   - `My Day` takes precedence over bucket statuses (`Anytime` / `Someday`). A task cannot show conflicting smart statuses simultaneously.
4. **Immediate Drag & Drop Feedback**:
   - Dragging a task into "My Day" from a project view immediately updates `my_day_date` in the store and reveals the `☀️ My Day` badge on the card inside the project view without navigation.
5. **No Redundant Badges**:
   - If a task is in a Project view, do not display the Project name badge.
   - If a task is in the Anytime view, do not display the Anytime badge (only show the parent Project/Area container badge).
   - If a task is in the Someday view, do not display the Someday badge.
6. **Badge Placement & Styling**:
   - Subtle text-with-icon style (not bulky pills/chips).
   - Placed below the notes line in Row 3 (`metadataRow`), left-aligned, followed by time chips and metadata dots.

---

## 3. Initial Implementation & Issues Identified
After the first round of implementation, 3 issues occurred and were reported:
1. **Duplicate Badges on the Card**:
   - Badges appeared twice: once under the notes line (left-aligned) and once on the far right edge inside `metadataWrap`.
   - *Cause*: Badges were rendered both in the metadata row (`hasMetadataRow`) and redundantly in `<div className={styles.metadataWrap}>`.
2. **Missing Project Name and Icon in Smart Lists**:
   - Task cards in smart lists showed an empty folder icon `📁` with blank text instead of the project name and its custom icon.
   - *Cause*: 
     - The Project data model uses `name` (`proj.name`), not `title` (`proj.title` was `undefined`).
     - Hardcoded `📁` instead of `proj.icon || '📁'`.
     - Incomplete reactivity in store subscriptions.
3. **Redundant Badges in Anytime and Someday Views**:
   - Tasks inside the Anytime or Someday views still rendered `⚡ Anytime` or `💡 Someday` badges.
   - *Cause*: The view ID check in `smartStatusBadge` and legacy fallback chips in `TaskCard.tsx` were still rendering the bucket chips unconditionally.

---

## 4. Root Causes & Fixes Applied

### A. Badge Deduplication & Placement
- Removed the duplicate badge JSX from `<div className={styles.metadataWrap}>`.
- Removed legacy fallback chips (`metaAnytimeChip`, `metaSomedayChip`, etc.) that were duplicating the status.
- Kept a single source of truth rendered in **Row 3 (`metadataRow`)** directly below the title and notes.

### B. Project Name and Icon Resolution
In `TaskCard.tsx`, updated `containerBadge` resolution:
- Reads `const projName = proj.name ?? proj.title ?? '';`
- Reads `const projIcon = proj.icon || '📁';`
- Established reactive subscriptions via Zustand hooks (`useProjectStore(state => state.projectsById)`, `useAreaStore`, `useListStore`) with fallback to `.getState()`.

### C. Context-Aware Suppression
- In `smartStatusBadge`, explicitly suppressed view badges matching the active view:
  - If `activeListId === 'smart_my_day'`, suppress `My Day`.
  - If `activeListId === 'smart_anytime'`, suppress `Anytime`.
  - If `activeListId === 'smart_someday'`, suppress `Someday`.
  - If `activeListId === 'smart_waiting'`, suppress `Waiting on`.
- In `containerBadge`, suppressed container badges when viewing inside that container (`activeListId === project:<id>`, `area:<id>`, or list ID).

---

## 5. Files Touched

1. **`src/renderer/features/tasks/TaskCard.tsx`**:
   - Store hooks and reactive fallback setup.
   - `containerBadge` derivation (`icon`, `label`, `targetListId`, `title`).
   - `smartStatusBadge` derivation with precedence (`My Day` > `Anytime` > `Someday` > `Waiting on`) and view suppression.
   - Click navigation handlers (`useAppStore.getState().setActiveListId(...)`).
   - Cleaned up duplicate JSX in `metadataWrap` and legacy chips in `metadataRow`.
2. **`src/renderer/features/tasks/TaskCard.module.css`**:
   - Added `.inlineContainerBadge` and `.inlineSmartBadge` styles (subtle text-with-icon, hover underline, pointer cursor).
3. **`tests/unit/task-card-cross-view-badges.test.tsx`**:
   - Unit and regression test suite covering:
     - Exactly one instance rendered per card (under notes, none on far right).
     - Proper rendering of `proj.name` and `proj.icon` (no blank text).
     - Suppression of Anytime badge in Anytime view (`smart_anytime`) while keeping container badge.
     - Suppression of Someday badge in Someday view (`smart_someday`) while keeping container badge.

---

## 6. Architecture & Data Integrity Verification
- **Architectural impact**: Pure implementation change (no SQLite schema changes, no IPC changes, no new dependencies, no changes to `ARCHITECTURE.md`).
- **Tests passing**:
  - `tests/unit/task-card-cross-view-badges.test.tsx` (4 regression tests passing).
  - `tests/unit/task-card-layout.test.ts` (8 layout tests passing).
