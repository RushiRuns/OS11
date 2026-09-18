-- ============================================================
-- Migration 0006: Pin Lists and Projects
-- ============================================================

ALTER TABLE lists ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN pinned_sort_order INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_lists_is_pinned ON lists(is_pinned);

ALTER TABLE projects ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN pinned_sort_order INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_projects_is_pinned ON projects(is_pinned);

UPDATE lists SET pinned_sort_order = sort_order WHERE is_smart = 1;
