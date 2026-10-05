-- ============================================================
-- Migration 0014: Goal Hierarchy and Category
-- ============================================================

ALTER TABLE goals ADD COLUMN parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN category TEXT;

CREATE INDEX IF NOT EXISTS idx_goals_parent_goal_id ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
