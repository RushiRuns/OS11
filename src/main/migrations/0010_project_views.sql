-- ============================================================
-- Migration 0010: Project Curated Views
-- ============================================================

-- Add views column storing JSON array of enabled view modes
-- Defaults to all 5 views for existing projects to prevent regressions
ALTER TABLE projects ADD COLUMN views TEXT NOT NULL DEFAULT '["list","board","timeline","calendar","table"]';
