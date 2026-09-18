-- ============================================================
-- Migration 0005: Project Grouping (Folders)
-- ============================================================

ALTER TABLE projects ADD COLUMN group_id TEXT REFERENCES list_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_group_id ON projects(group_id);
