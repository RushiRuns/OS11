# OS11 — IPC Channel Catalog

> **Rule:** Every IPC channel in OS11 must be registered in this document and defined in `src/shared/ipc-channels.ts`.
> **Zero ad-hoc strings:** Handlers (`ipcMain.handle`) and callers (`ipcRenderer.invoke` via preload) must reference the constant keys.
> **Standard Response Envelope:** All IPC requests return `{ ok: true, data: T }` on success or `{ ok: false, error: string }` on failure.

---

## 1. Channel Groups

### APP
Window lifecycle, initial preloaded payload, system chrome controls, omnibar, and auto-updates.
- `app:get-startup-data` — Returns preloaded lists, initial 50 tasks, settings, identity for instant startup.
- `app:get-info` — Returns app version, OS platform, build metadata.
- `app:minimize` — Minimizes the active window.
- `app:maximize` — Toggles maximize / restore on the active window.
- `app:close` — Closes / hides the active window to tray.
- `app:quit` — Quits the entire application.
- `app:trim-memory` — Requests renderer to prune cache upon OS memory pressure.
- `app:set-always-on-top` — Sets always-on-top pin state and persists to settings.
- `app:get-always-on-top` — Retrieves current always-on-top state.
- `app:set-opacity` — Adjusts window opacity (50%–100%) and persists to settings.
- `app:show-omnibar` — Displays centered omnibar overlay window.
- `app:hide-omnibar` — Dismisses omnibar window.
- `app:focus-quick-add` — Focuses quick-add bar in main window.
- `app:check-for-updates` — Checks for application updates in background.
- `app:update-available` — Broadcasts when an update is available.
- `app:update-downloaded` — Broadcasts when an update has been downloaded and ready to install.

### TASKS
Task entity CRUD, completion toggling, filtering, and reordering.
- `tasks:get-all` — Fetch tasks with optional list/project/tag/due date filters.
- `tasks:get-by-id` — Fetch single task entity by UUID.
- `tasks:get-by-list` — Fetch tasks for a specific list ID.
- `tasks:create` — Create a new task entity.
- `tasks:update` — Update specified attributes of an existing task.
- `tasks:delete` — Move task to trash.
- `tasks:restore` — Restore task from trash.
- `tasks:toggle-complete` — Toggle task completion status and update timestamps.
- `tasks:complete` — Mark task complete with optional { skipRecurrence: boolean } and recurrence generation.
- `tasks:star` — Mark task as starred/important.
- `tasks:unstar` — Remove starred mark from task.
- `tasks:duplicate` — Duplicate task and append " (Copy)".
- `tasks:make-subtask` — Assign parent task ID with cycle detection.
- `tasks:promote-subtask` — Promote subtask to top-level task.
- `tasks:get-subtasks` — Fetch subtasks for a parent task.
- `tasks:get-my-day` — Fetch tasks assigned to My Day for specified or current date.
- `tasks:get-important` — Fetch starred/important active tasks.
- `tasks:get-planned` — Fetch active tasks with a due date ordered chronologically.
- `tasks:get-completed` — Fetch completed tasks.
- `tasks:add-to-my-day` — Add task to My Day for specified or current date.
- `tasks:remove-from-my-day` — Remove task from My Day.
- `tasks:reorder` — Update `sort_order` using fractional indexing.
- `tasks:batch-update` — Perform atomic update on multiple task IDs.
- `tasks:increment-pomodoro` — Increment the pomodoro count of a task upon completed focus interval.

### LISTS
Custom lists and smart list settings.
- `lists:get-all` — Retrieve all user-defined lists and smart list configurations.
- `lists:get-by-id` — Retrieve single list by UUID.
- `lists:create` — Create a new list.
- `lists:update` — Update list name, icon, color, or group.
- `lists:delete` — Delete list and handle cascading task reassignment.
- `lists:reorder` — Update list ordering in the sidebar.

### LIST_GROUPS
Sidebar groupings/folders for lists.
- `list-groups:get-all` — Retrieve all list groups.
- `list-groups:create` — Create a folder group for lists.
- `list-groups:update` — Rename or toggle group collapse state.
- `list-groups:delete` — Delete group without deleting contained lists.
- `list-groups:reorder` — Reorder list groups.

### PROJECTS
Structured projects containing sections, milestones, and tasks.
- `projects:get-all` — Retrieve all projects.
- `projects:get-by-id` — Retrieve detailed project model including sections and milestones.
- `projects:create` — Create new project.
- `projects:update` — Update project metadata, status, or date bounds.
- `projects:delete` — Delete project.
- `projects:reorder` — Reorder projects.
- `projects:archive` — Archive project status.
- `projects:get-activity` — Retrieve notification history audit events for project tasks.
- `projects:export-pdf` — Print project report to PDF via webContents.printToPDF.

### SECTIONS
Named sections within a project.
- `sections:get-all` — Retrieve sections for a given project ID.
- `sections:create` — Add section to project.
- `sections:update` — Rename or modify section.
- `sections:delete` — Delete section.
- `sections:reorder` — Update fractional sort order of section.

### MILESTONES
Key target dates on project timelines.
- `milestones:get-all` — Retrieve all milestones for a given project ID.
- `milestones:create` — Create a new milestone with target date.
- `milestones:update` — Update title, due date, or completion state of milestone.
- `milestones:delete` — Remove milestone.

