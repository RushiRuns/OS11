# OS11 — IPC Channel Catalog

> **Rule:** Every IPC channel in OS11 must be registered in this document and defined in `src/shared/ipc-channels.ts`.
> **Zero ad-hoc strings:** Handlers (`ipcMain.handle`) and callers (`ipcRenderer.invoke` via preload) must reference the constant keys.
> **Standard Response Envelope:** All IPC requests return `{ ok: true, data: T }` on success or `{ ok: false, error: string }` on failure.

---

## 1. Channel Groups

### APP
Window lifecycle, initial preloaded payload, and system chrome controls.
- `app:get-startup-data` — Returns preloaded lists, initial 50 tasks, settings, identity for instant startup.
- `app:get-info` — Returns app version, OS platform, build metadata.
- `app:minimize` — Minimizes the active window.
- `app:maximize` — Toggles maximize / restore on the active window.
- `app:close` — Closes / hides the active window to tray.
- `app:quit` — Quits the entire application.

### TASKS
Task entity CRUD, completion toggling, filtering, and reordering.
- `tasks:get-all` — Fetch tasks with optional list/project/tag/due date filters.
- `tasks:get-by-id` — Fetch single task entity by UUID.
- `tasks:create` — Create a new task entity.
- `tasks:update` — Update specified attributes of an existing task.
- `tasks:delete` — Delete or move task to trash.
- `tasks:toggle-complete` — Toggle task completion status and update timestamps.
- `tasks:reorder` — Update `sort_order` using fractional indexing.
- `tasks:batch-update` — Perform atomic update on multiple task IDs.

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

### SECTIONS
Named sections within a project.
- `sections:get-all` — Retrieve sections for a given project ID.
- `sections:create` — Add section to project.
- `sections:update` — Rename or modify section.
- `sections:delete` — Delete section.
- `sections:reorder` — Update fractional sort order of section.

### TAGS
System-wide hierarchical tags.
- `tags:get-all` — Retrieve all tags with parent relationships.
- `tags:create` — Create a new tag (name, color, parent_id).
- `tags:update` — Update tag name or color.
- `tags:delete` — Delete tag and detach from associated tasks.

### REMINDERS
Timed alerts and scheduled alarms.
- `reminders:get-all` — Fetch pending reminders.
- `reminders:set` — Schedule or update a reminder for a task.
- `reminders:dismiss` — Dismiss an active reminder alert.
- `reminders:snooze` — Postpone a reminder by a duration.

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

### GOALS
High-level objectives linked to projects and tasks.
- `goals:get-all` — Retrieve all active and achieved goals.
- `goals:get-by-id` — Retrieve single goal with progress calculation.
- `goals:create` — Create a goal with target date and metric.
- `goals:update` — Update goal progress or status.
- `goals:delete` — Delete a goal.
- `goals:link-task` — Associate or dissociate a task/project from a goal.

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
