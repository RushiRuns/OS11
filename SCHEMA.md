# OS11 — Data Schema

> The data model is treated as sacred.
> No AI tool modifies schema files without a human reviewing the migration path.
> Every change here gets a corresponding file in `src/main/migrations/`.
> All dates are ISO 8601 strings. All IDs are UUIDs (v4). All booleans are INTEGER (0/1) in SQLite.
>
> Phase 1 (desktop only): Tables marked [Phase 2] are created in the schema from day one but remain unpopulated.
> This avoids a migration cascade when Phase 2 ships.

---

## Schema Version

Current version: `0001`
Migration files: `src/main/migrations/`
Version tracked in: `PRAGMA user_version`

---

## Table Index

| Table | Purpose | Phase |
|---|---|---|
| `tasks` | Core task records | 1 |
| `lists` | User-created lists and built-in smart lists | 1 |
| `list_groups` | Folder groupings for lists in the sidebar | 1 |
| `projects` | Multi-section task containers | 1 |
| `sections` | Named groups within a project | 1 |
| `task_dependencies` | Dependency links between tasks | 1 |
| `milestones` | Key dates on project timelines | 1 |
| `tags` | Named, colored labels (supports nesting) | 1 |
| `task_tags` | Many-to-many join: task ↔ tag | 1 |
| `reminders` | Timed alerts per task | 1 |
| `attachments` | Local files attached to tasks | 1 |
| `comments` | Comment threads on tasks | 1 |
| `comment_reactions` | Emoji reactions on comments | 1 |
| `pomodoro_sessions` | Completed and in-progress focus sessions | 1 |
| `goals` | High-level objectives linked to tasks/projects | 1 |
| `goal_links` | Many-to-many join: goal ↔ task or project | 1 |
| `notification_history` | In-app notification center log | 1 |
| `settings` | Key-value store for all app preferences | 1 |
| `modules` | Feature toggle state per module | 1 |
| `local_identity` | This device's identity (UUID + display name) | 1 |
| `users` | Known collaborators (peers, not cloud auth) | 2 |
| `collaboration_members` | Permission grants on shared lists and projects | 2 |
| `devices` | Trusted companion/peer devices (paired via QR) | 2 |
| `sync_queue` | Changes queued for companion/peer sync | 2 |

---

## Tables

### `local_identity`

Created on first launch. Exactly one row. Identifies this device to companion apps and collaborators.

```sql
CREATE TABLE local_identity (
  id           TEXT PRIMARY KEY,   -- UUID v4, generated once on first launch
  display_name TEXT NOT NULL,      -- Set by user in Settings → Profile
  avatar_emoji TEXT,               -- Optional emoji avatar (no image upload)
  created_at   TEXT NOT NULL
);
```

**Note:** No email. No password. No external auth. This is the only identity record this device needs.

---

### `tasks`

```sql
CREATE TABLE tasks (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  notes               TEXT,                       -- Rich text stored as HTML; sanitized at service layer
  list_id             TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  project_id          TEXT REFERENCES projects(id) ON DELETE SET NULL,
  section_id          TEXT REFERENCES sections(id) ON DELETE SET NULL,
  parent_task_id      TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  due_date            TEXT,                       -- ISO 8601 date (YYYY-MM-DD)
  due_time            TEXT,                       -- ISO 8601 time (HH:mm:ss), null = all-day
  all_day             INTEGER NOT NULL DEFAULT 1,
  recurrence_rule     TEXT,                       -- RRULE string (RFC 5545)
  recurrence_basis    TEXT,                       -- 'fixed' | 'after_completion'
  priority            INTEGER NOT NULL DEFAULT 0, -- 0=None 1=Low 2=Medium 3=High 4=Critical
  is_starred          INTEGER NOT NULL DEFAULT 0,
  is_completed        INTEGER NOT NULL DEFAULT 0,
  completed_at        TEXT,
  estimated_minutes   INTEGER,
  assignee_device_id  TEXT,                       -- Phase 2: references devices(id)
  created_by_device   TEXT NOT NULL DEFAULT 'local',
  sort_order          REAL NOT NULL DEFAULT 0,    -- fractional indexing for manual sort
  my_day_date         TEXT,                       -- date added to My Day (YYYY-MM-DD)
  pomodoro_count      INTEGER NOT NULL DEFAULT 0,
  is_trashed          INTEGER NOT NULL DEFAULT 0,
  trashed_at          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX idx_tasks_list_id       ON tasks(list_id);
CREATE INDEX idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id     ON tasks(parent_task_id);
CREATE INDEX idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX idx_tasks_is_starred    ON tasks(is_starred);
CREATE INDEX idx_tasks_is_completed  ON tasks(is_completed);
CREATE INDEX idx_tasks_my_day_date   ON tasks(my_day_date);
CREATE INDEX idx_tasks_is_trashed    ON tasks(is_trashed);
```