### DEPENDENCIES
Task dependency relationships with cycle prevention.
- `dependencies:get-all` — Retrieve all dependencies or filter by project ID.
- `dependencies:get-for-task` — Retrieve prerequisite task IDs for a given task ID.
- `dependencies:add` — Add dependency link with circular dependency validation.
- `dependencies:remove` — Disassociate dependency link between two tasks.

### TAGS
System-wide hierarchical tags.
- `tags:get-all` — Retrieve all tags with parent relationships.
- `tags:create` — Create a new tag (name, color, parent_id).
- `tags:update` — Update tag name or color.
- `tags:delete` — Delete tag and detach from associated tasks.
- `tags:get-for-task` — Retrieve all tags associated with a specific task ID.
- `tags:add-to-task` — Associate a tag with a task.
- `tags:remove-from-task` — Disassociate a tag from a task.
- `tags:get-tasks-for-tag` — Retrieve all tasks labeled with a specific tag ID.
- `tags:merge` — Merge source tag into target tag and batch update associations.

### REMINDERS
Timed alerts and scheduled alarms.
- `reminders:get-all` — Fetch pending reminders.
- `reminders:get-by-task` — Fetch all scheduled reminders for a specific task.
- `reminders:set` — Schedule or update a reminder for a task.
- `reminders:dismiss` — Dismiss an active reminder alert.
- `reminders:snooze` — Postpone a reminder by a duration or preset.
- `reminders:delete` — Delete a scheduled reminder and clear active timer.

### CALENDAR
External calendar integration (Google, Apple, Outlook) with two-way sync.
- `calendar:get-status` — Retrieve module status, connected providers, and last sync timestamp.
- `calendar:get-events` — Query external calendar events within a date range.
- `calendar:connect` — Authenticate and connect provider via local loopback OAuth2 or CalDAV.
- `calendar:disconnect` — Disconnect provider and clear external event cache.
- `calendar:sync-task` — Sync scheduled task (`due_date`, `due_time`, `estimated_minutes`) to external calendar.

### ATTACHMENTS
Local task attachments stored in the app data directory.
- `attachments:get-all` — Get attachments for a specific task ID.
- `attachments:add` — Ingest a local file as an attachment.
- `attachments:delete` — Remove attachment record and delete backing file.
- `attachments:open` — Open attachment with native OS default application.

### POMODORO
Focus timer sessions and tracking.
- `pomodoro:start` — Begin focus session linked to a task.
- `pomodoro:pause` — Pause active session.
- `pomodoro:stop` — Complete or cancel session.
- `pomodoro:get-today-stats` — Get total completed focus intervals and duration today.
- `pomodoro:get-sessions` — Retrieve historical focus log.
- `pomodoro:sync-state` — Synchronize active session state and countdown with tray and mini window.
- `pomodoro:show-mini-window` — Display floating mini timer window.
- `pomodoro:hide-mini-window` — Hide floating mini timer window.
- `pomodoro:action` — Forward remote timer control actions (pause, resume, skip, reset) from mini window to renderer.

### GOALS
High-level objectives linked to projects and tasks.
- `goals:get-all` — Retrieve all active and achieved goals.
- `goals:get-by-id` — Retrieve single goal with progress calculation.
- `goals:create` — Create a goal with target date and metric.
- `goals:update` — Update goal progress or status.
- `goals:delete` — Delete a goal.
- `goals:link-task` — Associate or dissociate a task/project from a goal.
- `goals:get-all-links` — Retrieve all task and project links across all goals.

### SETTINGS
Key-value application preferences.
- `settings:get-all` — Retrieve dictionary of all configuration settings.
- `settings:get` — Retrieve single setting value by key.
- `settings:set` — Persist setting key-value pair.
- `settings:reset` — Reset settings to factory defaults.

### MODULES
Feature toggle engine for modular capability management.
- `modules:get-all` — Retrieve status (enabled/disabled) of all optional modules.
- `modules:set-active` — Enable or disable a feature module.

### SEARCH
FTS5 full-text search engine queries offloaded to worker thread.
- `search:query` — Perform FTS5 search across tasks, notes, comments, and attachments.
- `search:reindex` — Trigger full background re-indexing.

### NOTIFICATIONS
In-app notification center and native desktop alerts.
- `notifications:get-history` — Fetch historical notification log.
- `notifications:clear` — Clear notification log.
- `notifications:mark-read` — Mark a specific notification as read.
- `notifications:mark-all-read` — Mark all unread notifications as read.
- `notifications:send-native` — Trigger an OS native notification alert.

### IDENTITY
Local device cryptographic identity and display preferences.
- `identity:get` — Retrieve `local_identity` record (UUID, display name, avatar).
- `identity:update` — Update local display name or emoji avatar.

### SYNC (Phase 2 Placeholder)
Local network peer-to-peer and companion device synchronization.
- `sync:get-status` — Retrieve local WebSocket sync server and connection state.
- `sync:pair-device` — Generate/verify QR pairing token for companion device.
- `sync:queue-change` — Queue local mutation into `sync_queue`.

### NLP
Natural language quick-add processing using Chrono and regular expressions.
- `nlp:parse` — Parse unstructured task string into structured task properties (title, tags, list, priority, due date/time, recurrence, pomodoro).
