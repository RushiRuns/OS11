-- ============================================================
-- Migration 0008: Area Model (Workspace → Area → Project → Task)
-- ============================================================

-- 1. Create workspaces table and seed default workspace
CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at)
VALUES ('ws_default', 'Personal Workspace', datetime('now'), datetime('now'));

-- 2. Create areas table and seed default 'Personal' Area
CREATE TABLE IF NOT EXISTS areas (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'ws_default' REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT,
  color        TEXT,
  sort_order   REAL NOT NULL DEFAULT 0,
  is_collapsed INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_areas_workspace_id ON areas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_areas_sort_order ON areas(sort_order);

INSERT OR IGNORE INTO areas (id, workspace_id, name, icon, sort_order, is_collapsed, created_at, updated_at)
VALUES ('area_default', 'ws_default', 'Personal', '🏠', 0, 0, datetime('now'), datetime('now'));

-- 3. Convert existing list_groups into areas
INSERT OR IGNORE INTO areas (id, workspace_id, name, icon, color, sort_order, is_collapsed, created_at, updated_at)
SELECT id, 'ws_default', name, NULL, NULL, sort_order, is_collapsed, created_at, datetime('now')
FROM list_groups;

-- 4. Add area_id to projects
ALTER TABLE projects ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_area_id ON projects(area_id);

-- 5. Convert existing user lists into projects
INSERT OR IGNORE INTO projects (
  id, name, description, color, icon, status, due_date, default_view,
  sort_order, group_id, is_pinned, pinned_sort_order, area_id, created_at, updated_at
)
SELECT
  l.id,
  l.name,
  NULL,
  l.color,
  l.icon,
  'active',
  NULL,
  'list',
  l.sort_order,
  l.group_id,
  COALESCE(l.is_pinned, 0),
  COALESCE(l.pinned_sort_order, 0),
  CASE
    WHEN l.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM areas a WHERE a.id = l.group_id)
      THEN l.group_id
    ELSE 'area_default'
  END,
  l.created_at,
  l.updated_at
FROM lists l
WHERE l.is_smart = 0 AND l.id != 'list_inbox';

-- 6. Ensure all projects have an area_id
UPDATE projects
SET area_id = CASE
  WHEN group_id IS NOT NULL AND EXISTS (SELECT 1 FROM areas a WHERE a.id = projects.group_id)
    THEN group_id
  ELSE 'area_default'
END
WHERE area_id IS NULL;

-- 7. Add area_id to tasks
ALTER TABLE tasks ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON tasks(area_id);

-- 8. Migrate tasks
-- 8a. Inbox tasks: area_id = NULL, project_id = NULL
UPDATE tasks
SET area_id = NULL,
    project_id = NULL
WHERE list_id = 'list_inbox';

-- 8b. Smart lists tasks: area_id = NULL, project_id = NULL
UPDATE tasks
SET area_id = NULL,
    project_id = NULL
WHERE list_id LIKE 'smart_%';

-- 8c. Tasks in user lists (which are now projects)
UPDATE tasks
SET
  project_id = list_id,
  area_id = (SELECT p.area_id FROM projects p WHERE p.id = tasks.list_id)
WHERE list_id IS NOT NULL
  AND list_id != 'list_inbox'
  AND list_id NOT LIKE 'smart_%';

-- 8d. Tasks that already had a project_id
UPDATE tasks
SET area_id = (SELECT p.area_id FROM projects p WHERE p.id = tasks.project_id)
WHERE project_id IS NOT NULL AND area_id IS NULL;

-- 8e. Subtasks inherit from parent task
UPDATE tasks
SET
  area_id = (SELECT t2.area_id FROM tasks t2 WHERE t2.id = tasks.parent_task_id),
  project_id = (SELECT t2.project_id FROM tasks t2 WHERE t2.id = tasks.parent_task_id)
WHERE parent_task_id IS NOT NULL AND area_id IS NULL;

-- 9. Make list_id nullable by dropping NOT NULL column
DROP INDEX IF EXISTS idx_tasks_list_id;
ALTER TABLE tasks DROP COLUMN list_id;
ALTER TABLE tasks ADD COLUMN list_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);

-- 10. Smart list visibility settings
INSERT OR IGNORE INTO settings (key, value)
VALUES
  ('sidebar_show_all_tasks', 'false'),
  ('sidebar_show_completed', 'false');
