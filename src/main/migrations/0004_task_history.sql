-- ============================================================
-- Migration 0004: Task Version History
-- ============================================================

CREATE TABLE IF NOT EXISTS task_history (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  changed_fields TEXT NOT NULL,                  -- JSON string: { [field]: { from: any, to: any } }
  changed_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_history_task_id    ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_changed_at ON task_history(changed_at);