**Notes:**
- `parent_task_id` supports unlimited subtask nesting. Depth enforced in domain logic.
- `sort_order` uses fractional indexing — reordering one task never rewrites all others.
- `my_day_date` stores which day a task was added to My Day. Tasks where `my_day_date < today` surface in the midnight rollover prompt.
- `assignee_device_id` is a placeholder column. It is created now but remains null in Phase 1.

---

### `lists`

```sql
CREATE TABLE lists (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  icon                 TEXT,                      -- emoji or icon identifier
  color                TEXT,                      -- hex color string
  background_type      TEXT DEFAULT 'none',       -- 'none' | 'solid' | 'gradient' | 'image' | 'animated'
  background_value     TEXT,                      -- JSON: color hex, image path, gradient stops
  sort_order           REAL NOT NULL DEFAULT 0,
  is_smart             INTEGER NOT NULL DEFAULT 0,
  smart_type           TEXT,                      -- 'my_day' | 'important' | 'planned' | 'assigned' | 'all' | 'completed'
  group_id             TEXT REFERENCES list_groups(id) ON DELETE SET NULL,
  notification_enabled INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX idx_lists_group_id   ON lists(group_id);
CREATE INDEX idx_lists_smart_type ON lists(smart_type) WHERE is_smart = 1;
```

**Notes:**
- No `owner_id` in Phase 1 — all lists are local to this device.
- Smart lists (`is_smart = 1`) are seeded at first launch. Their records are never deleted.
- `smart_type` determines the query used. Smart lists hold no task rows — they are computed views.

---

### `list_groups`

```sql
CREATE TABLE list_groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
```

---

### `projects`

```sql
CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT,
  icon         TEXT,
  status       TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'archived' | 'completed'
  due_date     TEXT,
  default_view TEXT NOT NULL DEFAULT 'list',      -- 'list' | 'board' | 'timeline' | 'calendar' | 'table'
  sort_order   REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_projects_status ON projects(status);
```

---

### `sections`

```sql
CREATE TABLE sections (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_sections_project_id ON sections(project_id);
```

---

### `task_dependencies`

```sql
CREATE TABLE task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);
```

**Note:** Circular dependency detection enforced in domain logic before any insert.

---

### `milestones`

```sql
CREATE TABLE milestones (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  due_date     TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order   REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_milestones_project_id ON milestones(project_id);
```

---

### `tags`

```sql
CREATE TABLE tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,            -- full path for nested: 'work/client/Acme'
  color         TEXT,
  parent_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
  sort_order    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
```

---

### `task_tags`

```sql
CREATE TABLE task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tags_tag_id ON task_tags(tag_id);
```

---

### `reminders`

```sql
CREATE TABLE reminders (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at    TEXT NOT NULL,                    -- ISO 8601 datetime
  is_triggered INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,                            -- ISO 8601, null if not snoozed
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_reminders_task_id   ON reminders(task_id);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at) WHERE is_triggered = 0;
```

**Note:** Location-based reminders are a companion-app feature (Phase 2). This table handles desktop time-based reminders only.

