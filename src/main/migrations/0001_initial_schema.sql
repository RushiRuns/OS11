-- ============================================================
-- OS11 Initial Schema (Migration 0001)
-- Core local SQLite schema per SCHEMA.md
-- ============================================================

-- 1. local_identity (Identifies this device)
CREATE TABLE IF NOT EXISTS local_identity (
  id           TEXT PRIMARY KEY,   -- UUID v4
  display_name TEXT NOT NULL,      -- Set by user in Settings
  avatar_emoji TEXT,               -- Optional emoji avatar
  created_at   TEXT NOT NULL
);

-- 2. list_groups (Folder groupings for lists in sidebar)
CREATE TABLE IF NOT EXISTS list_groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

-- 3. lists (User lists and built-in smart lists)
CREATE TABLE IF NOT EXISTS lists (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  icon                 TEXT,
  color                TEXT,
  background_type      TEXT DEFAULT 'none',
  background_value     TEXT,
  sort_order           REAL NOT NULL DEFAULT 0,
  is_smart             INTEGER NOT NULL DEFAULT 0,
  smart_type           TEXT,
  group_id             TEXT REFERENCES list_groups(id) ON DELETE SET NULL,
  notification_enabled INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_group_id   ON lists(group_id);
CREATE INDEX IF NOT EXISTS idx_lists_smart_type ON lists(smart_type) WHERE is_smart = 1;

-- 4. projects (Multi-section task containers)
CREATE TABLE IF NOT EXISTS projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 5. sections (Named groups within a project)
CREATE TABLE IF NOT EXISTS sections (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(project_id);

-- 6. tasks (Core task entities)
CREATE TABLE IF NOT EXISTS tasks (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  notes               TEXT,
  list_id             TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  project_id          TEXT REFERENCES projects(id) ON DELETE SET NULL,
  section_id          TEXT REFERENCES sections(id) ON DELETE SET NULL,
  parent_task_id      TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  due_date            TEXT,
  due_time            TEXT,
  all_day             INTEGER NOT NULL DEFAULT 1,
  recurrence_rule     TEXT,
  recurrence_basis    TEXT,
  priority            INTEGER NOT NULL DEFAULT 0, -- 0=None, 1=Low, 2=Medium, 3=High, 4=Critical
  is_starred          INTEGER NOT NULL DEFAULT 0,
  is_completed        INTEGER NOT NULL DEFAULT 0,
  completed_at        TEXT,
  estimated_minutes   INTEGER,
  assignee_device_id  TEXT,                       -- Phase 2 placeholder
  created_by_device   TEXT NOT NULL DEFAULT 'local',
  sort_order          REAL NOT NULL DEFAULT 0,    -- Fractional indexing
  my_day_date         TEXT,
  pomodoro_count      INTEGER NOT NULL DEFAULT 0,
  is_habit            INTEGER NOT NULL DEFAULT 0,
  is_trashed          INTEGER NOT NULL DEFAULT 0,
  trashed_at          TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_list_id       ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id     ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_starred    ON tasks(is_starred);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed  ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_my_day_date   ON tasks(my_day_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_trashed    ON tasks(is_trashed);

-- 7. task_dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

-- 8. milestones (Key dates on project timelines)
CREATE TABLE IF NOT EXISTS milestones (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  due_date     TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  sort_order   REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);

-- 9. tags (Named hierarchical colored labels)
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT,
  parent_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
  sort_order    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- 10. task_tags (Join: task <-> tag)
CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- 11. reminders (Timed task alerts)
CREATE TABLE IF NOT EXISTS reminders (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at    TEXT NOT NULL,
  is_triggered INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_task_id   ON reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE is_triggered = 0;

-- 12. attachments (Local files linked to tasks)
CREATE TABLE IF NOT EXISTS attachments (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename       TEXT NOT NULL,
  original_name  TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  local_path     TEXT NOT NULL,
  is_link        INTEGER NOT NULL DEFAULT 0,
  thumbnail_path TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);

-- 13. comments (Threads on tasks)
CREATE TABLE IF NOT EXISTS comments (
  id                TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_device_id  TEXT NOT NULL DEFAULT 'local',
  author_name       TEXT NOT NULL,
  body              TEXT NOT NULL,
  parent_comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  is_resolved       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);

-- 14. comment_reactions (Emoji reactions)
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id       TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reactor_device_id TEXT NOT NULL DEFAULT 'local',
  emoji            TEXT NOT NULL,
  PRIMARY KEY (comment_id, reactor_device_id, emoji)
);

-- 15. pomodoro_sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               TEXT PRIMARY KEY,
  task_id          TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,                -- 'work' | 'short_break' | 'long_break'
  duration_seconds INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  was_completed    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_task_id    ON pomodoro_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_started_at ON pomodoro_sessions(started_at);

-- 16. goals (Objectives linked to tasks/projects)
CREATE TABLE IF NOT EXISTS goals (
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

-- 17. goal_links (Join: goal <-> task/project)
CREATE TABLE IF NOT EXISTS goal_links (
  goal_id       TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,                   -- 'task' | 'project'
  resource_id   TEXT NOT NULL,
  PRIMARY KEY (goal_id, resource_type, resource_id)
);

-- 18. notification_history
CREATE TABLE IF NOT EXISTS notification_history (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,                      -- 'due' | 'reminder' | 'pomodoro' | 'collaboration' | 'agenda' | 'goal' | 'streak'
  task_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notification_history(created_at);

-- 19. settings (Key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                            -- JSON-encoded string
);

-- 20. modules (Feature toggles)
CREATE TABLE IF NOT EXISTS modules (
  module_name TEXT PRIMARY KEY,
  is_enabled  INTEGER NOT NULL DEFAULT 1
);

-- ============================================================
-- Phase 2 Tables (defined now to avoid schema cascades)
-- ============================================================

-- 21. users
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT,
  last_seen_at TEXT,
  created_at   TEXT NOT NULL
);

-- 22. devices
CREATE TABLE IF NOT EXISTS devices (
  id             TEXT PRIMARY KEY,
  device_name    TEXT NOT NULL,
  device_type    TEXT NOT NULL,
  pairing_token  TEXT NOT NULL,
  last_connected TEXT,
  is_trusted     INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);

-- 23. collaboration_members
CREATE TABLE IF NOT EXISTS collaboration_members (
  id            TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  device_id     TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  permission    TEXT NOT NULL DEFAULT 'editor',
  invited_at    TEXT NOT NULL,
  accepted_at   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_device_resource ON collaboration_members(resource_id, device_id);

-- 24. sync_queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id               TEXT PRIMARY KEY,
  operation        TEXT NOT NULL,
  table_name       TEXT NOT NULL,
  record_id        TEXT NOT NULL,
  payload          TEXT NOT NULL,
  target_device_id TEXT,
  created_at       TEXT NOT NULL,
  retry_count      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);

-- ============================================================
-- 25. FTS5 Full-Text Search Virtual Table & Triggers
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  id UNINDEXED,
  title,
  notes,
  content=tasks,
  content_rowid=rowid
);

-- Trigger: After Insert
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, id, title, notes)
  VALUES (new.rowid, new.id, new.title, coalesce(new.notes, ''));
END;

-- Trigger: After Delete
CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, notes)
  VALUES ('delete', old.rowid, old.id, old.title, coalesce(old.notes, ''));
END;

-- Trigger: After Update
CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, notes)
  VALUES ('delete', old.rowid, old.id, old.title, coalesce(old.notes, ''));
  INSERT INTO tasks_fts(rowid, id, title, notes)
  VALUES (new.rowid, new.id, new.title, coalesce(new.notes, ''));
END;

-- ============================================================
-- Default Seed Data
-- ============================================================

-- Built-in Smart Lists
INSERT OR IGNORE INTO lists (id, name, icon, is_smart, smart_type, sort_order, created_at, updated_at)
VALUES
  ('smart_my_day', 'My Day', '☀️', 1, 'my_day', 0, datetime('now'), datetime('now')),
  ('smart_important', 'Important', '⭐', 1, 'important', 1, datetime('now'), datetime('now')),
  ('smart_planned', 'Planned', '📅', 1, 'planned', 2, datetime('now'), datetime('now')),
  ('smart_all', 'All Tasks', '📋', 1, 'all', 3, datetime('now'), datetime('now')),
  ('smart_completed', 'Completed', '✅', 1, 'completed', 4, datetime('now'), datetime('now')),
  ('list_inbox', 'Inbox', '📥', 0, NULL, 5, datetime('now'), datetime('now'));

-- Feature Modules
INSERT OR IGNORE INTO modules (module_name, is_enabled)
VALUES
  ('my_day', 1),
  ('project_management', 1),
  ('pomodoro', 1),
  ('agenda', 1),
  ('goals_habits', 1),
  ('dashboard', 1),
  ('file_attachments', 1),
  ('nlp_parsing', 1),
  ('vim_keybindings', 0),
  ('animated_backgrounds', 0),
  ('habit_tracker', 0),
  ('collaboration', 0),
  ('companion_sync', 0);

-- Default Settings (SCHEMA.md)
INSERT OR IGNORE INTO settings (key, value)
VALUES
  ('theme', '"auto"'),
  ('accent_color', '"#1B88FF"'),
  ('font_size', '"md"'),
  ('font_family', '"system"'),
  ('density', '"comfortable"'),
  ('sidebar_position', '"left"'),
  ('launch_at_login', 'true'),
  ('day_starts_at', '"00:00"'),
  ('pomodoro_work_minutes', '25'),
  ('pomodoro_break_minutes', '5'),
  ('pomodoro_long_break_minutes', '15'),
  ('pomodoro_sessions_before_long_break', '4'),
  ('vim_keybindings', 'false'),
  ('active_profile_preset', '"custom"'),
  ('app_lock_enabled', 'false'),
  ('reduce_motion', 'false'),
  ('task_card_style', '"default"');
