-- 0018_okr_model.sql
-- Replaces the goals model (0001, 0013-0016) with objectives, key results and check-ins.
-- Existing goal data is test data and is dropped on purpose.

DROP TABLE IF EXISTS goal_progress_logs;
DROP TABLE IF EXISTS goal_habit_logs;
DROP TABLE IF EXISTS goal_links;
DROP TABLE IF EXISTS goals;

CREATE TABLE objectives (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  notes        TEXT,
  area_id      TEXT REFERENCES areas(id) ON DELETE SET NULL,
  period_kind  TEXT NOT NULL DEFAULT 'quarter' CHECK (period_kind IN ('quarter','custom')),
  period_start TEXT NOT NULL,   -- YYYY-MM-DD, local date
  period_end   TEXT NOT NULL,   -- YYYY-MM-DD, local date, inclusive
  cadence      TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('daily','weekly','biweekly','monthly')),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','archived')),
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK (period_end >= period_start)
);

CREATE TABLE key_results (
  id            TEXT PRIMARY KEY,
  objective_id  TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('metric','work','habit')),
  unit          TEXT,                      -- display only: 'L', 'ms', '%'
  start_value   REAL NOT NULL DEFAULT 0,   -- metric only
  target_value  REAL NOT NULL DEFAULT 0,   -- metric: the target number. habit: check-ins per week. work: unused
  current_value REAL NOT NULL DEFAULT 0,   -- metric only: copy of the latest check-in value
  status        TEXT CHECK (status IN ('on_track','at_risk','off_track')),  -- latest check-in status, NULL before the first
  sort_order    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CHECK (kind <> 'metric' OR start_value <> target_value),
  CHECK (kind <> 'habit' OR (target_value >= 1 AND target_value <= 7))
);

CREATE TABLE kr_check_ins (
  id            TEXT PRIMARY KEY,
  key_result_id TEXT NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  checked_in_on TEXT NOT NULL,   -- YYYY-MM-DD, local date
  value         REAL,            -- metric: the number entered. work and habit: snapshot (done count, period check-ins)
  status        TEXT NOT NULL CHECK (status IN ('on_track','at_risk','off_track')),
  note          TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE kr_habit_logs (
  key_result_id TEXT NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  log_date      TEXT NOT NULL,   -- YYYY-MM-DD, local date
  created_at    TEXT NOT NULL,
  PRIMARY KEY (key_result_id, log_date)
);

CREATE INDEX idx_objectives_status       ON objectives(status);
CREATE INDEX idx_key_results_objective   ON key_results(objective_id);
CREATE INDEX idx_kr_check_ins_kr_date    ON kr_check_ins(key_result_id, checked_in_on);

-- ALTERs go last. The runner swallows 'duplicate column' errors, and anything after a
-- swallowed error in the same file is skipped.
ALTER TABLE tasks    ADD COLUMN key_result_id TEXT REFERENCES key_results(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN key_result_id TEXT REFERENCES key_results(id) ON DELETE SET NULL;
CREATE INDEX idx_tasks_key_result    ON tasks(key_result_id)    WHERE key_result_id IS NOT NULL;
CREATE INDEX idx_projects_key_result ON projects(key_result_id) WHERE key_result_id IS NOT NULL;
