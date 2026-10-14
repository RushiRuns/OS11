-- Library of reusable groups (for example Coding)
CREATE TABLE custom_groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  sort_order    REAL NOT NULL DEFAULT 0,
  last_used_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);
CREATE UNIQUE INDEX uq_custom_groups_name
  ON custom_groups(name COLLATE NOCASE) WHERE deleted_at IS NULL;

-- Sections of a group (for example Bugs to be fixed)
CREATE TABLE custom_group_sections (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES custom_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  sort_order  REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  UNIQUE (id, group_id)
);
CREATE UNIQUE INDEX uq_custom_group_sections_name
  ON custom_group_sections(group_id, name COLLATE NOCASE) WHERE deleted_at IS NULL;
CREATE INDEX idx_custom_group_sections_group
  ON custom_group_sections(group_id, sort_order);

-- Per-project overrides: hide, rename, reorder only. No private sections.
CREATE TABLE project_group_overrides (
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_id     TEXT NOT NULL REFERENCES custom_group_sections(id) ON DELETE CASCADE,
  is_hidden      INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  name_override  TEXT CHECK (name_override IS NULL OR length(name_override) BETWEEN 1 AND 40),
  sort_override  REAL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (project_id, section_id)
);

-- One row per task per group. The composite foreign key guarantees the
-- section really belongs to the group.
CREATE TABLE task_custom_values (
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  section_id  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (task_id, group_id),
  FOREIGN KEY (section_id, group_id)
    REFERENCES custom_group_sections(id, group_id) ON DELETE CASCADE
);
CREATE INDEX idx_task_custom_values_section
  ON task_custom_values(group_id, section_id);
