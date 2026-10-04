-- ============================================================
-- Migration 0012: GTD Scheduling (Anytime, Someday, Waiting For)
-- ============================================================

-- 1. Tasks GTD Scheduling columns
ALTER TABLE tasks ADD COLUMN bucket TEXT CHECK (bucket IN ('anytime', 'someday'));
ALTER TABLE tasks ADD COLUMN waiting_on TEXT;
ALTER TABLE tasks ADD COLUMN waiting_since TEXT;
ALTER TABLE tasks ADD COLUMN follow_up_date TEXT;
ALTER TABLE tasks ADD COLUMN follow_up_notified_on TEXT;
ALTER TABLE tasks ADD COLUMN reviewed_at TEXT;

-- 2. Projects Someday & Review columns
ALTER TABLE projects ADD COLUMN is_someday INTEGER NOT NULL DEFAULT 0 CHECK (is_someday IN (0, 1));
ALTER TABLE projects ADD COLUMN reviewed_at TEXT;

-- 3. Partial indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tasks_bucket ON tasks(bucket, sort_order)
  WHERE bucket IS NOT NULL AND is_trashed = 0 AND is_completed = 0;

CREATE INDEX IF NOT EXISTS idx_tasks_waiting ON tasks(follow_up_date, waiting_since)
  WHERE waiting_since IS NOT NULL AND is_trashed = 0 AND is_completed = 0;

CREATE INDEX IF NOT EXISTS idx_tasks_inbox ON tasks(sort_order)
  WHERE area_id IS NULL AND project_id IS NULL AND parent_task_id IS NULL AND due_date IS NULL AND is_trashed = 0 AND is_completed = 0;

CREATE INDEX IF NOT EXISTS idx_projects_someday ON projects(is_someday)
  WHERE is_someday = 1;

-- 4. Seed GTD modules
INSERT OR IGNORE INTO modules (module_name, is_enabled) VALUES
  ('anytime', 0),
  ('someday', 0),
  ('waiting_for', 0);

-- 5. Seed GTD settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('gtd_someday_review_interval_days', '14'),
  ('gtd_auto_clear_waiting_on_complete', 'true');

-- 6. Seed GTD smart lists
INSERT OR IGNORE INTO lists (id, name, icon, color, is_smart, smart_type, sort_order, is_pinned, pinned_sort_order, notification_enabled, created_at, updated_at) VALUES
  ('smart_anytime', 'Anytime', 'Layers', '#0ea5e9', 1, 'anytime', 6, 1, 6, 1, datetime('now'), datetime('now')),
  ('smart_someday', 'Someday', 'Archive', '#8b5cf6', 1, 'someday', 7, 1, 7, 1, datetime('now'), datetime('now')),
  ('smart_waiting_for', 'Waiting For', 'Clock', '#f59e0b', 1, 'waiting_for', 8, 1, 8, 1, datetime('now'), datetime('now'));