---

### `attachments`

```sql
CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,                   -- sanitized filename stored on disk
  original_name TEXT NOT NULL,                   -- as uploaded by user
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  local_path    TEXT NOT NULL,                   -- absolute path within app.getPath('userData')/attachments/
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_attachments_task_id ON attachments(task_id);
```

**Note:** All attachments are local in Phase 1. The path is always within `app.getPath('userData')/attachments/`. Cloud upload is not planned.

---

### `comments`

```sql
CREATE TABLE comments (
  id                TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_device_id  TEXT NOT NULL DEFAULT 'local',
  author_name       TEXT NOT NULL,               -- denormalized display name at time of writing
  body              TEXT NOT NULL,
  parent_comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  is_resolved       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX idx_comments_task_id ON comments(task_id);
```

---

### `comment_reactions`

```sql
CREATE TABLE comment_reactions (
  comment_id       TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reactor_device_id TEXT NOT NULL DEFAULT 'local',
  emoji            TEXT NOT NULL,
  PRIMARY KEY (comment_id, reactor_device_id, emoji)
);
```

---

### `pomodoro_sessions`

```sql
CREATE TABLE pomodoro_sessions (
  id               TEXT PRIMARY KEY,
  task_id          TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,                -- 'work' | 'short_break' | 'long_break'
  duration_seconds INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  was_completed    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_pomodoro_task_id    ON pomodoro_sessions(task_id);
CREATE INDEX idx_pomodoro_started_at ON pomodoro_sessions(started_at);
```

---

### `goals`

```sql
CREATE TABLE goals (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  goal_type        TEXT NOT NULL,                -- 'habit' | 'milestone' | 'outcome'
  target_date      TEXT,
  target_value     REAL DEFAULT 100,
  current_value    REAL NOT NULL DEFAULT 0,
  streak_count     INTEGER NOT NULL DEFAULT 0,
  last_progress_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
```

---

### `goal_links`

```sql
CREATE TABLE goal_links (
  goal_id       TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,                   -- 'task' | 'project'
  resource_id   TEXT NOT NULL,
  PRIMARY KEY (goal_id, resource_type, resource_id)
);
```

---

### `notification_history`

```sql
CREATE TABLE notification_history (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,                      -- 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak'
  task_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT                                -- null = unread
);

CREATE INDEX idx_notif_created_at ON notification_history(created_at);
```

---

### `settings`

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                            -- JSON-encoded value
);
```

**Seed values:**

| Key | Value shape | Default |
|---|---|---|
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` |
| `accent_color` | `"#hex"` | `"#0078d4"` |
| `font_size` | `"sm" \| "md" \| "lg" \| "xl"` | `"md"` |
| `font_family` | `string` | `"system"` |
| `density` | `"comfortable" \| "compact" \| "cozy"` | `"comfortable"` |
| `sidebar_position` | `"left" \| "right" \| "hidden"` | `"left"` |
| `launch_at_login` | `boolean` | `true` |
| `day_starts_at` | `"HH:mm"` | `"00:00"` |
| `pomodoro_work_minutes` | `number` | `25` |
| `pomodoro_break_minutes` | `number` | `5` |
| `pomodoro_long_break_minutes` | `number` | `15` |
| `pomodoro_sessions_before_long_break` | `number` | `4` |
| `vim_keybindings` | `boolean` | `false` |
| `active_profile_preset` | `"minimalist" \| "gtd" \| "team" \| "focus" \| "custom"` | `"custom"` |
| `app_lock_enabled` | `boolean` | `false` |
| `reduce_motion` | `boolean` | `false` |
| `task_card_style` | `"default" \| "rich" \| "minimal"` | `"default"` |

---

### `modules`

```sql
CREATE TABLE modules (
  module_name TEXT PRIMARY KEY,
  is_enabled  INTEGER NOT NULL DEFAULT 1
);
```

**Seed values (Phase 1 modules only):**

