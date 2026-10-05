-- Migration 0015: Habit Streaks, Best Record and Daily Habit Logs
-- Adds longest_streak to goals table and creates goal_habit_logs for daily check-in history.

ALTER TABLE goals ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;

UPDATE goals SET longest_streak = streak_count WHERE streak_count > 0;

CREATE TABLE IF NOT EXISTS goal_habit_logs (
  goal_id       TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  check_in_date TEXT NOT NULL, -- 'YYYY-MM-DD'
  created_at    TEXT NOT NULL,
  PRIMARY KEY (goal_id, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_goal_habit_logs_goal ON goal_habit_logs(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_habit_logs_date ON goal_habit_logs(check_in_date);
