-- ============================================================
-- Migration 0013: Goal Status & Archival
-- ============================================================

ALTER TABLE goals ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived'));
ALTER TABLE goals ADD COLUMN completed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