| module_name | Default |
|---|---|
| `my_day` | 1 |
| `project_management` | 1 |
| `pomodoro` | 1 |
| `agenda` | 1 |
| `goals_habits` | 1 |
| `dashboard` | 1 |
| `file_attachments` | 1 |
| `nlp_parsing` | 1 |
| `vim_keybindings` | 0 |
| `animated_backgrounds` | 0 |
| `habit_tracker` | 0 |
| `collaboration` | 0 — Phase 2, default off until companion ships |
| `companion_sync` | 0 — Phase 2 |

**Not included:** `calendar_integration`, `smart_reminders` (AI), `weekly_digest_email` — these require cloud or AI services and are not part of OS11's scope.

---

## Phase 2 Tables (created in schema now, populated later)

### `users`

Collaborators known to this device. Populated when a peer connects (Phase 2). No cloud auth — identity comes from the peer device's `local_identity` record.

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,                 -- device UUID from the peer's local_identity
  display_name TEXT NOT NULL,
  avatar_emoji TEXT,
  last_seen_at TEXT,
  created_at   TEXT NOT NULL
);
```

---

### `devices`

Trusted companion and peer devices, established via QR pairing.

```sql
CREATE TABLE devices (
  id              TEXT PRIMARY KEY,              -- UUID from the remote device's local_identity
  device_name     TEXT NOT NULL,                 -- e.g. "Krishna's Pixel 8"
  device_type     TEXT NOT NULL,                 -- 'android' | 'desktop'
  pairing_token   TEXT NOT NULL,                 -- stored securely in OS keychain via keytar
  last_connected  TEXT,
  is_trusted      INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL
);
```

---

### `collaboration_members`

Permission grants on shared lists and projects (Phase 2).

```sql
CREATE TABLE collaboration_members (
  id            TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,                   -- 'list' | 'project'
  resource_id   TEXT NOT NULL,
  device_id     TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  permission    TEXT NOT NULL DEFAULT 'editor',  -- 'viewer' | 'editor' | 'admin'
  invited_at    TEXT NOT NULL,
  accepted_at   TEXT
);

CREATE UNIQUE INDEX idx_collab_device_resource ON collaboration_members(resource_id, device_id);
```

---

### `sync_queue`

Changes queued for sync to connected companion or peer devices (Phase 2). The sync worker drains this table — it does not query live tables directly.

```sql
CREATE TABLE sync_queue (
  id          TEXT PRIMARY KEY,
  operation   TEXT NOT NULL,                     -- 'insert' | 'update' | 'delete'
  table_name  TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  payload     TEXT NOT NULL,                     -- JSON snapshot of changed fields
  target_device_id TEXT,                         -- null = broadcast to all trusted devices
  created_at  TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at);
```

---

## Full-Text Search

FTS5 virtual table for fast task search. Kept in sync by triggers on `tasks` INSERT, UPDATE, DELETE. Search queries run in the worker thread.

```sql
CREATE VIRTUAL TABLE tasks_fts USING fts5(
  id UNINDEXED,
  title,
  notes,
  content=tasks,
  content_rowid=rowid
);
```

---

## Relationships — At a Glance

```
local_identity (1 row — this device)
  └── created_by_device → tasks

lists
  ├── belongs to → list_groups (optional)
  └── has many → tasks

projects
  ├── has many → sections
  ├── has many → milestones
  └── has many → tasks (via project_id)

tasks
  ├── has many → tasks (subtasks, via parent_task_id)
  ├── has many → reminders
  ├── has many → attachments
  ├── has many → comments
  ├── has many → pomodoro_sessions
  ├── belongs to → many tags (via task_tags)
  └── depends on → many tasks (via task_dependencies)

tags
  ├── parent → tag (nested tags)
  └── applied to → many tasks (via task_tags)

goals
  └── linked to → many tasks or projects (via goal_links)

-- Phase 2 --
devices ← paired via QR, token in OS keychain
  └── trusted for → sync_queue entries
```
