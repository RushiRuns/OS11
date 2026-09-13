-- OS11 Initial Schema (0001)

-- 1. local_identity
CREATE TABLE IF NOT EXISTS local_identity (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT,
  created_at   TEXT NOT NULL
);

-- 2. list_groups
CREATE TABLE IF NOT EXISTS list_groups (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

-- 3. lists
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

-- 4. projects
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT,
  icon         TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  due_date     TEXT,
  default_view TEXT NOT NULL DEFAULT 'list',
  sort_order   REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- 5. sections
CREATE TABLE IF NOT EXISTS sections (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(project_id);

-- 6. tasks
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
  priority            INTEGER NOT NULL DEFAULT 0,
  is_starred          INTEGER NOT NULL DEFAULT 0,
  is_completed        INTEGER NOT NULL DEFAULT 0,
  completed_at        TEXT,
  estimated_minutes   INTEGER,
  assignee_device_id  TEXT,
  created_by_device   TEXT NOT NULL DEFAULT 'local',
  sort_order          REAL NOT NULL DEFAULT 0,
  my_day_date         TEXT,
  pomodoro_count      INTEGER NOT NULL DEFAULT 0,
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

-- 8. milestones
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

-- 9. tags
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  color         TEXT,
  parent_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
  sort_order    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- 10. task_tags
CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);

-- 11. reminders
CREATE TABLE IF NOT EXISTS reminders (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  remind_at     TEXT NOT NULL,
  is_triggered  INTEGER NOT NULL DEFAULT 0,
  snoozed_until TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_task_id   ON reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE is_triggered = 0;

-- 12. attachments
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  local_path    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);

-- 13. comments
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

-- 14. comment_reactions
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id        TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reactor_device_id TEXT NOT NULL DEFAULT 'local',
  emoji             TEXT NOT NULL,
  PRIMARY KEY (comment_id, reactor_device_id, emoji)
);

-- 15. pomodoro_sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               TEXT PRIMARY KEY,
  task_id          TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ended_at         TEXT,
  was_completed    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_task_id    ON pomodoro_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_started_at ON pomodoro_sessions(started_at);

-- 16. goals
CREATE TABLE IF NOT EXISTS goals (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  goal_type        TEXT NOT NULL,
  target_date      TEXT,
  target_value     REAL DEFAULT 100,
  current_value    REAL NOT NULL DEFAULT 0,
  streak_count     INTEGER NOT NULL DEFAULT 0,
  last_progress_at TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- 17. goal_links
CREATE TABLE IF NOT EXISTS goal_links (
  goal_id       TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  PRIMARY KEY (goal_id, resource_type, resource_id)
);

-- 18. notification_history
CREATE TABLE IF NOT EXISTS notification_history (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  task_id    TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notification_history(created_at);

-- 19. settings
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 20. modules
CREATE TABLE IF NOT EXISTS modules (
  module_name TEXT PRIMARY KEY,
  is_enabled  INTEGER NOT NULL DEFAULT 1
);

-- Phase 2 Tables (defined in schema from day one)
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

-- 25. tasks_fts (Full-Text Search)
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  id UNINDEXED,
  title,
  notes,
  content=tasks,
  content_rowid=rowid
);

-- Seed initial smart lists if empty
INSERT OR IGNORE INTO lists (id, name, icon, is_smart, smart_type, sort_order, created_at, updated_at)
VALUES
  ('smart_my_day', 'My Day', '☀️', 1, 'my_day', 0, datetime('now'), datetime('now')),
  ('smart_important', 'Important', '⭐', 1, 'important', 1, datetime('now'), datetime('now')),
  ('smart_planned', 'Planned', '📅', 1, 'planned', 2, datetime('now'), datetime('now')),
  ('smart_all', 'All Tasks', '📋', 1, 'all', 3, datetime('now'), datetime('now')),
  ('smart_completed', 'Completed', '✅', 1, 'completed', 4, datetime('now'), datetime('now')),
  ('list_inbox', 'Tasks', '📥', 0, NULL, 5, datetime('now'), datetime('now'));

-- Seed initial modules if empty
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
