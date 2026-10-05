-- Migration 0016: Goal Progress Time-Series Logs
-- Creates goal_progress_logs table for tracking historical progress milestones and value updates.

CREATE TABLE IF NOT EXISTS goal_progress_logs (
  id               TEXT PRIMARY KEY,
  goal_id          TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  progress_percent REAL NOT NULL,
  current_value    REAL NOT NULL,
  recorded_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_goal_id ON goal_progress_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_logs_recorded ON goal_progress_logs(recorded_at);
